import { prisma } from "@/lib/prisma";
import {
  firstFailedCondition,
  describeCondition,
  stopReasonForStatus,
  stopReasonLabel,
  type StopReason,
} from "./conditions";
import { unsubscribeToken } from "./crypto";
import { getEmailProvider } from "./email/provider";
import { composeEmail, renderTemplate, templateValues } from "./email/render";
import { refreshOutreachEmail } from "./lead-contacts";
import { normalizeEmail } from "./normalize";
import { RetryableError, cancelJobs, enqueueJob } from "./queue";
import { getOutreachSettings, senderProblems } from "./settings";
import { suppress } from "./suppression";
import { recordActivities, recordActivity } from "./timeline";

/**
 * The automation engine. A run is one lead going through one automation's
 * steps (SEND_EMAIL → WAIT → … → CREATE_TASK). Every function here is safe
 * to call twice: state lives in the database and each step checks it first.
 *
 * The rule that matters most: before anything is sent, the stop conditions
 * are checked again against the lead as it is now, not as it was when the
 * step was scheduled.
 */

const DAY_MS = 86_400_000;

/** Statuses owned by the automation; it only ever moves a lead between these. */
const OUTREACH_STATUSES = ["NEW", "IMPORTED", "READY_FOR_OUTREACH", "EMAIL_QUEUED", "EMAIL_SENT", "FOLLOW_UP", "PAUSED"];

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://bitsolmarketing.com").replace(/\/+$/, "");
}

export function unsubscribeUrl(leadId: string, email: string): string {
  return `${siteUrl()}/unsubscribe?token=${encodeURIComponent(unsubscribeToken(leadId, email))}`;
}

// ─── Enrolment ──────────────────────────────────────────────────────────────

export type EnrollBlock =
  | "LEAD_NOT_FOUND"
  | "AUTOMATION_NOT_FOUND"
  | "AUTOMATION_NOT_ACTIVE"
  | "NO_STEPS"
  | "ALREADY_RUNNING"
  | "ALREADY_COMPLETED"
  | "STOP_STATUS"
  | "NO_OUTREACH_EMAIL"
  | "CONDITION_FAILED";

export type EnrollResult = { ok: true; runId: string; toEmail: string } | { ok: false; reason: EnrollBlock; message: string };

function blocked(reason: EnrollBlock, message: string): EnrollResult {
  return { ok: false, reason, message };
}

export async function enrollLead(input: {
  leadId: string;
  automationId: string;
  actor: string;
  /** Allow a lead that already went through this automation to go again. */
  allowRepeat?: boolean;
  now?: Date;
}): Promise<EnrollResult> {
  const now = input.now ?? new Date();
  const [lead, automation] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: input.leadId },
      include: {
        tags: { include: { tag: { select: { name: true } } } },
        runs: { select: { id: true, status: true, automationId: true, emailsSent: true } },
      },
    }),
    prisma.automation.findUnique({
      where: { id: input.automationId },
      include: { steps: { orderBy: { order: "asc" } }, conditions: { where: { kind: "ENTRY" } } },
    }),
  ]);

  if (!lead) return blocked("LEAD_NOT_FOUND", "This lead no longer exists.");
  if (!automation) return blocked("AUTOMATION_NOT_FOUND", "This automation no longer exists.");
  if (automation.status !== "ACTIVE") {
    return blocked("AUTOMATION_NOT_ACTIVE", `"${automation.name}" is ${automation.status.toLowerCase()}; activate it first.`);
  }
  if (automation.steps.length === 0) return blocked("NO_STEPS", `"${automation.name}" has no steps.`);
  if (lead.runs.some((run) => run.status === "ACTIVE" || run.status === "PAUSED")) {
    return blocked("ALREADY_RUNNING", "This lead is already in an automation.");
  }
  if (!input.allowRepeat && lead.runs.some((run) => run.automationId === automation.id && run.emailsSent > 0)) {
    return blocked("ALREADY_COMPLETED", `This lead has already received emails from "${automation.name}".`);
  }

  const stop = stopReasonForStatus(lead.status);
  if (stop) return blocked("STOP_STATUS", `${stopReasonLabel(stop)}; automated email is off for this lead.`);

  const failed = firstFailedCondition(automation.conditions, {
    status: lead.status,
    source: lead.source,
    jobTitle: lead.jobTitle,
    company: lead.company,
    contactLocation: lead.contactLocation,
    website: lead.website,
    linkedinUrl: lead.linkedinUrl,
    phone: lead.phone,
    tags: lead.tags.map((t) => t.tag.name),
  });
  if (failed) return blocked("CONDITION_FAILED", `Does not meet the entry condition: ${describeCondition(failed)}.`);

  const selection = await refreshOutreachEmail(lead.id, { actor: input.actor });
  if (!selection.selected_email) {
    const why = selection.skipped.length
      ? selection.skipped.map((s) => `${s.email} is ${s.reason.toLowerCase()}`).join("; ")
      : "no email address on file";
    return blocked("NO_OUTREACH_EMAIL", `No address to send to: ${why}.`);
  }

  const run = await prisma.automationRun.create({
    data: { automationId: automation.id, leadId: lead.id, status: "ACTIVE", stepIndex: 0, nextRunAt: now, startedBy: input.actor.slice(0, 191) },
    select: { id: true },
  });
  await enqueueJob({ type: "RUN_STEP", refId: run.id, runAt: now });
  if (OUTREACH_STATUSES.includes(lead.status)) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "EMAIL_QUEUED" } });
  }
  await recordActivity({
    leadId: lead.id,
    type: "AUTOMATION_STARTED",
    title: `Automation started: ${automation.name}`,
    detail: `Sending to ${selection.selected_email}`,
    actor: input.actor,
  });
  return { ok: true, runId: run.id, toEmail: selection.selected_email };
}

// ─── Ending and pausing runs ────────────────────────────────────────────────

async function closeRun(
  run: { id: string; leadId: string; automationName: string },
  status: "STOPPED" | "COMPLETED" | "FAILED",
  reason: StopReason | null,
  actor: string,
  detail?: string
): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.automationRun.update({ where: { id: run.id }, data: { status, stopReason: reason, nextRunAt: null, finishedAt: now } }),
    prisma.followUp.updateMany({ where: { runId: run.id, status: "SCHEDULED", type: "EMAIL" }, data: { status: "CANCELLED", completedAt: now } }),
    prisma.lead.update({ where: { id: run.leadId }, data: { nextFollowUpAt: null } }),
  ]);
  await cancelJobs("RUN_STEP", run.id);
  await recordActivity({
    leadId: run.leadId,
    type: status === "COMPLETED" ? "AUTOMATION_COMPLETED" : "AUTOMATION_STOPPED",
    title:
      status === "COMPLETED"
        ? `Automation completed: ${run.automationName}`
        : `Automation stopped: ${run.automationName}`,
    detail: [reason ? stopReasonLabel(reason) : null, detail].filter(Boolean).join("\n") || null,
    actor,
  });
}

/** Stops every open run of a lead. Returns how many were stopped. */
export async function stopRunsForLead(leadId: string, reason: StopReason, actor: string, detail?: string): Promise<number> {
  const runs = await prisma.automationRun.findMany({
    where: { leadId, status: { in: ["ACTIVE", "PAUSED"] } },
    select: { id: true, leadId: true, automation: { select: { name: true } } },
  });
  for (const run of runs) {
    await closeRun({ id: run.id, leadId: run.leadId, automationName: run.automation.name }, "STOPPED", reason, actor, detail);
  }
  return runs.length;
}

export async function stopRun(runId: string, actor: string): Promise<boolean> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    select: { id: true, leadId: true, status: true, emailsSent: true, automation: { select: { name: true } }, lead: { select: { status: true } } },
  });
  if (!run || (run.status !== "ACTIVE" && run.status !== "PAUSED")) return false;
  await closeRun({ id: run.id, leadId: run.leadId, automationName: run.automation.name }, "STOPPED", "MANUAL_STOP", actor);
  if (["EMAIL_QUEUED", "PAUSED"].includes(run.lead.status)) {
    await prisma.lead.update({ where: { id: run.leadId }, data: { status: run.emailsSent > 0 ? "FOLLOW_UP" : "READY_FOR_OUTREACH" } });
  }
  return true;
}

export async function pauseRun(runId: string, actor: string): Promise<boolean> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    select: { id: true, leadId: true, status: true, automation: { select: { name: true } }, lead: { select: { status: true } } },
  });
  if (!run || run.status !== "ACTIVE") return false;
  await prisma.automationRun.update({ where: { id: run.id }, data: { status: "PAUSED" } });
  await cancelJobs("RUN_STEP", run.id);
  if (OUTREACH_STATUSES.includes(run.lead.status)) {
    await prisma.lead.update({ where: { id: run.leadId }, data: { status: "PAUSED" } });
  }
  await recordActivity({ leadId: run.leadId, type: "AUTOMATION_PAUSED", title: `Automation paused: ${run.automation.name}`, actor });
  return true;
}

export async function resumeRun(runId: string, actor: string): Promise<boolean> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      leadId: true,
      status: true,
      nextRunAt: true,
      emailsSent: true,
      automation: { select: { name: true } },
      lead: { select: { status: true } },
    },
  });
  if (!run || run.status !== "PAUSED") return false;
  const now = new Date();
  // A wait that was running keeps its date; one that passed while paused fires now.
  const runAt = run.nextRunAt && run.nextRunAt > now ? run.nextRunAt : now;
  await prisma.automationRun.update({ where: { id: run.id }, data: { status: "ACTIVE", nextRunAt: runAt } });
  await enqueueJob({ type: "RUN_STEP", refId: run.id, runAt });
  if (run.lead.status === "PAUSED") {
    await prisma.lead.update({
      where: { id: run.leadId },
      data: { status: run.emailsSent === 0 ? "EMAIL_QUEUED" : run.emailsSent === 1 ? "EMAIL_SENT" : "FOLLOW_UP" },
    });
  }
  await recordActivity({ leadId: run.leadId, type: "AUTOMATION_RESUMED", title: `Automation resumed: ${run.automation.name}`, actor });
  return true;
}

export async function pauseLead(leadId: string, actor: string): Promise<number> {
  const runs = await prisma.automationRun.findMany({ where: { leadId, status: "ACTIVE" }, select: { id: true } });
  let paused = 0;
  for (const run of runs) if (await pauseRun(run.id, actor)) paused++;
  return paused;
}

export async function resumeLead(leadId: string, actor: string): Promise<number> {
  const runs = await prisma.automationRun.findMany({ where: { leadId, status: "PAUSED" }, select: { id: true } });
  let resumed = 0;
  for (const run of runs) if (await resumeRun(run.id, actor)) resumed++;
  return resumed;
}

/**
 * Call after any change to a lead's status, whoever made it. Statuses that
 * end outreach stop the lead's runs at once instead of at the next step.
 */
export async function handleLeadStatusChange(leadId: string, status: string, actor: string): Promise<void> {
  if (status === "PAUSED") {
    await pauseLead(leadId, actor);
    return;
  }
  const reason = stopReasonForStatus(status);
  if (reason) await stopRunsForLead(leadId, reason, actor);
}

// ─── Events from the outside world ──────────────────────────────────────────

async function createSalesTask(input: {
  leadId: string;
  runId?: string | null;
  title: string;
  description?: string | null;
  dueAt: Date;
  actor: string;
}): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { assignedToId: true, followUpAt: true } });
  if (!lead) return;
  await prisma.$transaction([
    prisma.task.create({
      data: {
        leadId: input.leadId,
        runId: input.runId ?? null,
        title: input.title.slice(0, 300),
        description: input.description ?? null,
        dueAt: input.dueAt,
        assignedToId: lead.assignedToId,
        source: "AUTOMATION",
        priority: "HIGH",
        createdBy: input.actor.slice(0, 191),
      },
    }),
    // The lead's own follow-up date drives the reminders the CRM already shows.
    ...(lead.followUpAt ? [] : [prisma.lead.update({ where: { id: input.leadId }, data: { followUpAt: input.dueAt } })]),
  ]);
  await recordActivity({ leadId: input.leadId, type: "TASK_CREATED", title: `Sales task created: ${input.title}`, actor: input.actor });
}

/** The lead answered. Ends automation and hands the lead to a person. */
export async function markLeadReplied(input: { leadId: string; actor: string; detail?: string; messageId?: string | null }): Promise<boolean> {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, name: true, status: true } });
  if (!lead) return false;
  const now = new Date();

  const message = input.messageId
    ? await prisma.emailMessage.findUnique({ where: { id: input.messageId }, select: { id: true } })
    : await prisma.emailMessage.findFirst({
        where: { leadId: lead.id, sentAt: { not: null } },
        orderBy: { sentAt: "desc" },
        select: { id: true },
      });
  if (message) {
    await prisma.emailMessage.update({ where: { id: message.id }, data: { status: "REPLIED", repliedAt: now } });
    await prisma.emailEvent.create({ data: { messageId: message.id, leadId: lead.id, type: "REPLIED", occurredAt: now } });
  }

  const alreadyReplied = lead.status === "REPLIED";
  if (OUTREACH_STATUSES.includes(lead.status)) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "REPLIED" } });
  }
  await recordActivity({ leadId: lead.id, type: "REPLIED", title: "Lead replied", detail: input.detail ?? null, actor: input.actor });
  await stopRunsForLead(lead.id, "REPLIED", input.actor);
  if (!alreadyReplied) {
    await createSalesTask({
      leadId: lead.id,
      title: `Reply to ${lead.name}`,
      description: "The lead answered an outreach email. Automation has stopped; continue the conversation personally.",
      dueAt: now,
      actor: input.actor,
    });
  }
  return true;
}

/** Opt-out. The address goes on the suppression list and outreach ends. */
export async function markUnsubscribed(input: { leadId?: string | null; email: string; source: string }): Promise<void> {
  const emailKey = normalizeEmail(input.email);
  if (emailKey) await suppress({ value: emailKey, reason: "UNSUBSCRIBED", source: input.source });

  const leadIds = new Set<string>();
  if (input.leadId) leadIds.add(input.leadId);
  if (emailKey) {
    const owners = await prisma.leadEmail.findMany({ where: { emailKey }, select: { leadId: true } });
    for (const owner of owners) leadIds.add(owner.leadId);
    const legacy = await prisma.lead.findMany({ where: { email: emailKey }, select: { id: true } });
    for (const owner of legacy) leadIds.add(owner.id);
  }

  for (const leadId of leadIds) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true, email: true, emails: { select: { emailKey: true } } } });
    if (!lead) continue;
    // It is the person who opted out, not one mailbox: none of their other
    // addresses may be used to reach them instead.
    const others = new Set([...lead.emails.map((e) => e.emailKey), normalizeEmail(lead.email)]);
    for (const other of others) {
      if (other && other !== emailKey) await suppress({ value: other, reason: "UNSUBSCRIBED", source: input.source, note: `Same person as ${emailKey}` });
    }
    if (!["WON", "LOST"].includes(lead.status)) {
      await prisma.lead.update({ where: { id: leadId }, data: { status: "UNSUBSCRIBED" } });
    }
    await recordActivity({ leadId, type: "UNSUBSCRIBED", title: `Unsubscribed: ${input.email}`, actor: input.source });
    await stopRunsForLead(leadId, "UNSUBSCRIBED", input.source);
    await refreshOutreachEmail(leadId, { silent: true });
  }
}

/** A hard bounce. The address is never used again. */
export async function markBounced(input: { leadId: string; email: string; detail?: string; source: string }): Promise<void> {
  const emailKey = normalizeEmail(input.email);
  const now = new Date();
  await prisma.leadEmail.updateMany({
    where: { leadId: input.leadId, emailKey },
    data: { bouncedAt: now, validity: "INVALID", validityReason: "BOUNCED" },
  });
  await suppress({ value: emailKey, reason: "BOUNCED", source: input.source, note: input.detail });

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { status: true } });
  if (!lead) return;
  if (OUTREACH_STATUSES.includes(lead.status)) {
    await prisma.lead.update({ where: { id: input.leadId }, data: { status: "BOUNCED" } });
  }
  await recordActivity({
    leadId: input.leadId,
    type: "EMAIL_BOUNCED",
    title: `Email bounced: ${input.email}`,
    detail: input.detail ?? null,
    actor: input.source,
  });
  await stopRunsForLead(input.leadId, "BOUNCED", input.source);
  await refreshOutreachEmail(input.leadId, { silent: true });
}

// ─── Executing steps ────────────────────────────────────────────────────────

export interface StepBudget {
  /** Emails this scheduler run may still send. */
  sendsLeft: number;
}

export interface RunOutcome {
  note: string;
  sent: number;
  /** Nothing was wrong, it is just not time: run the same job again then. */
  deferUntil?: Date;
}

function loadRun(runId: string) {
  return prisma.automationRun.findUnique({
    where: { id: runId },
    include: {
      automation: {
        include: {
          steps: { orderBy: { order: "asc" }, include: { sequenceStep: { include: { template: true } } } },
        },
      },
      lead: true,
    },
  });
}
type LoadedRun = NonNullable<Awaited<ReturnType<typeof loadRun>>>;
type LoadedStep = LoadedRun["automation"]["steps"][number];

function handle(run: LoadedRun) {
  return { id: run.id, leadId: run.leadId, automationName: run.automation.name };
}

const ENGINE = "Automation";

export async function processRun(runId: string, budget: StepBudget, now = new Date()): Promise<RunOutcome> {
  let sent = 0;

  // Each pass handles one step; a run rarely has more than a dozen.
  for (let guard = 0; guard < 60; guard++) {
    const run = await loadRun(runId);
    if (!run) return { note: "The run no longer exists", sent };
    if (run.status !== "ACTIVE") return { note: `The run is ${run.status.toLowerCase()}`, sent };
    if (run.automation.status !== "ACTIVE") {
      return { note: `"${run.automation.name}" is not active`, sent, deferUntil: new Date(now.getTime() + 30 * 60_000) };
    }

    if (run.lead.status === "PAUSED") {
      await prisma.automationRun.update({ where: { id: run.id }, data: { status: "PAUSED" } });
      return { note: "The lead is paused", sent };
    }
    const stop = stopReasonForStatus(run.lead.status);
    if (stop) {
      await closeRun(handle(run), "STOPPED", stop, ENGINE);
      return { note: `Stopped: ${stopReasonLabel(stop)}`, sent };
    }

    const step = run.automation.steps[run.stepIndex];
    if (!step) {
      await closeRun(handle(run), "COMPLETED", null, ENGINE);
      return { note: "Completed", sent };
    }

    if (step.type === "WAIT") {
      const days = Math.max(0, step.waitDays ?? 0);
      const dueAt = new Date(now.getTime() + days * DAY_MS);
      const next = run.automation.steps[run.stepIndex + 1];
      await prisma.$transaction([
        prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: run.stepIndex + 1, nextRunAt: dueAt } }),
        prisma.lead.update({ where: { id: run.leadId }, data: { nextFollowUpAt: dueAt } }),
        ...(next?.type === "SEND_EMAIL"
          ? [
              prisma.followUp.create({
                data: { leadId: run.leadId, runId: run.id, type: "EMAIL", title: next.label.slice(0, 300), dueAt, stepOrder: next.order },
              }),
            ]
          : []),
      ]);
      await enqueueJob({ type: "RUN_STEP", refId: run.id, runAt: dueAt });
      if (next?.type === "SEND_EMAIL") {
        await recordActivity({
          leadId: run.leadId,
          type: "FOLLOW_UP_SCHEDULED",
          title: `Follow-up scheduled: ${next.label}`,
          detail: `Due ${dueAt.toISOString().slice(0, 10)}, unless the lead replies first`,
          actor: ENGINE,
        });
      }
      return { note: `Waiting ${days} day${days === 1 ? "" : "s"}`, sent };
    }

    if (step.type === "CREATE_TASK") {
      const values = templateValues(run.lead, { outreachEmail: run.lead.outreachEmail ?? "", senderName: "", senderCompany: "" });
      const title = renderTemplate(run.automation.taskTitle || "Follow up personally with {{first_name|this lead}}", values).text;
      const note = run.automation.taskNote ? renderTemplate(run.automation.taskNote, values).text : null;
      await prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: run.stepIndex + 1 } });
      await createSalesTask({
        leadId: run.leadId,
        runId: run.id,
        title: title || "Follow up personally",
        description: note,
        dueAt: new Date(now.getTime() + Math.max(0, run.automation.taskDueDays) * DAY_MS),
        actor: ENGINE,
      });
      continue;
    }

    if (step.type === "SEND_EMAIL") {
      const result = await sendStep(run, step, budget, now);
      if (result.kind === "defer") return { note: result.note, sent, deferUntil: result.until };
      if (result.kind === "stopped") return { note: result.note, sent };
      if (result.kind === "sent") {
        sent++;
        budget.sendsLeft--;
      }
      continue;
    }

    // A step type this version does not know: skip it rather than stall.
    await prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: run.stepIndex + 1 } });
  }
  return { note: "Stopped after too many steps in one pass", sent };
}

type SendOutcome =
  | { kind: "sent" }
  | { kind: "skipped" }
  | { kind: "stopped"; note: string }
  | { kind: "defer"; until: Date; note: string };

function formatFrom(name: string, email: string): string {
  const safeName = name.replace(/["\\<>\r\n]/g, "").trim();
  return safeName ? `${safeName} <${email}>` : email;
}

async function sendStep(run: LoadedRun, step: LoadedStep, budget: StepBudget, now: Date): Promise<SendOutcome> {
  const template = step.sequenceStep?.template;
  if (!template) {
    // The sequence step was deleted after this run started.
    await prisma.automationRun.update({ where: { id: run.id }, data: { stepIndex: run.stepIndex + 1 } });
    return { kind: "skipped" };
  }

  const provider = getEmailProvider();
  const inAnHour = new Date(now.getTime() + 60 * 60_000);
  if (!provider.isConfigured()) {
    return { kind: "defer", until: inAnHour, note: `Email provider is not configured. ${provider.setupHint}` };
  }
  const settings = await getOutreachSettings();
  const problems = senderProblems(settings);
  if (problems.length > 0) return { kind: "defer", until: inAnHour, note: `Sender is not set up: ${problems[0]}` };

  if (budget.sendsLeft <= 0) {
    return { kind: "defer", until: new Date(now.getTime() + 60_000), note: "Send limit for this scheduler run reached" };
  }
  const sentLastDay = await prisma.emailMessage.count({ where: { sentAt: { gte: new Date(now.getTime() - DAY_MS) } } });
  if (sentLastDay >= settings.dailyLimit) {
    return { kind: "defer", until: new Date(now.getTime() + 30 * 60_000), note: `Daily limit of ${settings.dailyLimit} emails reached` };
  }

  // The address is chosen now, not when the run started: it may have bounced
  // or unsubscribed in between.
  const selection = await refreshOutreachEmail(run.leadId, { actor: ENGINE });
  if (!selection.selected_email) {
    const reasons = selection.skipped.map((s) => s.reason);
    const status = reasons.includes("UNSUBSCRIBED") ? "UNSUBSCRIBED" : reasons.includes("BOUNCED") ? "BOUNCED" : null;
    if (status && OUTREACH_STATUSES.includes(run.lead.status)) {
      await prisma.lead.update({ where: { id: run.leadId }, data: { status } });
    }
    await closeRun(handle(run), "STOPPED", "NO_ELIGIBLE_EMAIL", ENGINE);
    return { kind: "stopped", note: "No address left that may be emailed" };
  }
  const toEmail = normalizeEmail(selection.selected_email);

  const composed = composeEmail({
    subject: template.subject,
    body: template.body,
    ctaLabel: template.ctaLabel,
    ctaUrl: template.ctaUrl,
    values: templateValues(run.lead, { outreachEmail: toEmail, senderName: settings.fromName, senderCompany: settings.companyName }),
    footer: {
      companyName: settings.companyName,
      companyAddress: settings.companyAddress,
      signature: settings.signature,
      unsubscribeUrl: unsubscribeUrl(run.leadId, toEmail),
    },
  });
  if (!composed.subject) {
    await closeRun(handle(run), "FAILED", "SEND_FAILED", ENGINE, `The template "${template.name}" renders an empty subject.`);
    return { kind: "stopped", note: "Empty subject" };
  }

  const from = formatFrom(settings.fromName, settings.fromEmail);
  const replyTo = settings.replyTo || settings.fromEmail;
  const content = {
    templateId: template.id,
    toEmail,
    fromEmail: from.slice(0, 191),
    replyTo: replyTo.slice(0, 191),
    subject: composed.subject,
    bodyText: composed.text,
    bodyHtml: composed.html,
    provider: provider.name,
    status: "QUEUED",
    error: null,
  };
  // A retry of this step reuses its row, and with it the idempotency key.
  const earlier = await prisma.emailMessage.findFirst({
    where: { runId: run.id, stepOrder: step.order, status: { in: ["QUEUED", "FAILED"] } },
    select: { id: true },
  });
  const message = earlier
    ? await prisma.emailMessage.update({ where: { id: earlier.id }, data: content, select: { id: true } })
    : await prisma.emailMessage.create({ data: { ...content, leadId: run.leadId, runId: run.id, stepOrder: step.order }, select: { id: true } });

  const oneClick = `${siteUrl()}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken(run.leadId, toEmail))}`;
  const result = await provider.send({
    from,
    to: toEmail,
    replyTo,
    subject: composed.subject,
    html: composed.html,
    text: composed.text,
    headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    idempotencyKey: `bitsol-outreach-${message.id}`,
    tags: { lead: run.leadId, run: run.id, step: String(step.order) },
  });

  if (!result.ok) {
    await prisma.emailMessage.update({ where: { id: message.id }, data: { status: "FAILED", error: result.error.slice(0, 2000) } });
    await prisma.emailEvent.create({ data: { messageId: message.id, leadId: run.leadId, type: "FAILED", payload: { error: result.error } } });
    if (result.retryable) throw new RetryableError(result.error);
    await recordActivity({ leadId: run.leadId, type: "EMAIL_FAILED", title: `Email could not be sent: ${step.label}`, detail: result.error, actor: ENGINE });
    await closeRun(handle(run), "FAILED", "SEND_FAILED", ENGINE, result.error);
    return { kind: "stopped", note: `Send failed: ${result.error}` };
  }

  const first = run.emailsSent === 0;
  await prisma.$transaction([
    prisma.emailMessage.update({ where: { id: message.id }, data: { status: "SENT", providerMessageId: result.id.slice(0, 191), sentAt: now, error: null } }),
    prisma.emailEvent.create({ data: { messageId: message.id, leadId: run.leadId, type: "SENT", occurredAt: now } }),
    prisma.automationRun.update({
      where: { id: run.id },
      data: { emailsSent: { increment: 1 }, stepIndex: run.stepIndex + 1, nextRunAt: null },
    }),
    prisma.followUp.updateMany({
      where: { runId: run.id, stepOrder: step.order, status: "SCHEDULED" },
      data: { status: "SENT", completedAt: now },
    }),
    prisma.lead.update({
      where: { id: run.leadId },
      data: {
        lastContactedAt: now,
        nextFollowUpAt: null,
        ...(OUTREACH_STATUSES.includes(run.lead.status) ? { status: first ? "EMAIL_SENT" : "FOLLOW_UP" } : {}),
      },
    }),
  ]);
  await recordActivities([
    {
      leadId: run.leadId,
      type: first ? "EMAIL_SENT" : "FOLLOW_UP_SENT",
      title: `${first ? "Email sent" : "Follow-up sent"}: ${composed.subject}`,
      detail: `To ${toEmail}${provider.delivers ? "" : " (test mode: recorded, not delivered)"}`,
      actor: ENGINE,
    },
  ]);
  return { kind: "sent" };
}

/** The job gave up on a run: nothing else would ever move it. */
export async function failRun(runId: string, error: string): Promise<void> {
  const run = await prisma.automationRun.findUnique({
    where: { id: runId },
    select: { id: true, leadId: true, status: true, automation: { select: { name: true } } },
  });
  if (!run || run.status !== "ACTIVE") return;
  await closeRun({ id: run.id, leadId: run.leadId, automationName: run.automation.name }, "FAILED", "SEND_FAILED", ENGINE, error);
}
