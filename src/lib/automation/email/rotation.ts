import { prisma } from "@/lib/prisma";
import { addressOf, type MailboxCredentials } from "./mailbox";

/**
 * When outreach may go out, and from which mailbox.
 *
 *  - Sending hours: emails only leave inside a daily window in Pakistan time
 *    (Asia/Karachi is UTC+5 all year, no daylight saving).
 *  - Spreading: each mailbox's daily limit is spread evenly over the window,
 *    e.g. 100 emails over 10:00–22:00 is one every 7.2 minutes per mailbox,
 *    rather than a burst at the start of the day.
 *  - Rotation: a lead's first email goes from the least-used mailbox with
 *    room; every later email to that lead comes from the same mailbox, so the
 *    conversation stays in one inbox.
 *
 * The choice itself (`pickMailbox`) is pure, so it is tested without a database.
 */

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const PKT_OFFSET_MS = 5 * HOUR_MS;

export interface SendWindow {
  /** Whole hours in Pakistan time, 0–23. */
  start: number;
  /** Whole hours in Pakistan time, 1–24. Not after `start`: always open. */
  end: number;
}

export interface WindowState {
  open: boolean;
  /** Now when open; otherwise the next opening. */
  opensAt: Date;
  /** Length of the window in minutes. */
  minutes: number;
}

export function windowState(now: Date, window: SendWindow): WindowState {
  const start = Math.min(23, Math.max(0, Math.floor(window.start)));
  const end = Math.min(24, Math.max(1, Math.floor(window.end)));
  if (end <= start) return { open: true, opensAt: now, minutes: 1440 };

  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  const hour = local.getUTCHours() + local.getUTCMinutes() / 60 + local.getUTCSeconds() / 3600;
  const minutes = (end - start) * 60;
  if (hour >= start && hour < end) return { open: true, opensAt: now, minutes };

  // Midnight Pakistan time of the local day, as an instant.
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - PKT_OFFSET_MS;
  const opensAt = midnight + start * HOUR_MS + (hour >= end ? DAY_MS : 0);
  return { open: false, opensAt: new Date(opensAt), minutes };
}

/** "10:00–22:00" */
export function describeWindow(window: SendWindow): string {
  const hh = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;
  return window.end <= window.start ? "any time" : `${hh(window.start)}–${hh(window.end)}`;
}

/** Spacing between two sends from one mailbox, or 0 to send as fast as allowed. */
export function spacingMs(windowMinutes: number, dailyLimit: number, spread: boolean): number {
  if (!spread || dailyLimit <= 0) return 0;
  return Math.floor((windowMinutes * 60_000) / dailyLimit);
}

export interface MailboxUsage {
  /** Sent in the last 24 hours. */
  sent: number;
  lastSentAt: number | null;
  oldestSentAt: number | null;
}

export type MailboxChoice =
  | { kind: "send"; mailbox: MailboxCredentials }
  /** `lead`: only this lead must wait (its own mailbox is busy); `all`: nothing can be sent before `until`. */
  | { kind: "wait"; until: Date; note: string; scope: "lead" | "all" };

const EMPTY_USAGE: MailboxUsage = { sent: 0, lastSentAt: null, oldestSentAt: null };

/** When a mailbox can next send: now, after its spacing, or once its oldest send of the day ages out. */
function freeAt(mailbox: MailboxCredentials, usage: MailboxUsage, now: number, gapMs: number): number {
  if (usage.sent >= mailbox.dailyLimit) return (usage.oldestSentAt ?? now) + DAY_MS;
  if (gapMs > 0 && usage.lastSentAt !== null && now - usage.lastSentAt < gapMs) return usage.lastSentAt + gapMs;
  return now;
}

export function pickMailbox(input: {
  /** Mailboxes that may send: enabled, with a password, not paused. */
  mailboxes: MailboxCredentials[];
  usage: Map<string, MailboxUsage>;
  /** The address that sent this lead's earlier emails, if any. */
  sticky: string | null;
  now: Date;
  /** Spacing for a mailbox (see spacingMs). */
  gapFor: (mailbox: MailboxCredentials) => number;
}): MailboxChoice {
  const now = input.now.getTime();
  if (input.mailboxes.length === 0) {
    return { kind: "wait", until: new Date(now + HOUR_MS), note: "No sending mailbox is turned on, has a password and is free of errors", scope: "all" };
  }
  const when = (m: MailboxCredentials) => freeAt(m, input.usage.get(m.user) ?? EMPTY_USAGE, now, input.gapFor(m));

  const own = input.sticky ? input.mailboxes.find((m) => m.user === input.sticky) : undefined;
  if (own) {
    const at = when(own);
    if (at <= now) return { kind: "send", mailbox: own };
    const full = (input.usage.get(own.user)?.sent ?? 0) >= own.dailyLimit;
    return { kind: "wait", until: new Date(at), note: `${own.user} ${full ? "has reached its daily limit" : "is spacing its emails"}; this lead's emails stay on it`, scope: "lead" };
  }

  // A new lead (or its mailbox was turned off): the least-used mailbox with room.
  const ready = input.mailboxes
    .filter((m) => when(m) <= now)
    .sort((a, b) => {
      const ua = input.usage.get(a.user) ?? EMPTY_USAGE;
      const ub = input.usage.get(b.user) ?? EMPTY_USAGE;
      return ua.sent / a.dailyLimit - ub.sent / b.dailyLimit || (ua.lastSentAt ?? 0) - (ub.lastSentAt ?? 0);
    });
  if (ready.length > 0) return { kind: "send", mailbox: ready[0] };
  const next = Math.min(...input.mailboxes.map(when));
  return { kind: "wait", until: new Date(next), note: "Every mailbox is at its daily limit or spacing its emails", scope: "all" };
}

/** Per-address sends in the last 24 hours. */
export async function mailboxUsage(now: Date): Promise<Map<string, MailboxUsage>> {
  const rows = await prisma.emailMessage.findMany({
    where: { sentAt: { gte: new Date(now.getTime() - DAY_MS) } },
    select: { fromEmail: true, sentAt: true },
  });
  const usage = new Map<string, MailboxUsage>();
  for (const row of rows) {
    if (!row.sentAt) continue;
    const address = addressOf(row.fromEmail);
    const at = row.sentAt.getTime();
    const u = usage.get(address) ?? { sent: 0, lastSentAt: null, oldestSentAt: null };
    u.sent++;
    u.lastSentAt = Math.max(u.lastSentAt ?? at, at);
    u.oldestSentAt = Math.min(u.oldestSentAt ?? at, at);
    usage.set(address, u);
  }
  return usage;
}

/** The mailbox that sent this run's earlier emails. */
export async function stickyAddress(runId: string): Promise<string | null> {
  const previous = await prisma.emailMessage.findFirst({
    where: { runId, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { fromEmail: true },
  });
  return previous ? addressOf(previous.fromEmail) || null : null;
}
