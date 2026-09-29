"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { MANDATORY_STOP_CONDITIONS, isConditionField, isConditionOperator, operatorNeedsValue } from "@/lib/automation/conditions";
import { syncAutomationSteps, syncAutomationsOfSequence } from "@/lib/automation/defaults";
import { variablesIn, TEMPLATE_VARIABLES } from "@/lib/automation/email/render";
import { enrollLead, markLeadReplied, pauseLead, resumeLead, stopRunsForLead } from "@/lib/automation/engine";
import { refreshOutreachEmail } from "@/lib/automation/lead-contacts";
import { saveOutreachSettings } from "@/lib/automation/settings";
import { suppress, suppressionKey } from "@/lib/automation/suppression";
import { recordActivity } from "@/lib/automation/timeline";
import { checkEmailSyntax } from "@/lib/automation/validate";
import { runDueJobs } from "@/lib/automation/worker";
import type { FormState } from "./actions";

/**
 * Writes of the lead-automation area: sender settings, templates, sequences,
 * automations, runs, tasks and the suppression list. Like every admin action
 * each one checks the session and the permission itself.
 */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(err: unknown): FormState {
  const message = err instanceof Error ? err.message.split("\n")[0] : "Something went wrong";
  return { ok: false, error: message };
}

function int(value: string, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function revalidateAutomation() {
  revalidatePath("/admin/automation", "layout");
}

function revalidateLead(id: string) {
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${id}`);
  revalidateAutomation();
}

const KNOWN_VARIABLES = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.name));

function unknownVariables(...texts: string[]): string[] {
  return [...new Set(texts.flatMap(variablesIn))].filter((name) => !KNOWN_VARIABLES.has(name));
}

// ─── Sender settings ────────────────────────────────────────────────────────

export async function saveSenderSettings(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("outreach.manage");
  const fromName = str(formData, "fromName");
  const fromEmail = str(formData, "fromEmail").toLowerCase();
  const replyTo = str(formData, "replyTo").toLowerCase();
  const companyName = str(formData, "companyName");
  const companyAddress = str(formData, "companyAddress");
  const signature = str(formData, "signature");

  const fieldErrors: Record<string, string> = {};
  if (!fromName) fieldErrors.fromName = "A sender name is required.";
  if (/[<>"\r\n]/.test(fromName)) fieldErrors.fromName = 'The name cannot contain < > or ".';
  if (!fromEmail || checkEmailSyntax(fromEmail).validity === "INVALID") fieldErrors.fromEmail = "Enter the address outreach is sent from.";
  if (replyTo && checkEmailSyntax(replyTo).validity === "INVALID") fieldErrors.replyTo = "Enter a valid reply-to address, or leave it empty.";
  if (!companyAddress) fieldErrors.companyAddress = "The postal address is shown in every email and is required.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  try {
    await saveOutreachSettings({
      fromName,
      fromEmail,
      replyTo,
      companyName: companyName || fromName,
      companyAddress,
      signature,
      dailyLimit: int(str(formData, "dailyLimit"), 50, 1, 2000),
      batchLimit: int(str(formData, "batchLimit"), 5, 1, 100),
    });
  } catch (err) {
    return failure(err);
  }
  void logActivity({ actor: actorLabel(session), action: "outreach.settings_saved", entity: "automation", detail: `From ${fromName} <${fromEmail}>` });
  revalidateAutomation();
  return { ok: true };
}

// ─── Templates ──────────────────────────────────────────────────────────────

export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const name = str(formData, "name");
  const subject = str(formData, "subject");
  const bodyRaw = formData.get("body");
  const body = typeof bodyRaw === "string" ? bodyRaw.replace(/\r\n?/g, "\n").trim() : "";
  const ctaLabel = str(formData, "ctaLabel");
  const ctaUrl = str(formData, "ctaUrl");

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Give the template a name.";
  if (!subject) fieldErrors.subject = "A subject is required.";
  else if (subject.length > 300) fieldErrors.subject = "Keep the subject under 300 characters.";
  if (!body) fieldErrors.body = "The email body is required.";
  else if (body.length > 20_000) fieldErrors.body = "The body is too long.";
  if (Boolean(ctaLabel) !== Boolean(ctaUrl)) fieldErrors.ctaUrl = "A call to action needs both a label and a link.";
  if (ctaUrl && !/^(https?:\/\/|\{\{)/i.test(ctaUrl)) fieldErrors.ctaUrl = "Use a full link starting with https://.";
  const unknown = unknownVariables(subject, body, ctaLabel, ctaUrl);
  if (unknown.length > 0) {
    fieldErrors.body = `Unknown variable${unknown.length === 1 ? "" : "s"}: ${unknown.map((v) => `{{${v}}}`).join(", ")}.`;
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const data = { name, subject, body, ctaLabel: ctaLabel || null, ctaUrl: ctaUrl || null };
  let templateId = id;
  try {
    if (id) await prisma.emailTemplate.update({ where: { id }, data });
    else templateId = (await prisma.emailTemplate.create({ data })).id;
  } catch (err) {
    return failure(err);
  }
  void logActivity({ actor: actorLabel(session), action: id ? "template.updated" : "template.created", entity: "template", entityId: templateId, detail: name });
  revalidateAutomation();
  redirect(`/admin/automation/templates?saved=${encodeURIComponent(name)}`);
}

export async function deleteTemplate(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const used = await prisma.emailSequenceStep.count({ where: { templateId: id } });
  if (used > 0) redirect(`/admin/automation/templates?error=${encodeURIComponent("That template is used by a sequence. Replace it there first.")}`);
  const template = await prisma.emailTemplate.delete({ where: { id }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "template.deleted", entity: "template", entityId: id, detail: template.name });
  revalidateAutomation();
  redirect("/admin/automation/templates");
}

// ─── Sequences ──────────────────────────────────────────────────────────────

interface StepInput {
  id?: string;
  name: string;
  delayDays: number;
  templateId: string;
}

function parseSteps(raw: string): StepInput[] | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return null;
    return value.map((item) => {
      const step = (item ?? {}) as Record<string, unknown>;
      return {
        id: typeof step.id === "string" && step.id ? step.id : undefined,
        name: typeof step.name === "string" ? step.name.trim().slice(0, 191) : "",
        delayDays: int(String(step.delayDays ?? 0), 0, 0, 365),
        templateId: typeof step.templateId === "string" ? step.templateId : "",
      };
    });
  } catch {
    return null;
  }
}

export async function saveSequence(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const name = str(formData, "name");
  const description = str(formData, "description");
  const steps = parseSteps(str(formData, "steps"));

  if (!name) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { name: "Give the sequence a name." } };
  if (!steps || steps.length === 0) return { ok: false, error: "A sequence needs at least one email." };
  if (steps.length > 12) return { ok: false, error: "A sequence can have at most 12 emails." };

  const templateIds = [...new Set(steps.map((step) => step.templateId))];
  const templates = await prisma.emailTemplate.findMany({ where: { id: { in: templateIds } }, select: { id: true } });
  const known = new Set(templates.map((t) => t.id));
  for (const [i, step] of steps.entries()) {
    if (!step.name) return { ok: false, error: `Email ${i + 1} needs a name.` };
    if (!known.has(step.templateId)) return { ok: false, error: `Choose a template for email ${i + 1}.` };
    if (i > 0 && step.delayDays < 1) {
      return { ok: false, error: `Email ${i + 1} must wait at least 1 day after the previous one; two emails on the same day read as spam.` };
    }
  }

  let sequenceId = id;
  try {
    await prisma.$transaction(async (tx) => {
      if (id) await tx.emailSequence.update({ where: { id }, data: { name, description: description || null } });
      else sequenceId = (await tx.emailSequence.create({ data: { name, description: description || null } })).id;

      const existing = await tx.emailSequenceStep.findMany({ where: { sequenceId }, select: { id: true } });
      const keep = new Set(steps.map((step) => step.id).filter(Boolean));
      const remove = existing.filter((step) => !keep.has(step.id)).map((step) => step.id);
      if (remove.length > 0) await tx.emailSequenceStep.deleteMany({ where: { id: { in: remove } } });

      const owned = new Set(existing.map((step) => step.id));
      for (const [i, step] of steps.entries()) {
        const data = { order: i + 1, name: step.name, delayDays: step.delayDays, templateId: step.templateId };
        if (step.id && owned.has(step.id)) await tx.emailSequenceStep.update({ where: { id: step.id }, data });
        else await tx.emailSequenceStep.create({ data: { ...data, sequenceId } });
      }
    });
    await syncAutomationsOfSequence(sequenceId);
  } catch (err) {
    return failure(err);
  }

  void logActivity({ actor: actorLabel(session), action: id ? "sequence.updated" : "sequence.created", entity: "sequence", entityId: sequenceId, detail: `${name} (${steps.length} emails)` });
  revalidateAutomation();
  redirect(`/admin/automation/sequences?saved=${encodeURIComponent(name)}`);
}

export async function deleteSequence(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const used = await prisma.automation.count({ where: { sequenceId: id } });
  if (used > 0) redirect(`/admin/automation/sequences?error=${encodeURIComponent("That sequence is used by an automation. Change or delete the automation first.")}`);
  const sequence = await prisma.emailSequence.delete({ where: { id }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "sequence.deleted", entity: "sequence", entityId: id, detail: sequence.name });
  revalidateAutomation();
  redirect("/admin/automation/sequences");
}

// ─── Automations ────────────────────────────────────────────────────────────

interface ConditionInput {
  field: string;
  operator: string;
  value: string;
}

function parseConditions(raw: string): ConditionInput[] | null {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return null;
    const rules: ConditionInput[] = [];
    for (const item of value) {
      const rule = (item ?? {}) as Record<string, unknown>;
      const field = typeof rule.field === "string" ? rule.field : "";
      const operator = typeof rule.operator === "string" ? rule.operator : "";
      const text = typeof rule.value === "string" ? rule.value.trim().slice(0, 191) : "";
      if (!isConditionField(field) || !isConditionOperator(operator)) return null;
      if (operatorNeedsValue(operator) && !text) return null;
      rules.push({ field, operator, value: operatorNeedsValue(operator) ? text : "" });
    }
    return rules.slice(0, 10);
  } catch {
    return null;
  }
}

export async function saveAutomation(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const name = str(formData, "name");
  const description = str(formData, "description");
  const sequenceId = str(formData, "sequenceId");
  const trigger = str(formData, "trigger") === "MANUAL" ? "MANUAL" : "IMPORT";
  const createTask = formData.get("createTask") === "on";
  const taskTitle = str(formData, "taskTitle");
  const taskNote = str(formData, "taskNote");
  const conditions = parseConditions(str(formData, "conditions"));

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Give the automation a name.";
  const sequence = sequenceId
    ? await prisma.emailSequence.findUnique({ where: { id: sequenceId }, select: { id: true, _count: { select: { steps: true } } } })
    : null;
  if (!sequence) fieldErrors.sequenceId = "Choose the sequence this automation sends.";
  else if (sequence._count.steps === 0) fieldErrors.sequenceId = "That sequence has no emails yet.";
  const unknown = unknownVariables(taskTitle, taskNote);
  if (unknown.length > 0) fieldErrors.taskTitle = `Unknown variable: ${unknown.map((v) => `{{${v}}}`).join(", ")}.`;
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  if (conditions === null) return { ok: false, error: "One of the entry conditions is incomplete." };

  const data = {
    name,
    description: description || null,
    sequenceId,
    trigger,
    createTask,
    taskTitle: taskTitle || null,
    taskNote: taskNote || null,
    taskDueDays: int(str(formData, "taskDueDays"), 1, 0, 60),
  };

  let automationId = id;
  try {
    await prisma.$transaction(async (tx) => {
      if (id) await tx.automation.update({ where: { id }, data });
      else automationId = (await tx.automation.create({ data: { ...data, status: "DRAFT", createdBy: actorLabel(session).slice(0, 191) } })).id;

      await tx.automationCondition.deleteMany({ where: { automationId } });
      await tx.automationCondition.createMany({
        data: [
          ...conditions.map((rule) => ({ automationId, kind: "ENTRY", field: rule.field, operator: rule.operator, value: rule.value || null, locked: false })),
          ...MANDATORY_STOP_CONDITIONS.map((rule) => ({ automationId, kind: "STOP", field: rule.field, operator: rule.operator, value: rule.value, locked: true })),
        ],
      });
    });
    await syncAutomationSteps(automationId);
  } catch (err) {
    return failure(err);
  }

  void logActivity({ actor: actorLabel(session), action: id ? "automation.updated" : "automation.created", entity: "automation", entityId: automationId, detail: name });
  revalidateAutomation();
  redirect(`/admin/automation/automations/${automationId}`);
}

export async function setAutomationStatus(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!["ACTIVE", "PAUSED", "DRAFT"].includes(status)) throw new Error("Invalid automation status");

  const automation = await prisma.automation.findUnique({ where: { id }, select: { name: true, _count: { select: { steps: true } } } });
  if (!automation) throw new Error("This automation no longer exists");
  if (status === "ACTIVE" && automation._count.steps === 0) throw new Error("Add a sequence with at least one email before activating");

  await prisma.automation.update({ where: { id }, data: { status } });
  if (status === "ACTIVE") {
    // Runs that were held back while it was paused go out on the next pass.
    const runs = await prisma.automationRun.findMany({ where: { automationId: id, status: "ACTIVE" }, select: { id: true, nextRunAt: true } });
    const now = new Date();
    const due = runs.filter((run) => !run.nextRunAt || run.nextRunAt <= now).map((run) => run.id);
    if (due.length > 0) {
      await prisma.automationJob.updateMany({ where: { type: "RUN_STEP", status: "PENDING", refId: { in: due } }, data: { runAt: now } });
    }
  }
  void logActivity({ actor: actorLabel(session), action: `automation.${status.toLowerCase()}`, entity: "automation", entityId: id, detail: automation.name });
  revalidateAutomation();
}

export async function deleteAutomation(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const open = await prisma.automationRun.count({ where: { automationId: id, status: { in: ["ACTIVE", "PAUSED"] } } });
  if (open > 0) {
    redirect(`/admin/automation/automations/${id}?error=${encodeURIComponent(`${open} lead${open === 1 ? " is" : "s are"} still in this automation. Stop those runs first.`)}`);
  }
  const automation = await prisma.automation.delete({ where: { id }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "automation.deleted", entity: "automation", entityId: id, detail: automation.name });
  revalidateAutomation();
  redirect("/admin/automation/automations");
}

// ─── Runs, from the lead profile ────────────────────────────────────────────

export async function startLeadAutomation(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("outreach.write");
  const leadId = str(formData, "leadId");
  const automationId = str(formData, "automationId");
  if (!automationId) return { ok: false, error: "Choose an automation." };
  let result;
  try {
    result = await enrollLead({ leadId, automationId, actor: actorLabel(session) });
  } catch (err) {
    return failure(err);
  }
  if (!result.ok) return { ok: false, error: result.message };
  void logActivity({ actor: actorLabel(session), action: "automation.lead_started", entity: "lead", entityId: leadId, detail: result.toEmail });
  revalidateLead(leadId);
  after(() => runDueJobs({ source: "start" }).then(() => undefined));
  return { ok: true };
}

export async function pauseLeadAutomation(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const leadId = str(formData, "leadId");
  await pauseLead(leadId, actorLabel(session));
  revalidateLead(leadId);
}

export async function resumeLeadAutomation(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const leadId = str(formData, "leadId");
  await resumeLead(leadId, actorLabel(session));
  revalidateLead(leadId);
  after(() => runDueJobs({ source: "resume" }).then(() => undefined));
}

export async function stopLeadAutomation(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const leadId = str(formData, "leadId");
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, runs: { where: { status: { in: ["ACTIVE", "PAUSED"] } }, select: { emailsSent: true } } } });
  if (!lead) return;
  await stopRunsForLead(leadId, "MANUAL_STOP", actorLabel(session));
  if (["EMAIL_QUEUED", "PAUSED"].includes(lead.status)) {
    const sent = lead.runs.reduce((sum, run) => sum + run.emailsSent, 0);
    await prisma.lead.update({ where: { id: leadId }, data: { status: sent > 0 ? "FOLLOW_UP" : "READY_FOR_OUTREACH" } });
  }
  revalidateLead(leadId);
}

export async function markReplied(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  await markLeadReplied({ leadId, actor: actorLabel(session), detail: "Marked as replied by hand" });
  void logActivity({ actor: actorLabel(session), action: "lead.replied", entity: "lead", entityId: leadId });
  revalidateLead(leadId);
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("leads.write");
  const leadId = str(formData, "leadId");
  const title = str(formData, "title").slice(0, 300);
  const description = str(formData, "description");
  const dueRaw = str(formData, "dueAt");
  const assignedToId = str(formData, "assignedToId");
  const dueAt = dueRaw ? new Date(dueRaw) : null;

  if (!title) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { title: "Say what needs doing." } };
  if (dueAt && Number.isNaN(dueAt.getTime())) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { dueAt: "Invalid date." } };

  try {
    await prisma.task.create({
      data: {
        leadId: leadId || null,
        title,
        description: description || null,
        dueAt,
        assignedToId: assignedToId || null,
        source: "MANUAL",
        createdBy: actorLabel(session).slice(0, 191),
      },
    });
  } catch (err) {
    return failure(err);
  }
  if (leadId) await recordActivity({ leadId, type: "TASK_CREATED", title: `Task created: ${title}`, actor: actorLabel(session) });
  revalidatePath("/admin/automation/followups");
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
  return { ok: true };
}

export async function setTaskStatus(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!["OPEN", "DONE", "CANCELLED"].includes(status)) throw new Error("Invalid task status");
  const task = await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "OPEN" ? null : new Date() },
    select: { leadId: true, title: true },
  });
  if (task.leadId && status === "DONE") {
    await recordActivity({ leadId: task.leadId, type: "TASK_COMPLETED", title: `Task completed: ${task.title}`, actor: actorLabel(session) });
  }
  revalidatePath("/admin/automation/followups");
  if (task.leadId) revalidatePath(`/admin/leads/${task.leadId}`);
}

// ─── Suppression list ───────────────────────────────────────────────────────

export async function addSuppression(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("outreach.write");
  const raw = str(formData, "value");
  const note = str(formData, "note");
  const value = suppressionKey(raw);
  if (!value) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { value: "Enter an email address, or a domain as @example.com." } };
  }
  try {
    await suppress({ value, reason: "MANUAL", source: actorLabel(session), note: note || undefined });
    // Anyone being emailed at that address right now stops being emailed.
    if (!value.startsWith("@")) {
      const owners = await prisma.leadEmail.findMany({ where: { emailKey: value }, select: { leadId: true } });
      for (const owner of owners) await refreshOutreachEmail(owner.leadId, { actor: actorLabel(session) });
    }
  } catch (err) {
    return failure(err);
  }
  void logActivity({ actor: actorLabel(session), action: "suppression.added", entity: "suppression", detail: value });
  revalidateAutomation();
  return { ok: true };
}

export async function removeSuppression(formData: FormData) {
  const session = await requireAdminAction("outreach.manage");
  const id = str(formData, "id");
  const entry = await prisma.suppressionEntry.findUnique({ where: { id } });
  if (!entry) return;
  // An opt-out is the recipient's decision; it is not ours to reverse.
  if (entry.reason === "UNSUBSCRIBED" || entry.reason === "COMPLAINED") {
    throw new Error("An unsubscribe cannot be removed: the recipient asked not to be emailed.");
  }
  await prisma.suppressionEntry.delete({ where: { id } });
  void logActivity({ actor: actorLabel(session), action: "suppression.removed", entity: "suppression", detail: `${entry.value} (${entry.reason})` });
  revalidateAutomation();
}

// ─── Queue ──────────────────────────────────────────────────────────────────

export async function runQueueNow(): Promise<void> {
  await requireAdminAction("outreach.write");
  await runDueJobs({ source: "manual", budgetMs: 20_000 });
  revalidateAutomation();
}

export async function retryJob(formData: FormData) {
  await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const job = await prisma.automationJob.findUnique({ where: { id }, select: { type: true, refId: true, status: true } });
  if (!job || job.status !== "FAILED") return;
  // A run that failed with its job is reopened, or the retry would find nothing to do.
  if (job.type === "RUN_STEP") {
    await prisma.automationRun.updateMany({
      where: { id: job.refId, status: "FAILED" },
      data: { status: "ACTIVE", stopReason: null, finishedAt: null },
    });
  }
  await prisma.automationJob.update({ where: { id }, data: { status: "PENDING", runAt: new Date(), attempts: 0, finishedAt: null } });
  revalidateAutomation();
  after(() => runDueJobs({ source: "retry" }).then(() => undefined));
}
