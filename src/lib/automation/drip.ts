import { prisma } from "@/lib/prisma";
import { PROSPECT_SUBJECT } from "@/lib/admin/leads";
import { enrollLead, type EnrollBlock } from "./engine";
import { getEmailProvider } from "./email/provider";
import { getSendingMailboxes } from "./email/mailbox";
import { windowState } from "./email/rotation";
import { smtpPause } from "./email/smtp";
import { getOutreachSettings, senderProblems } from "./settings";

/**
 * The daily drip: works through a big imported list a few prospects a day
 * instead of starting thousands of sequences at once.
 *
 * Each pass starts imported prospects (oldest import first) in the chosen
 * automation, until either
 *   - `dripPerDay` prospects were started in the last 24 hours, or
 *   - the daily email limit has no room left once the emails already sent and
 *     the follow-ups already due in the next 24 hours are counted.
 * The second rule keeps follow-ups on time: a prospect's later emails always
 * come before new first emails, and the total stays within the daily limit.
 *
 * A cursor (import time + lead id) marks how far the list has been worked, so
 * a prospect that cannot be started (no usable address, an entry condition)
 * is passed over once rather than retried every minute.
 */

const DAY_MS = 86_400_000;
const CURSOR_KEY = "outreach.drip.cursor";
export const DRIP_ACTOR = "Daily drip";
const PASS_EVERY_MS = 5 * 60_000;

/** Failures that are about the automation, not the lead: stop and try again later. */
const AUTOMATION_BLOCKS: EnrollBlock[] = ["AUTOMATION_NOT_FOUND", "AUTOMATION_NOT_ACTIVE", "NO_STEPS"];

const state = globalThis as unknown as { __bitsolDripNextAt?: number };

interface Cursor {
  createdAt: string;
  id: string;
}

async function readCursor(): Promise<Cursor | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: CURSOR_KEY } });
  if (!row) return null;
  try {
    const value = JSON.parse(row.value) as Cursor;
    return typeof value.createdAt === "string" && typeof value.id === "string" ? value : null;
  } catch {
    return null;
  }
}

async function writeCursor(cursor: Cursor): Promise<void> {
  const value = JSON.stringify(cursor);
  await prisma.siteSetting.upsert({ where: { key: CURSOR_KEY }, update: { value }, create: { key: CURSOR_KEY, value } });
}

/** Prospects the drip could still start, after the cursor. */
function waitingWhere(cursor: Cursor | null) {
  return {
    subject: PROSPECT_SUBJECT,
    status: "READY_FOR_OUTREACH",
    outreachEmail: { not: null },
    runs: { none: {} },
    ...(cursor
      ? {
          OR: [
            { createdAt: { gt: new Date(cursor.createdAt) } },
            { createdAt: new Date(cursor.createdAt), id: { gt: cursor.id } },
          ],
        }
      : {}),
  };
}

export interface DripStatus {
  enabled: boolean;
  perDay: number;
  startedLastDay: number;
  /** Prospects not started yet. */
  waiting: number;
  automationName: string | null;
  automationActive: boolean;
  /** Prospects whose sequence was started but has not sent anything yet. */
  unsent: number;
}

export async function getDripStatus(): Promise<DripStatus> {
  const settings = await getOutreachSettings();
  const [startedLastDay, waiting, automation, unsent] = await Promise.all([
    prisma.automationRun.count({ where: { startedBy: DRIP_ACTOR, startedAt: { gte: new Date(Date.now() - DAY_MS) } } }),
    prisma.lead.count({ where: waitingWhere(await readCursor()) }),
    settings.dripAutomationId ? prisma.automation.findUnique({ where: { id: settings.dripAutomationId }, select: { name: true, status: true } }) : null,
    prisma.automationRun.count({ where: UNSENT_RUN }),
  ]);
  return {
    enabled: settings.dripPerDay > 0 && Boolean(settings.dripAutomationId),
    perDay: settings.dripPerDay,
    startedLastDay,
    waiting,
    automationName: automation?.name ?? null,
    automationActive: automation?.status === "ACTIVE",
    unsent,
  };
}

/** A prospect's sequence that was started (for example by an import) but has sent nothing yet. */
const UNSENT_RUN = { status: { in: ["ACTIVE", "PAUSED"] }, emailsSent: 0, lead: { subject: PROSPECT_SUBJECT } };

/**
 * Hands started-but-unsent prospects back to the drip: their waiting jobs and
 * sequence records are removed and they become ready for outreach again, so
 * the drip starts them a few a day. Nothing was sent to them, and anything
 * that refers to a removed sequence keeps its row (the reference becomes
 * empty). Returns how many prospects moved.
 */
export async function moveUnsentToDrip(): Promise<number> {
  let moved = 0;
  for (;;) {
    const runs = await prisma.automationRun.findMany({ where: UNSENT_RUN, select: { id: true, leadId: true }, take: 500 });
    if (runs.length === 0) break;
    const runIds = runs.map((r) => r.id);
    const leadIds = runs.map((r) => r.leadId);
    await prisma.$transaction([
      prisma.automationJob.deleteMany({ where: { type: "RUN_STEP", refId: { in: runIds } } }),
      prisma.followUp.deleteMany({ where: { runId: { in: runIds }, status: "SCHEDULED" } }),
      // emailsSent is checked again: a send that happened meanwhile keeps its sequence.
      prisma.automationRun.deleteMany({ where: { id: { in: runIds }, emailsSent: 0 } }),
      prisma.lead.updateMany({
        where: { id: { in: leadIds }, status: { in: ["EMAIL_QUEUED", "PAUSED", "IMPORTED", "NEW"] } },
        data: { status: "READY_FOR_OUTREACH", nextFollowUpAt: null },
      }),
    ]);
    moved += runs.length;
  }
  // Work through the list from its start again; prospects with a sequence are skipped.
  await prisma.siteSetting.deleteMany({ where: { key: CURSOR_KEY } });
  return moved;
}

/**
 * How many new prospects may start now. Exported for tests: the arithmetic
 * is the part that has to be right.
 */
export function dripRoom(input: { perDay: number; dailyLimit: number; startedLastDay: number; sentLastDay: number; sendsDueSoon: number }): number {
  const byQuota = input.perDay - input.startedLastDay;
  const byEmails = input.dailyLimit - input.sentLastDay - input.sendsDueSoon;
  return Math.max(0, Math.min(byQuota, byEmails));
}

/** One drip pass. Returns how many prospects were started. */
export async function runDrip(now = new Date()): Promise<{ started: number; note: string }> {
  const settings = await getOutreachSettings();
  if (settings.dripPerDay <= 0 || !settings.dripAutomationId) return { started: 0, note: "Drip is off" };

  // Starting prospects that cannot be emailed only builds a backlog.
  const provider = await getEmailProvider();
  if (!provider.isConfigured() || senderProblems(settings).length > 0) return { started: 0, note: "Sending is not set up" };
  if (!windowState(now, { start: settings.sendWindowStart, end: settings.sendWindowEnd }).open) {
    return { started: 0, note: "Outside sending hours" };
  }
  // Over SMTP a day holds what the usable mailboxes can send together.
  let capacity = settings.dailyLimit;
  if (provider.name === "smtp") {
    const usable = (await getSendingMailboxes()).filter((m) => !smtpPause(m.user, now.getTime()));
    if (usable.length === 0) return { started: 0, note: "No mailbox can send right now" };
    capacity = Math.min(capacity, usable.reduce((total, m) => total + m.dailyLimit, 0));
  }

  const dayAgo = new Date(now.getTime() - DAY_MS);
  const [startedLastDay, sentLastDay, sendsDueSoon] = await Promise.all([
    prisma.automationRun.count({ where: { startedBy: DRIP_ACTOR, startedAt: { gte: dayAgo } } }),
    prisma.emailMessage.count({ where: { sentAt: { gte: dayAgo } } }),
    // Every waiting step job of a running sequence: most of them are a follow-up email.
    prisma.automationJob.count({ where: { type: "RUN_STEP", status: { in: ["PENDING", "RUNNING"] }, runAt: { lt: new Date(now.getTime() + DAY_MS) } } }),
  ]);
  let room = dripRoom({ perDay: settings.dripPerDay, dailyLimit: capacity, startedLastDay, sentLastDay, sendsDueSoon });
  if (room === 0) return { started: 0, note: "No room today" };

  let cursor = await readCursor();
  let started = 0;
  while (room > 0) {
    const batch = await prisma.lead.findMany({
      where: waitingWhere(cursor),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(50, room * 2),
      select: { id: true, createdAt: true },
    });
    if (batch.length === 0) break;
    for (const lead of batch) {
      const result = await enrollLead({ leadId: lead.id, automationId: settings.dripAutomationId, actor: DRIP_ACTOR, now });
      if (!result.ok && AUTOMATION_BLOCKS.includes(result.reason)) {
        return { started, note: result.message };
      }
      cursor = { createdAt: lead.createdAt.toISOString(), id: lead.id };
      await writeCursor(cursor);
      if (result.ok) {
        started++;
        room--;
        if (room === 0) break;
      }
    }
  }
  return { started, note: started ? `Started ${started} new prospect${started === 1 ? "" : "s"}` : "Nobody left to start" };
}

/** Called by every scheduler pass; drips at most every few minutes. */
export async function runDripIfDue(now = new Date()): Promise<{ started: number; note: string } | null> {
  if ((state.__bitsolDripNextAt ?? 0) > now.getTime()) return null;
  state.__bitsolDripNextAt = now.getTime() + PASS_EVERY_MS;
  return runDrip(now);
}

/** Settings changed: drip on the next pass. */
export function resetDripSchedule(): void {
  state.__bitsolDripNextAt = 0;
}
