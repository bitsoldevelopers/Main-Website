import { ImapFlow } from "imapflow";
import { prisma } from "@/lib/prisma";
import { recordEmailEvent } from "./events";
import { classifyMail } from "./inbox-parse";
import { getMailboxSettings, getWatchedMailboxes, type MailboxCredentials } from "./mailbox";
import { getOutreachSettings } from "../settings";
import { errorText } from "./smtp";

/**
 * Reads the outreach mailbox's INBOX over IMAP for replies and bounces: the
 * SMTP counterpart of the Resend webhook. A reply stops the lead's sequence
 * (the engine checks before every send); a bounce suppresses the address.
 *
 * Runs from the scheduler every few minutes. Messages are only peeked at:
 * nothing is marked read, moved or deleted, so the mailbox looks the same in
 * webmail. Where it got to (UIDVALIDITY + last UID) is kept in SiteSetting,
 * and every event is stored once, so reading a message twice changes nothing.
 */

const REPORT_KEY = "outreach.inbox.lastCheck";

/** Where reading got to in one mailbox. The first mailbox keeps the keys of the single-mailbox version. */
function stateKeys(mailboxId: string): { validity: string; lastUid: string } {
  return mailboxId === "primary"
    ? { validity: "outreach.inbox.uidValidity", lastUid: "outreach.inbox.lastUid" }
    : { validity: `outreach.inbox.${mailboxId}.uidValidity`, lastUid: `outreach.inbox.${mailboxId}.lastUid` };
}

const CHECK_EVERY_MS = 5 * 60_000;
/** While replies are answered automatically: a reply should be answered within minutes. */
const FAST_CHECK_MS = 2 * 60_000;
/** After a failure (wrong password…): repeated failed logins can lock a mailbox. */
const RETRY_AFTER_ERROR_MS = 60 * 60_000;
const MAX_PER_PASS = 200;
/** Headers plus the start of the body: enough for a reply's headers and a bounce report. */
const SOURCE_BYTES = 96 * 1024;
const FIRST_LOOKBACK_DAYS = 14;
const PASS_TIMEOUT_MS = 60_000;

export interface InboxReport {
  at: string;
  ok: boolean;
  error?: string;
  /** Messages looked at in this pass. */
  scanned: number;
  replies: number;
  bounces: number;
  autoReplies: number;
  /** One line per mailbox read in this pass. */
  mailboxes?: { user: string; ok: boolean; error?: string; scanned: number; replies: number; bounces: number }[];
}

const state = globalThis as unknown as {
  __bitsolInboxNextAt?: number;
  __bitsolInboxRunning?: Promise<InboxReport> | null;
  /** A mailbox whose last check failed is left alone until then; the others are read as usual. */
  __bitsolInboxRetry?: Record<string, { until: number; error: string }>;
};

function client(creds: MailboxCredentials): ImapFlow {
  const imap = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: creds.imapPort === 993,
    auth: { user: creds.user, pass: creds.password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  // Without a listener a socket error would be an uncaught exception.
  imap.on("error", (err: unknown) => {
    console.warn("[automation] IMAP:", err instanceof Error ? err.message : err);
  });
  return imap;
}

export function describeImapError(err: unknown): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as { authenticationFailed?: unknown; responseText?: unknown; message?: unknown; code?: unknown };
  if (e.authenticationFailed) return "The mail server refused the IMAP login: check the mailbox address and password.";
  const text = typeof e.responseText === "string" && e.responseText ? e.responseText : errorText(err, "Could not reach the mail server");
  return typeof e.code === "string" && !text.includes(e.code) ? `${text} (${e.code})` : text;
}

/** Logs in over IMAP and opens INBOX, nothing else. */
export async function verifyImap(creds: MailboxCredentials): Promise<{ ok: true; messages: number } | { ok: false; error: string }> {
  const imap = client(creds);
  try {
    await imap.connect();
    const status = await imap.status("INBOX", { messages: true });
    return { ok: true, messages: status ? (status.messages ?? 0) : 0 };
  } catch (err) {
    return { ok: false, error: describeImapError(err) };
  } finally {
    await imap.logout().catch(() => imap.close());
  }
}

async function readState(mailboxId: string): Promise<{ validity: string; lastUid: number }> {
  const keys = stateKeys(mailboxId);
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [keys.validity, keys.lastUid] } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const lastUid = Number.parseInt(map.get(keys.lastUid) ?? "", 10);
  return { validity: map.get(keys.validity) ?? "", lastUid: Number.isFinite(lastUid) ? lastUid : 0 };
}

async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function lastInboxReport(): Promise<InboxReport | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: REPORT_KEY } });
  if (!row) return null;
  try {
    return JSON.parse(row.value) as InboxReport;
  } catch {
    return null;
  }
}

/** Where the first pass starts: the first email sent from the mailbox, at most two weeks back. */
async function firstPassSince(): Promise<Date> {
  const floor = new Date(Date.now() - FIRST_LOOKBACK_DAYS * 86_400_000);
  const first = await prisma.emailMessage.findFirst({
    where: { provider: "smtp", sentAt: { gte: floor } },
    orderBy: { sentAt: "asc" },
    select: { sentAt: true },
  });
  // A day of margin: IMAP SINCE compares dates, not times.
  return first?.sentAt ? new Date(first.sentAt.getTime() - 86_400_000) : floor;
}

/** The message a bounce is about: the Message-ID it quotes, else the address it names. */
async function bouncedMessage(outreachIds: string[], recipients: string[]) {
  if (outreachIds.length > 0) {
    const byId = await prisma.emailMessage.findFirst({
      where: { providerMessageId: { in: outreachIds } },
      select: { providerMessageId: true },
    });
    if (byId?.providerMessageId) return byId.providerMessageId;
  }
  if (recipients.length > 0) {
    const byAddress = await prisma.emailMessage.findFirst({
      where: { toEmail: { in: recipients }, provider: "smtp", sentAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      orderBy: { sentAt: "desc" },
      select: { providerMessageId: true },
    });
    if (byAddress?.providerMessageId) return byAddress.providerMessageId;
  }
  return null;
}

export type InboundOutcome = "REPLY" | "BOUNCE" | "AUTO_REPLY" | "IGNORED";

/**
 * What one message in the inbox means for the CRM, recorded once. `eventKey`
 * identifies the message when it has no Message-ID of its own.
 */
export async function handleInboundMail(
  raw: string,
  meta: {
    ownAddress: string | string[];
    eventKey: string;
    receivedAt: Date;
    /** The mailbox it arrived in. */
    mailbox?: string;
    /** Set while replies are answered with AI: read the reply before stopping the sequence. */
    triage?: { delayMinutes: number } | null;
  }
): Promise<InboundOutcome> {
  const mail = classifyMail(raw);
  // Mail between our own mailboxes (tests, warm-up) is never a lead's reply.
  const own = (Array.isArray(meta.ownAddress) ? meta.ownAddress : [meta.ownAddress]).map((a) => a.toLowerCase());
  if (own.includes(mail.from)) return "IGNORED";
  if (mail.kind === "AUTO_REPLY") return "AUTO_REPLY";
  const providerEventId = `imap:${mail.messageId || meta.eventKey}`;

  if (mail.kind === "REPLY") {
    const result = await recordEmailEvent({
      type: "RECEIVED",
      providerEventId,
      from: mail.from,
      subject: mail.subject,
      inReplyTo: mail.outreachIds,
      occurredAt: meta.receivedAt,
      payload: {
        source: "imap",
        from: mail.from,
        subject: mail.subject.slice(0, 300),
        text: mail.text ?? "",
        ...(meta.mailbox ? { mailbox: meta.mailbox } : {}),
        ...(mail.thread ? { thread: mail.thread } : {}),
      },
      ...(meta.triage ? { triage: meta.triage } : {}),
    });
    return result === "RECORDED" ? "REPLY" : "IGNORED";
  }

  const bounce = mail.bounce;
  const providerMessageId = bounce ? await bouncedMessage(mail.outreachIds, bounce.recipients) : null;
  if (!bounce || !providerMessageId) return "IGNORED";
  const result = await recordEmailEvent({
    type: "BOUNCED",
    providerEventId,
    providerMessageId,
    permanent: bounce.permanent,
    detail: bounce.detail,
    occurredAt: meta.receivedAt,
    payload: { source: "imap", recipients: bounce.recipients, permanent: bounce.permanent, detail: bounce.detail },
  });
  return result === "RECORDED" && bounce.permanent ? "BOUNCE" : "IGNORED";
}

async function pass(creds: MailboxCredentials, ownAddresses: string[], triage: { delayMinutes: number } | null): Promise<InboxReport> {
  const report: InboxReport = { at: new Date().toISOString(), ok: true, scanned: 0, replies: 0, bounces: 0, autoReplies: 0 };
  const imap = client(creds);
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock("INBOX", { readOnly: true });
    try {
      const mailbox = imap.mailbox;
      if (!mailbox) throw new Error("Could not open INBOX");
      const validity = String(mailbox.uidValidity);
      const saved = await readState(creds.id);

      let uids: number[];
      if (saved.validity === validity && saved.lastUid > 0) {
        if (mailbox.uidNext <= saved.lastUid + 1) uids = [];
        else uids = ((await imap.search({ uid: `${saved.lastUid + 1}:*` }, { uid: true })) || []).filter((uid) => uid > saved.lastUid);
      } else {
        // First pass, or the server renumbered the mailbox: start from a date.
        uids = (await imap.search({ since: await firstPassSince() }, { uid: true })) || [];
      }
      uids.sort((a, b) => a - b);
      const batch = uids.slice(0, MAX_PER_PASS);

      let highest = saved.validity === validity ? saved.lastUid : 0;
      if (batch.length > 0) {
        for await (const msg of imap.fetch(batch, { uid: true, internalDate: true, source: { maxLength: SOURCE_BYTES } }, { uid: true })) {
          report.scanned++;
          highest = Math.max(highest, msg.uid);
          if (!msg.source) continue;
          const outcome = await handleInboundMail(msg.source.toString("utf8"), {
            ownAddress: ownAddresses,
            eventKey: `${validity}:${msg.uid}`,
            receivedAt: msg.internalDate ? new Date(msg.internalDate) : new Date(),
            mailbox: creds.user,
            triage,
          });
          if (outcome === "REPLY") report.replies++;
          else if (outcome === "BOUNCE") report.bounces++;
          else if (outcome === "AUTO_REPLY") report.autoReplies++;
        }
      } else if (saved.validity !== validity) {
        // Nothing since the start date: remember where the mailbox is now.
        highest = Math.max(0, mailbox.uidNext - 1);
      }

      const keys = stateKeys(creds.id);
      await writeSetting(keys.validity, validity);
      await writeSetting(keys.lastUid, String(highest));
    } finally {
      lock.release();
    }
  } catch (err) {
    report.ok = false;
    report.error = describeImapError(err);
  } finally {
    await imap.logout().catch(() => imap.close());
  }
  return report;
}

function withTimeout(promise: Promise<InboxReport>): Promise<InboxReport> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ at: new Date().toISOString(), ok: false, error: "The inbox check took too long and was stopped", scanned: 0, replies: 0, bounces: 0, autoReplies: 0 }),
      PASS_TIMEOUT_MS
    );
    timer.unref?.();
    promise.then(
      (report) => {
        clearTimeout(timer);
        resolve(report);
      },
      (err) => {
        clearTimeout(timer);
        resolve({ at: new Date().toISOString(), ok: false, error: describeImapError(err), scanned: 0, replies: 0, bounces: 0, autoReplies: 0 });
      }
    );
  });
}

/**
 * One pass over the inbox now, whatever the schedule. Returns null when the
 * mailbox is not the sender or its inbox is not watched.
 */
export async function checkInboxNow(): Promise<InboxReport | null> {
  if (state.__bitsolInboxRunning) return state.__bitsolInboxRunning;
  const settings = await getMailboxSettings();
  if (settings.transport !== "smtp") return null;
  const watched = await getWatchedMailboxes();
  if (watched.length === 0) return null;
  const ownAddresses = settings.mailboxes.map((m) => m.user);
  const outreach = await getOutreachSettings();
  const triage = outreach.autoReplyMode === "off" ? null : { delayMinutes: outreach.autoReplyDelay };
  const every = triage ? FAST_CHECK_MS : CHECK_EVERY_MS;

  const run = (async (): Promise<InboxReport> => {
    // One mailbox after another: a few seconds each, and no burst of logins.
    const reports: { user: string; report: InboxReport }[] = [];
    const retry = (state.__bitsolInboxRetry ??= {});
    for (const creds of watched) {
      const waiting = retry[creds.user];
      if (waiting && waiting.until > Date.now()) {
        const at = new Date(waiting.until + 5 * 3_600_000).toISOString().slice(11, 16);
        reports.push({ user: creds.user, report: { at: new Date().toISOString(), ok: false, error: `${waiting.error} (tried again at ${at} Pakistan time)`, scanned: 0, replies: 0, bounces: 0, autoReplies: 0 } });
        continue;
      }
      const report = await withTimeout(pass(creds, ownAddresses, triage));
      // Repeated failed logins can lock a mailbox: a failing one waits, the others do not.
      if (report.ok) delete retry[creds.user];
      else retry[creds.user] = { until: Date.now() + RETRY_AFTER_ERROR_MS, error: report.error ?? "failed" };
      reports.push({ user: creds.user, report });
    }
    const failed = reports.filter((r) => !r.report.ok);
    const total: InboxReport = {
      at: new Date().toISOString(),
      ok: failed.length === 0,
      ...(failed.length ? { error: failed.map((r) => `${r.user}: ${r.report.error}`).join("; ") } : {}),
      scanned: reports.reduce((n, r) => n + r.report.scanned, 0),
      replies: reports.reduce((n, r) => n + r.report.replies, 0),
      bounces: reports.reduce((n, r) => n + r.report.bounces, 0),
      autoReplies: reports.reduce((n, r) => n + r.report.autoReplies, 0),
      mailboxes: reports.map((r) => ({
        user: r.user,
        ok: r.report.ok,
        ...(r.report.error ? { error: r.report.error } : {}),
        scanned: r.report.scanned,
        replies: r.report.replies,
        bounces: r.report.bounces,
      })),
    };
    state.__bitsolInboxNextAt = Date.now() + every;
    await writeSetting(REPORT_KEY, JSON.stringify(total)).catch(() => undefined);
    return total;
  })();
  state.__bitsolInboxRunning = run;
  try {
    return await run;
  } finally {
    state.__bitsolInboxRunning = null;
  }
}

/** Called by every scheduler pass; reads the inbox at most every few minutes. */
export async function checkInboxIfDue(): Promise<InboxReport | null> {
  if ((state.__bitsolInboxNextAt ?? 0) > Date.now()) return null;
  // Set before the pass so a slow or failing check is not retried every minute.
  state.__bitsolInboxNextAt = Date.now() + FAST_CHECK_MS;
  return checkInboxNow();
}

/** Saving new mailbox details: check again on the next pass, the failing ones too. */
export function resetInboxSchedule(): void {
  state.__bitsolInboxNextAt = 0;
  state.__bitsolInboxRetry = {};
}
