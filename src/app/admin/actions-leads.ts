"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { hasPermission } from "@/lib/admin/rbac";
import { LEAD_STATUS_META, isLeadPriority, isLeadStatus, type LeadStatus } from "@/lib/admin/leads";
import { lookupDomains } from "@/lib/automation/domain-check";
import { enrollLead, handleLeadStatusChange, pauseLead, resumeLead, stopRunsForLead } from "@/lib/automation/engine";
import { BULK_LIMIT, type BulkAction } from "@/lib/automation/bulk";
import { PHONE_TYPES } from "@/lib/automation/import-parse";
import { materializeContacts, refreshOutreachEmail } from "@/lib/automation/lead-contacts";
import {
  companyKey,
  displayName,
  identityKey,
  normalizeEmail,
  normalizeLinkedin,
  normalizePhone,
  normalizeWebsite,
} from "@/lib/automation/normalize";
import { EMAIL_TYPES } from "@/lib/automation/outreach-email";
import { draftPersonalization } from "@/lib/automation/personalize";
import { cleanTags } from "@/lib/automation/sources/types";
import { recordActivities, recordActivity } from "@/lib/automation/timeline";
import { checkEmail } from "@/lib/automation/validate";
import { runDueJobs } from "@/lib/automation/worker";
import type { FormState } from "./actions";

/** Writes of the lead profile: contact details, outreach address, tags, bulk actions. */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
}

function failure(err: unknown): FormState {
  const message = err instanceof Error ? err.message.split("\n")[0] : "Something went wrong";
  return { ok: false, error: message };
}

function revalidateLead(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/board");
  revalidatePath("/admin/automation", "layout");
  if (id) revalidatePath(`/admin/leads/${id}`);
}

async function ensureCompany(input: { name: string; website: string | null; domain: string | null; description: string; phone: string }): Promise<string | null> {
  const key = companyKey(input.name) || (input.domain ? companyKey(input.domain) : "");
  if (!key) return null;
  const existing = await prisma.company.findUnique({ where: { nameKey: key } });
  if (!existing) {
    const created = await prisma.company.create({
      data: {
        name: (input.name || input.domain || "").slice(0, 300),
        nameKey: key,
        website: input.website,
        domain: input.domain,
        description: input.description || null,
        phone: input.phone || null,
      },
      select: { id: true },
    });
    return created.id;
  }
  const patch: Prisma.CompanyUpdateInput = {};
  if (!existing.website && input.website) {
    patch.website = input.website;
    patch.domain = input.domain;
  }
  if (!existing.description && input.description) patch.description = input.description;
  if (!existing.phone && input.phone) patch.phone = input.phone;
  if (Object.keys(patch).length > 0) await prisma.company.update({ where: { id: existing.id }, data: patch });
  return existing.id;
}

// ─── The lead form ──────────────────────────────────────────────────────────

export async function saveLeadProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("leads.write");
  const actor = actorLabel(session);

  const id = str(formData, "id");
  const firstName = str(formData, "firstName").slice(0, 191);
  const lastName = str(formData, "lastName").slice(0, 191);
  const jobTitle = str(formData, "jobTitle").slice(0, 300);
  const company = str(formData, "company");
  const websiteRaw = str(formData, "website");
  const linkedinRaw = str(formData, "linkedinUrl");
  const contactLocation = str(formData, "contactLocation").slice(0, 300);
  const city = str(formData, "city").slice(0, 191);
  const country = str(formData, "country").slice(0, 191);
  const companyDescription = text(formData, "companyDescription");
  const subject = str(formData, "subject").slice(0, 191);
  const message = text(formData, "message");
  const status = str(formData, "status");
  const priority = str(formData, "priority");

  const emails = EMAIL_TYPES.map((type) => ({ type, email: str(formData, `email_${type}`) })).filter((e) => e.email);
  const phones = PHONE_TYPES.map((type) => ({ type, phone: str(formData, `phone_${type}`).slice(0, 191) })).filter((p) => p.phone);

  const fieldErrors: Record<string, string> = {};
  const website = websiteRaw ? normalizeWebsite(websiteRaw) : null;
  if (websiteRaw && !website) fieldErrors.website = "Enter a website such as company.com.";
  const linkedinKey = linkedinRaw ? normalizeLinkedin(linkedinRaw) : "";
  if (linkedinRaw && !linkedinKey) fieldErrors.linkedinUrl = "Enter a LinkedIn profile URL.";

  const domains = await lookupDomains(
    emails.map((e) => normalizeEmail(e.email).split("@")[1] ?? "").filter(Boolean),
    { deadlineMs: 6000 }
  );
  const checked = emails.map((e) => ({ ...e, emailKey: normalizeEmail(e.email).slice(0, 191), check: checkEmail(e.email, domains) }));
  for (const email of checked) {
    if (email.check.reason === "BAD_FORMAT" || email.check.reason === "TOO_LONG") {
      fieldErrors[`email_${email.type}`] = "This is not a valid email address.";
    }
  }
  const keys = checked.map((e) => e.emailKey);
  if (new Set(keys).size !== keys.length) fieldErrors.email_SECONDARY = "The same address is entered twice.";
  for (const phone of phones) {
    if (!normalizePhone(phone.phone)) fieldErrors[`phone_${phone.type}`] = "This does not look like a phone number.";
  }
  if (!firstName && !lastName && !company && emails.length === 0 && phones.length === 0) {
    fieldErrors.firstName = "Enter at least a name, a company, an email or a phone number.";
  }
  if (status && !isLeadStatus(status)) fieldErrors.status = "Pick a status.";
  if (priority && !isLeadPriority(priority)) fieldErrors.priority = "Pick a priority.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  // The same person must not be entered twice under another spelling.
  const personalKeys = checked.filter((e) => e.check.reason !== "ROLE_ADDRESS").map((e) => e.emailKey);
  if (personalKeys.length > 0) {
    const [stored, legacy] = await Promise.all([
      prisma.leadEmail.findFirst({ where: { emailKey: { in: personalKeys }, NOT: { leadId: id || "-" } }, select: { lead: { select: { id: true, name: true } } } }),
      prisma.lead.findFirst({ where: { email: { in: personalKeys }, NOT: { id: id || "-" } }, select: { id: true, name: true } }),
    ]);
    const other = stored?.lead ?? legacy;
    if (other) return { ok: false, error: `${other.name} already has one of these email addresses. Open that lead instead of creating a duplicate.` };
  }

  const existing = id ? await prisma.lead.findUnique({ where: { id }, include: { emails: true, phones: true } }) : null;
  if (id && !existing) return { ok: false, error: "This lead no longer exists." };

  const name = displayName(firstName, lastName, company || checked[0]?.email || existing?.name || "Unnamed lead").slice(0, 191);
  const primaryPhone = phones.find((p) => p.type !== "COMPANY")?.phone ?? phones[0]?.phone ?? null;
  const companyPhone = phones.find((p) => p.type === "COMPANY")?.phone ?? "";

  let leadId = id;
  try {
    const companyId = await ensureCompany({
      name: company,
      website: website?.url.slice(0, 500) ?? null,
      domain: website?.domain.slice(0, 191) ?? null,
      description: companyDescription,
      phone: companyPhone,
    });

    const data = {
      name,
      firstName: firstName || null,
      lastName: lastName || null,
      jobTitle: jobTitle || null,
      company: company ? company.slice(0, 191) : null,
      companyId,
      website: website ? website.url.slice(0, 500) : null,
      linkedinUrl: linkedinRaw ? linkedinRaw.slice(0, 500) : null,
      linkedinKey: linkedinKey || null,
      identityKey: identityKey(firstName, lastName, company) || null,
      contactLocation: contactLocation || null,
      city: city || null,
      country: country || null,
      companyDescription: companyDescription || null,
      email: (checked[0]?.email ?? "").slice(0, 191),
      phone: primaryPhone,
      ...(priority ? { priority } : {}),
    };

    if (existing) {
      await prisma.lead.update({
        where: { id },
        data: { ...data, ...(subject ? { subject } : {}), ...(formData.has("message") ? { message } : {}), ...(status ? { status } : {}) },
      });
    } else {
      const created = await prisma.lead.create({
        data: {
          ...data,
          subject: subject || "Manual entry",
          message: message || "(added manually from the admin panel)",
          status: status || "NEW",
          source: "manual",
        },
        select: { id: true },
      });
      leadId = created.id;
    }

    // Contact rows: one per slot. A changed address starts with a clean record.
    const before = new Map((existing?.emails ?? []).map((e) => [e.type, e]));
    for (const type of EMAIL_TYPES) {
      const next = checked.find((e) => e.type === type);
      const current = before.get(type);
      if (!next) {
        if (current) await prisma.leadEmail.delete({ where: { id: current.id } });
        continue;
      }
      const same = current?.emailKey === next.emailKey;
      const fields = {
        email: next.email.slice(0, 320),
        emailKey: next.emailKey,
        isPrimary: type === "PRIMARY",
        ...(same && current?.bouncedAt ? {} : { validity: next.check.validity, validityReason: next.check.reason, bouncedAt: null }),
      };
      if (current) await prisma.leadEmail.update({ where: { id: current.id }, data: same ? fields : { ...fields, isOutreach: false } });
      else await prisma.leadEmail.create({ data: { ...fields, leadId, type } });
    }
    const phonesBefore = new Map((existing?.phones ?? []).map((p) => [p.type, p]));
    for (const type of PHONE_TYPES) {
      const next = phones.find((p) => p.type === type);
      const current = phonesBefore.get(type);
      if (!next) {
        if (current) await prisma.leadPhone.delete({ where: { id: current.id } });
        continue;
      }
      const fields = { phone: next.phone, phoneKey: normalizePhone(next.phone), isPrimary: type === "PRIMARY" };
      if (current) await prisma.leadPhone.update({ where: { id: current.id }, data: fields });
      else await prisma.leadPhone.create({ data: { ...fields, leadId, type } });
    }

    await refreshOutreachEmail(leadId, { actor });
  } catch (err) {
    return failure(err);
  }

  if (existing && status && status !== existing.status) {
    await recordActivity({
      leadId,
      type: "STATUS_CHANGED",
      title: `Status changed to ${LEAD_STATUS_META[status as LeadStatus].label}`,
      actor,
    });
    await handleLeadStatusChange(leadId, status, actor);
  }
  await recordActivity({ leadId, type: existing ? "LEAD_UPDATED" : "LEAD_CREATED", title: existing ? "Profile edited" : "Lead created by hand", actor });
  void logActivity({ actor, action: existing ? "lead.updated" : "lead.created", entity: "lead", entityId: leadId, detail: `${name}${existing ? "" : " (manual)"}` });
  revalidateLead(leadId);
  redirect(`/admin/leads/${leadId}`);
}

// ─── Outreach address ───────────────────────────────────────────────────────

/** `emailId` picks an address by hand; "auto" hands the choice back to the engine. */
export async function setOutreachEmail(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  const emailId = str(formData, "emailId");
  const actor = actorLabel(session);
  await materializeContacts(leadId);

  if (emailId === "auto") {
    await prisma.$transaction([
      prisma.lead.update({ where: { id: leadId }, data: { outreachLocked: false, outreachEmailReason: null } }),
      prisma.leadEmail.updateMany({ where: { leadId }, data: { isOutreach: false } }),
    ]);
    await refreshOutreachEmail(leadId, { actor });
  } else {
    const email = await prisma.leadEmail.findFirst({ where: { id: emailId, leadId } });
    if (!email) throw new Error("That address is not on this lead");
    await prisma.$transaction([
      prisma.leadEmail.updateMany({ where: { leadId }, data: { isOutreach: false } }),
      prisma.leadEmail.update({ where: { id: email.id }, data: { isOutreach: true } }),
      prisma.lead.update({ where: { id: leadId }, data: { outreachLocked: true, outreachEmailReason: null } }),
    ]);
    const selection = await refreshOutreachEmail(leadId, { actor });
    if (selection.selected_email !== email.email) {
      // The engine refused it: it is invalid, bounced or suppressed.
      const skipped = selection.skipped.find((s) => s.email === email.email);
      redirect(
        `/admin/leads/${leadId}?error=${encodeURIComponent(
          `${email.email} cannot be used for outreach${skipped ? ` (${skipped.reason.toLowerCase()})` : ""}.`
        )}#emails`
      );
    }
  }
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, outreachEmail: true } });
  if (lead?.status === "IMPORTED" && lead.outreachEmail) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "READY_FOR_OUTREACH" } });
  }
  revalidateLead(leadId);
}

// ─── Company description and personalisation ────────────────────────────────

export async function savePersonalization(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  const personalization = text(formData, "personalization").slice(0, 1000);
  try {
    await prisma.lead.update({ where: { id: leadId }, data: { personalization: personalization || null } });
  } catch (err) {
    return failure(err);
  }
  await recordActivity({
    leadId,
    type: "LEAD_UPDATED",
    title: personalization ? "Personalised line saved" : "Personalised line removed",
    detail: personalization || null,
    actor: actorLabel(session),
  });
  revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true };
}

/** Returns a draft for the admin to read and edit. It is not saved. */
export async function draftLeadPersonalization(leadId: string): Promise<{ ok: true; text: string; source: string } | { ok: false; error: string }> {
  try {
    await requireAdminAction("leads.write");
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { company: true, website: true, companyDescription: true, jobTitle: true, contactLocation: true },
    });
    if (!lead) return { ok: false, error: "This lead no longer exists." };
    const draft = await draftPersonalization({
      companyName: lead.company,
      website: lead.website,
      companyDescription: lead.companyDescription,
      title: lead.jobTitle,
      location: lead.contactLocation,
    });
    return { ok: true, ...draft };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The draft could not be written." };
  }
}

// ─── Tags ───────────────────────────────────────────────────────────────────

async function tagIds(names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    const existing = await prisma.tag.findFirst({ where: { name }, select: { id: true } });
    ids.push(existing?.id ?? (await prisma.tag.create({ data: { name }, select: { id: true } })).id);
  }
  return ids;
}

export async function addLeadTags(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  const names = cleanTags(str(formData, "tags"));
  if (names.length === 0) return;
  const ids = await tagIds(names);
  await prisma.leadTag.createMany({ data: ids.map((tagId) => ({ leadId, tagId })), skipDuplicates: true });
  await recordActivity({ leadId, type: "TAGGED", title: `Tagged: ${names.join(", ")}`, actor: actorLabel(session) });
  revalidateLead(leadId);
}

export async function removeLeadTag(formData: FormData) {
  await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  const tagId = str(formData, "tagId");
  await prisma.leadTag.deleteMany({ where: { leadId, tagId } });
  revalidateLead(leadId);
}

// ─── Bulk actions ───────────────────────────────────────────────────────────

const OUTREACH_ACTIONS: BulkAction[] = ["START_AUTOMATION", "PAUSE_AUTOMATION", "RESUME_AUTOMATION", "STOP_AUTOMATION"];

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

export async function bulkLeadAction(input: { ids: string[]; action: BulkAction; value?: string }): Promise<{ ok: boolean; message: string }> {
  try {
    const session = await requireAdminAction("leads.write");
    if (OUTREACH_ACTIONS.includes(input.action) && !hasPermission(session.role, "outreach.write")) {
      return { ok: false, message: "You do not have access to automations." };
    }
    const actor = actorLabel(session);
    const ids = [...new Set((Array.isArray(input.ids) ? input.ids : []).filter((id) => typeof id === "string" && id))];
    if (ids.length === 0) return { ok: false, message: "Select at least one lead." };
    if (ids.length > BULK_LIMIT) return { ok: false, message: `Select at most ${BULK_LIMIT} leads at a time.` };
    const value = typeof input.value === "string" ? input.value.trim() : "";

    const leads = await prisma.lead.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, status: true } });
    const found = leads.map((lead) => lead.id);
    if (found.length === 0) return { ok: false, message: "Those leads no longer exist." };

    let message: string;
    switch (input.action) {
      case "START_AUTOMATION": {
        if (!value) return { ok: false, message: "Choose an automation." };
        let started = 0;
        const blocked = new Map<string, number>();
        for (const id of found) {
          const result = await enrollLead({ leadId: id, automationId: value, actor });
          if (result.ok) started++;
          else blocked.set(result.reason, (blocked.get(result.reason) ?? 0) + 1);
          if (!result.ok && (result.reason === "AUTOMATION_NOT_ACTIVE" || result.reason === "AUTOMATION_NOT_FOUND" || result.reason === "NO_STEPS")) {
            return { ok: false, message: result.message };
          }
        }
        const reasons: Record<string, string> = {
          NO_OUTREACH_EMAIL: "have no usable email",
          ALREADY_RUNNING: "are already in an automation",
          ALREADY_COMPLETED: "already received this sequence",
          STOP_STATUS: "replied, opted out or are being handled by a person",
          CONDITION_FAILED: "do not meet the entry conditions",
          LEAD_NOT_FOUND: "no longer exist",
        };
        const skipped = [...blocked.entries()].map(([reason, n]) => `${n} ${reasons[reason] ?? reason.toLowerCase()}`);
        message = `Automation started for ${plural(started, "lead")}.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`;
        if (started > 0) after(() => runDueJobs({ source: "bulk" }).then(() => undefined));
        break;
      }
      case "PAUSE_AUTOMATION": {
        let n = 0;
        for (const id of found) n += await pauseLead(id, actor);
        message = `Paused ${plural(n, "run")}.`;
        break;
      }
      case "RESUME_AUTOMATION": {
        let n = 0;
        for (const id of found) n += await resumeLead(id, actor);
        message = `Resumed ${plural(n, "run")}.`;
        if (n > 0) after(() => runDueJobs({ source: "bulk" }).then(() => undefined));
        break;
      }
      case "STOP_AUTOMATION": {
        let n = 0;
        for (const id of found) n += await stopRunsForLead(id, "MANUAL_STOP", actor);
        await prisma.lead.updateMany({ where: { id: { in: found }, status: { in: ["EMAIL_QUEUED", "PAUSED"] } }, data: { status: "READY_FOR_OUTREACH" } });
        message = `Stopped ${plural(n, "run")}.`;
        break;
      }
      case "ASSIGN": {
        const user = value ? await prisma.user.findFirst({ where: { id: value, role: { in: ["ADMIN", "MANAGER", "EDITOR"] } }, select: { id: true, name: true, email: true } }) : null;
        if (value && !user) return { ok: false, message: "That team member no longer exists." };
        await prisma.lead.updateMany({ where: { id: { in: found } }, data: { assignedToId: user?.id ?? null } });
        const label = user ? user.name || user.email : "nobody";
        await recordActivities(found.map((leadId) => ({ leadId, type: "ASSIGNED" as const, title: user ? `Assigned to ${label}` : "Unassigned", actor })));
        message = `${plural(found.length, "lead")} assigned to ${label}.`;
        break;
      }
      case "STATUS": {
        if (!isLeadStatus(value)) return { ok: false, message: "Choose a status." };
        await prisma.lead.updateMany({ where: { id: { in: found } }, data: { status: value } });
        await recordActivities(
          found.map((leadId) => ({ leadId, type: "STATUS_CHANGED" as const, title: `Status changed to ${LEAD_STATUS_META[value].label}`, actor }))
        );
        for (const id of found) await handleLeadStatusChange(id, value, actor);
        message = `${plural(found.length, "lead")} set to ${LEAD_STATUS_META[value].label}.`;
        break;
      }
      case "ADD_TAG": {
        const names = cleanTags(value);
        if (names.length === 0) return { ok: false, message: "Enter a tag." };
        const tags = await tagIds(names);
        await prisma.leadTag.createMany({ data: found.flatMap((leadId) => tags.map((tagId) => ({ leadId, tagId }))), skipDuplicates: true });
        message = `Tagged ${plural(found.length, "lead")} with ${names.join(", ")}.`;
        break;
      }
      case "REMOVE_TAG": {
        if (!value) return { ok: false, message: "Choose the tag to remove." };
        const removed = await prisma.leadTag.deleteMany({ where: { leadId: { in: found }, tagId: value } });
        message = `Removed the tag from ${plural(removed.count, "lead")}.`;
        break;
      }
      case "DELETE": {
        if (value !== "DELETE") return { ok: false, message: "Deleting needs confirmation." };
        const removed = await prisma.lead.deleteMany({ where: { id: { in: found } } });
        message = `Deleted ${plural(removed.count, "lead")}.`;
        break;
      }
      default:
        return { ok: false, message: "Unknown action." };
    }

    void logActivity({ actor, action: `lead.bulk_${input.action.toLowerCase()}`, entity: "lead", detail: `${found.length} leads. ${message}` });
    revalidateLead();
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.split("\n")[0] : "The action failed." };
  }
}
