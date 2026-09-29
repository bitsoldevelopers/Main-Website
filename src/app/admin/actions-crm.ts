"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { LEAD_STATUS_META, isLeadPriority, isLeadStatus } from "@/lib/admin/leads";
import { handleLeadStatusChange } from "@/lib/automation/engine";
import { recordActivity } from "@/lib/automation/timeline";
import type { FormState } from "./actions";

/** CRM writes: leads beyond status/delete (which live in actions.ts), notes,
 *  assignment, follow-ups, the pipeline board and campaigns. */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(err: unknown): FormState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  return { ok: false, error: message };
}

function revalidateLead(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/board");
  if (id) revalidatePath(`/admin/leads/${id}`);
}

// ─── Leads ──────────────────────────────────────────────────────────────────

export async function saveLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("leads.write");

  const id = str(formData, "id");
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const subject = str(formData, "subject") || "Manual entry";
  const message = str(formData, "message");
  const phone = str(formData, "phone");
  const company = str(formData, "company");
  const country = str(formData, "country");
  const city = str(formData, "city");
  const source = str(formData, "source") || "manual";
  const priority = str(formData, "priority") || "NORMAL";
  const status = str(formData, "status") || "NEW";

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "A name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (!isLeadPriority(priority)) fieldErrors.priority = "Pick a priority.";
  if (!isLeadStatus(status)) fieldErrors.status = "Pick a status.";
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = {
    name,
    email,
    subject,
    message: message || "(added manually from the admin panel)",
    phone: phone || null,
    company: company || null,
    country: country || null,
    city: city || null,
    priority,
    status,
  };

  let leadId = id;
  try {
    if (id) {
      await prisma.lead.update({ where: { id }, data });
    } else {
      const lead = await prisma.lead.create({ data: { ...data, source } });
      leadId = lead.id;
    }
  } catch (err) {
    return failure(err);
  }

  void logActivity({
    actor: actorLabel(session),
    action: id ? "lead.updated" : "lead.created",
    entity: "lead",
    entityId: leadId,
    detail: `${name} <${email}>${id ? "" : " (manual)"}`,
  });
  if (isLeadStatus(status)) await handleLeadStatusChange(leadId, status, actorLabel(session));
  revalidateLead(leadId);
  redirect(`/admin/leads/${leadId}`);
}

/** Kanban drag/drop; called from the client with plain arguments. */
export async function moveLead(id: string, status: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await requireAdminAction("leads.write");
    if (typeof id !== "string" || !id || !isLeadStatus(status)) return { ok: false, error: "Invalid move" };
    const lead = await prisma.lead.update({ where: { id }, data: { status }, select: { name: true } });
    void logActivity({ actor: actorLabel(session), action: "lead.status_changed", entity: "lead", entityId: id, detail: `${lead.name} → ${status}` });
    await recordActivity({ leadId: id, type: "STATUS_CHANGED", title: `Status changed to ${LEAD_STATUS_META[status].label}`, actor: actorLabel(session) });
    await handleLeadStatusChange(id, status, actorLabel(session));
    revalidateLead(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not move the lead" };
  }
}

export async function addLeadNote(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  const body = str(formData, "body").slice(0, 5000);
  if (!leadId || !body) return;
  await prisma.leadNote.create({ data: { leadId, body, author: session.name || session.sub } });
  void logActivity({ actor: actorLabel(session), action: "lead.note_added", entity: "lead", entityId: leadId });
  await recordActivity({ leadId, type: "NOTE", title: "Note added", detail: body.slice(0, 300), actor: actorLabel(session) });
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function deleteLeadNote(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const leadId = str(formData, "leadId");
  await prisma.leadNote.delete({ where: { id } });
  void logActivity({ actor: actorLabel(session), action: "lead.note_deleted", entity: "lead", entityId: leadId });
  revalidatePath(`/admin/leads/${leadId}`);
}

export async function assignLead(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const userId = str(formData, "userId");
  const lead = await prisma.lead.update({
    where: { id },
    data: { assignedToId: userId || null },
    select: { name: true, assignedTo: { select: { name: true, email: true } } },
  });
  void logActivity({
    actor: actorLabel(session),
    action: "lead.assigned",
    entity: "lead",
    entityId: id,
    detail: userId ? `${lead.name} → ${lead.assignedTo?.name || lead.assignedTo?.email}` : `${lead.name} → unassigned`,
  });
  await recordActivity({
    leadId: id,
    type: "ASSIGNED",
    title: userId ? `Assigned to ${lead.assignedTo?.name || lead.assignedTo?.email}` : "Unassigned",
    actor: actorLabel(session),
  });
  revalidateLead(id);
}

export async function setLeadPriority(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const priority = str(formData, "priority");
  if (!isLeadPriority(priority)) throw new Error("Invalid priority");
  const lead = await prisma.lead.update({ where: { id }, data: { priority }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "lead.priority_changed", entity: "lead", entityId: id, detail: `${lead.name} → ${priority}` });
  revalidateLead(id);
}

export async function setLeadFollowUp(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const raw = str(formData, "followUpAt");
  const followUpAt = raw ? new Date(raw) : null;
  if (followUpAt && Number.isNaN(followUpAt.getTime())) throw new Error("Invalid date");
  await prisma.lead.update({ where: { id }, data: { followUpAt } });
  void logActivity({
    actor: actorLabel(session),
    action: followUpAt ? "lead.follow_up_set" : "lead.follow_up_cleared",
    entity: "lead",
    entityId: id,
    detail: followUpAt ? followUpAt.toISOString().slice(0, 10) : null,
  });
  revalidateLead(id);
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function saveCampaign(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("campaigns.write");

  const id = str(formData, "id");
  const name = str(formData, "name");
  const platform = str(formData, "platform") || "META";
  const objective = str(formData, "objective");
  const status = str(formData, "status") || "DRAFT";
  const landingPage = str(formData, "landingPage");
  const utmSource = str(formData, "utmSource");
  const utmMedium = str(formData, "utmMedium");
  const utmCampaign = str(formData, "utmCampaign");
  const notes = str(formData, "notes");
  const budgetRaw = str(formData, "budget");
  const budget = budgetRaw ? Number.parseFloat(budgetRaw) : null;
  const startRaw = str(formData, "startDate");
  const endRaw = str(formData, "endDate");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "A campaign name is required.";
  if (budgetRaw && (!Number.isFinite(budget) || (budget as number) < 0)) fieldErrors.budget = "Enter a budget of 0 or more.";
  if (landingPage && !/^(https?:\/\/|\/)/.test(landingPage)) fieldErrors.landingPage = "Use a full URL or a path starting with /.";
  const startDate = startRaw ? new Date(startRaw) : null;
  const endDate = endRaw ? new Date(endRaw) : null;
  if (startDate && Number.isNaN(startDate.getTime())) fieldErrors.startDate = "Invalid date.";
  if (endDate && Number.isNaN(endDate.getTime())) fieldErrors.endDate = "Invalid date.";
  if (startDate && endDate && endDate < startDate) fieldErrors.endDate = "The end date is before the start date.";
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = {
    name,
    platform,
    objective: objective || null,
    status,
    landingPage: landingPage || null,
    utmSource: utmSource || null,
    utmMedium: utmMedium || null,
    utmCampaign: utmCampaign || null,
    notes: notes || null,
    budget,
    startDate,
    endDate,
  };

  let campaignId = id;
  try {
    if (id) await prisma.campaign.update({ where: { id }, data });
    else campaignId = (await prisma.campaign.create({ data })).id;
  } catch (err) {
    return failure(err);
  }

  void logActivity({ actor: actorLabel(session), action: id ? "campaign.updated" : "campaign.created", entity: "campaign", entityId: campaignId, detail: name });
  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
  redirect(`/admin/campaigns/${campaignId}`);
}

export async function deleteCampaign(formData: FormData) {
  const session = await requireAdminAction("campaigns.write");
  const id = str(formData, "id");
  const campaign = await prisma.campaign.delete({ where: { id }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "campaign.deleted", entity: "campaign", entityId: id, detail: campaign.name });
  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}
