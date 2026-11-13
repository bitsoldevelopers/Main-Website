import { createTransport } from "nodemailer";
import type { EmailProvider, SendResult } from "./provider";
import type { MailboxCredentials } from "./mailbox";

/**
 * Outreach over SMTP from a real mailbox (Hostinger Business email). One
 * connection per email: at 100 a day, a pool would only hold idle sockets
 * the server closes anyway.
 *
 * Every email gets a Message-ID the site chooses, `<bitsol-outreach-…@domain>`.
 * It is stored as the provider message id, so a bounce that quotes it, or a
 * reply that points at it (In-Reply-To), leads straight back to the email.
 */

/** SMTP failures, sorted by what the engine should do about them. */
export type SmtpFailure =
  /** The recipient's address was refused: treat as a hard bounce. */
  | "RECIPIENT"
  /** Worth trying the same email again later (4xx, a dropped connection). */
  | "TEMPORARY"
  /** Login, server or sender problem: every email would fail the same way. */
  | "SETUP";

interface SmtpErrorShape {
  code?: unknown;
  responseCode?: unknown;
  command?: unknown;
  response?: unknown;
  message?: unknown;
}

const CONNECTION_CODES = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS", "ETLS", "EPROTOCOL", "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH"]);

export function classifySmtpError(err: unknown): SmtpFailure {
  const e = (typeof err === "object" && err !== null ? err : {}) as SmtpErrorShape;
  const code = typeof e.code === "string" ? e.code : "";
  const status = typeof e.responseCode === "number" ? e.responseCode : 0;
  const command = typeof e.command === "string" ? e.command.toUpperCase() : "";

  if (code === "EAUTH" || command.startsWith("AUTH")) return "SETUP";
  // Refused by Nodemailer itself before anything was sent ("Invalid recipient").
  if (command === "API") return typeof e.message === "string" && /recipient/i.test(e.message) ? "RECIPIENT" : "SETUP";
  if (status >= 400 && status < 500) return "TEMPORARY";
  if (status >= 500) {
    // Only RCPT TO is about the recipient. MAIL FROM and DATA refusals are
    // about the sender or the content (sender not owned, quota, spam filter),
    // even though Nodemailer reports a MAIL FROM refusal as EENVELOPE too.
    if (command === "RCPT TO" || (code === "EENVELOPE" && !command)) return "RECIPIENT";
    return "SETUP";
  }
  if (CONNECTION_CODES.has(code)) return "SETUP";
  return "TEMPORARY";
}

export function describeSmtpError(err: unknown): string {
  const e = (typeof err === "object" && err !== null ? err : {}) as SmtpErrorShape;
  const response = typeof e.response === "string" ? e.response.trim() : "";
  const message = typeof e.message === "string" ? e.message : "SMTP error";
  if (e.code === "EAUTH") return `The mail server refused the login: check the mailbox address and password. (${response || message})`;
  return response && !message.includes(response) ? `${message}: ${response}` : message;
}

/** `<key@domain>`, from the sender's domain. */
export function buildMessageId(key: string, fromAddress: string): string {
  const domain = (fromAddress.match(/@([^>\s]+)>?\s*$/)?.[1] ?? "bitsolmarketing.com").toLowerCase();
  return `<${key.replace(/[^A-Za-z0-9._-]/g, "-")}@${domain}>`;
}

/** Message-IDs are stored without the angle brackets. */
export function bareMessageId(id: string): string {
  return id.trim().replace(/^<|>$/g, "");
}

// ─── Pause after a setup failure ────────────────────────────────────────────
//
// A wrong password fails every email the same way, and a mail server that sees
// a burst of failed logins may lock the mailbox. After one setup failure no
// email is tried for a while; saving the mailbox settings lifts the pause.

const SETUP_PAUSE_MS = 15 * 60_000;

const pause = globalThis as unknown as { __bitsolSmtpPause?: { until: number; error: string } };

export function pauseSmtp(error: string, ms = SETUP_PAUSE_MS): Date {
  const until = Date.now() + ms;
  pause.__bitsolSmtpPause = { until, error };
  return new Date(until);
}

export function smtpPause(now = Date.now()): { until: Date; error: string } | null {
  const current = pause.__bitsolSmtpPause;
  if (!current || current.until <= now) return null;
  return { until: new Date(current.until), error: current.error };
}

export function clearSmtpPause(): void {
  pause.__bitsolSmtpPause = undefined;
}

function transportFor(creds: MailboxCredentials) {
  return createTransport({
    host: creds.smtpHost,
    port: creds.smtpPort,
    // 465 is TLS from the first byte; 587 upgrades with STARTTLS, which is then required.
    secure: creds.smtpPort === 465,
    requireTLS: creds.smtpPort !== 465,
    auth: { user: creds.user, pass: creds.password },
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

/** Logs in to the SMTP server without sending anything. */
export async function verifySmtp(creds: MailboxCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
  const transport = transportFor(creds);
  try {
    await transport.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeSmtpError(err) };
  } finally {
    transport.close();
  }
}

export function createSmtpProvider(creds: MailboxCredentials | null, problems: string[]): EmailProvider {
  return {
    name: "smtp",
    delivers: true,
    isConfigured: () => creds !== null && problems.length === 0,
    setupHint: problems[0] ?? "Enter the mailbox address and password under Lead Automation → Settings → Sending mailbox.",
    async send(message): Promise<SendResult> {
      if (!creds) return { ok: false, error: "The mailbox is not set up", retryable: false, setup: true };
      const messageId = buildMessageId(message.idempotencyKey, message.from);
      const transport = transportFor(creds);
      try {
        const info = await transport.sendMail({
          from: message.from,
          to: message.to,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          subject: message.subject,
          html: message.html,
          text: message.text,
          messageId,
          ...(message.headers ? { headers: message.headers } : {}),
        });
        const rejected = (info.rejected ?? []).map(String);
        if (rejected.length > 0) {
          return { ok: false, error: `The mail server refused ${rejected.join(", ")}: ${info.response ?? ""}`.trim(), retryable: false, bounced: true };
        }
        return { ok: true, id: bareMessageId(info.messageId || messageId) };
      } catch (err) {
        const failure = classifySmtpError(err);
        const error = describeSmtpError(err);
        if (failure === "RECIPIENT") return { ok: false, error, retryable: false, bounced: true };
        if (failure === "SETUP") return { ok: false, error, retryable: false, setup: true };
        return { ok: false, error, retryable: true };
      } finally {
        transport.close();
      }
    },
  };
}
