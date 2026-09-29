import { Resend } from "resend";

/**
 * The boundary between the automation engine and whoever delivers the mail.
 * The engine only knows this interface; Resend (already used for the site's
 * lead notifications) is the production implementation.
 */

export interface OutboundEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Sent with the request so a retry cannot deliver the same email twice. */
  idempotencyKey: string;
  tags?: Record<string, string>;
}

export type SendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; /** Worth trying again later (rate limit, outage). */ retryable: boolean };

export interface EmailProvider {
  name: string;
  /** False in test mode: messages are recorded but nothing leaves the server. */
  delivers: boolean;
  isConfigured(): boolean;
  /** What to tell the admin when it is not configured. */
  setupHint: string;
  send(message: OutboundEmail): Promise<SendResult>;
}

function hasResendKey(): boolean {
  const key = process.env.RESEND_API_KEY;
  return Boolean(key) && key !== "re_dummy" && !/^re_x+$/i.test(key as string);
}

const resendProvider: EmailProvider = {
  name: "resend",
  delivers: true,
  isConfigured: hasResendKey,
  setupHint: "Set RESEND_API_KEY on the server and verify the sending domain in Resend.",
  async send(message) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      const { data, error } = await resend.emails.send(
        {
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(message.replyTo ? { replyTo: message.replyTo } : {}),
          ...(message.headers ? { headers: message.headers } : {}),
          ...(message.tags
            ? { tags: Object.entries(message.tags).map(([name, value]) => ({ name, value: value.replace(/[^A-Za-z0-9_-]/g, "_") })) }
            : {}),
        },
        { idempotencyKey: message.idempotencyKey }
      );
      if (error || !data) {
        const status = error?.statusCode ?? null;
        const retryable = status === null || status === 429 || status >= 500;
        return { ok: false, error: error?.message ?? "Resend returned no message id", retryable };
      }
      return { ok: true, id: data.id };
    } catch (err) {
      // A thrown error is a network problem, not a rejected email.
      return { ok: false, error: err instanceof Error ? err.message : "Could not reach Resend", retryable: true };
    }
  },
};

/**
 * OUTREACH_EMAIL_MODE=test. For rehearsing a sequence end to end: messages,
 * timelines and follow-ups are recorded exactly as in production, but no
 * email is delivered. The admin shows a banner while this is on.
 */
const testProvider: EmailProvider = {
  name: "test",
  delivers: false,
  isConfigured: () => true,
  setupHint: "",
  async send(message) {
    return { ok: true, id: `test_${message.idempotencyKey}` };
  },
};

export function isTestMode(): boolean {
  return process.env.OUTREACH_EMAIL_MODE === "test";
}

export function getEmailProvider(): EmailProvider {
  return isTestMode() ? testProvider : resendProvider;
}
