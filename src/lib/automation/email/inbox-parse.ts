import { extractReplyText, looksLikeAutoAck } from "./mime";

/**
 * Reads one message from the outreach mailbox and decides what it is: a
 * person replying, an automatic reply (out of office), or a bounce. Pure:
 * it works on the raw source, so it is tested without a mail server.
 *
 * Outreach emails carry Message-IDs of the form `<bitsol-outreach-…@domain>`
 * (see smtp.ts). A bounce quotes the original headers, and a reply names the
 * original in In-Reply-To / References, so either leads back to the email.
 */

export type InboundKind = "REPLY" | "AUTO_REPLY" | "BOUNCE";

export interface ClassifiedMail {
  kind: InboundKind;
  /** The sender, lower case. */
  from: string;
  subject: string;
  /** The message's own Message-ID, without brackets. */
  messageId: string;
  /** Outreach Message-IDs this message refers to or quotes, without brackets. */
  outreachIds: string[];
  /** REPLY and AUTO_REPLY: what the sender wrote, without the quoted email. */
  text?: string;
  /** REPLY and AUTO_REPLY: the Message-ID and References headers as sent, for answering in the same thread. */
  thread?: { messageId: string; references: string };
  /** BOUNCE only. */
  bounce?: {
    /** Addresses the report says could not be delivered to. */
    recipients: string[];
    /** False for a delay or a temporary failure (mailbox full, try later). */
    permanent: boolean;
    detail: string;
  };
}

/** Header names (lower case) → values, unfolded. Only the top-level header block. */
export function parseHeaders(raw: string): Map<string, string[]> {
  const end = raw.search(/\r?\n\r?\n/);
  const block = end === -1 ? raw : raw.slice(0, end);
  const unfolded = block.replace(/\r?\n[ \t]+/g, " ");
  const headers = new Map<string, string[]>();
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers.set(name, [...(headers.get(name) ?? []), value]);
  }
  return headers;
}

function first(headers: Map<string, string[]>, name: string): string {
  return headers.get(name)?.[0] ?? "";
}

/** RFC 2047 encoded words (`=?UTF-8?B?…?=`), as non-ASCII subjects arrive. */
export function decodeWords(value: string): string {
  return value
    .replace(/(\?=)\s+(=\?)/g, "$1$2")
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_match, charset: string, encoding: string, text: string) => {
      const bytes =
        encoding.toUpperCase() === "B"
          ? Buffer.from(text, "base64")
          : Buffer.from(text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_x, hex: string) => String.fromCharCode(Number.parseInt(hex, 16))), "latin1");
      try {
        return new TextDecoder(charset.toLowerCase().replace(/\*.*$/, "")).decode(bytes);
      } catch {
        return bytes.toString("utf8");
      }
    });
}

/** The address in `Name <a@b>` or a bare `a@b`. */
export function addressOf(value: string): string {
  const bracketed = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (bracketed) return bracketed[1].toLowerCase();
  const bare = value.match(/[^\s<>"',;:]+@[^\s<>"',;:]+/);
  return bare ? bare[0].toLowerCase() : "";
}

const OUTREACH_ID = /<(bitsol-outreach-[A-Za-z0-9._-]+@[A-Za-z0-9.-]+)>/gi;

function outreachIdsIn(text: string): string[] {
  return [...new Set([...text.matchAll(OUTREACH_ID)].map((m) => m[1].toLowerCase()))];
}

const BOUNCE_SENDER = /^(mailer-daemon|postmaster|mail-daemon|mailerdaemon)@/i;
const BOUNCE_SUBJECT = /(undeliver|delivery status notification|delivery (has )?failed|delivery failure|failure notice|returned mail|mail delivery (failed|system)|could not be delivered|non[- ]?delivery)/i;
const DELAY_SUBJECT = /(delayed|delay|warning:.*not.*delivered|will retry)/i;
/** Senders nobody reads: an answer to them goes nowhere. */
const MACHINE_SENDER = /^(no-?reply|do-?not-?reply|donotreply|noreply-[a-z0-9-]+|notifications?|auto-?(reply|responder|mailer))@/i;
const AUTO_SUBJECT = /^\s*(auto(matic)?[ -]?(reply|response)|out of (the )?office|ooo\b|away from|on (annual )?leave|vacation|abwesenheit|absence)/i;

function isAutomatic(headers: Map<string, string[]>, subject: string): boolean {
  const autoSubmitted = first(headers, "auto-submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (headers.has("x-autoreply") || headers.has("x-autorespond") || headers.has("x-autoresponder")) return true;
  const suppress = first(headers, "x-auto-response-suppress").toLowerCase();
  if (suppress.includes("oof") || suppress.includes("all")) return true;
  const precedence = first(headers, "precedence").toLowerCase();
  if (precedence === "auto_reply" || precedence === "bulk" || precedence === "junk" || precedence === "list") return true;
  if (headers.has("list-id") || headers.has("list-unsubscribe")) return true;
  return AUTO_SUBJECT.test(subject);
}

function parseBounce(raw: string, subject: string): NonNullable<ClassifiedMail["bounce"]> {
  const recipients = new Set<string>();
  for (const match of raw.matchAll(/^(?:Final|Original)-Recipient:\s*rfc822;\s*<?([^\s<>;]+@[^\s<>;]+)>?/gim)) {
    recipients.add(match[1].toLowerCase());
  }
  // Non-standard bounces (qmail "failure notice"): `<a@b>:` at the start of a line.
  if (recipients.size === 0) {
    for (const match of raw.matchAll(/^<([^\s<>]+@[^\s<>]+)>:\s*$/gm)) recipients.add(match[1].toLowerCase());
  }

  const actions = [...raw.matchAll(/^Action:\s*([a-z]+)/gim)].map((m) => m[1].toLowerCase());
  const statuses = [...raw.matchAll(/^Status:\s*([245])\.\d{1,3}\.\d{1,3}/gim)].map((m) => m[1]);
  const diagnostic = raw.match(/^Diagnostic-Code:\s*(?:[a-z]+;\s*)?(.+(?:\r?\n[ \t].+)*)/im)?.[1].replace(/\s+/g, " ").trim() ?? "";
  const statusCode = raw.match(/^Status:\s*(\d\.\d{1,3}\.\d{1,3})/im)?.[1] ?? "";

  let permanent: boolean;
  if (actions.includes("failed") || statuses.includes("5")) permanent = true;
  else if (actions.length > 0 || statuses.length > 0) permanent = false; // delayed, relayed, 4.x.x
  else permanent = !DELAY_SUBJECT.test(subject);

  const detail = [statusCode && `Status ${statusCode}`, diagnostic || subject].filter(Boolean).join(": ").slice(0, 500);
  return { recipients: [...recipients], permanent, detail };
}

export function classifyMail(raw: string): ClassifiedMail {
  const headers = parseHeaders(raw);
  const from = addressOf(first(headers, "from"));
  const subject = decodeWords(first(headers, "subject"));
  const messageId = (first(headers, "message-id").match(/<([^<>]+)>/)?.[1] ?? first(headers, "message-id")).toLowerCase();
  const contentType = first(headers, "content-type").toLowerCase();

  const isReport = contentType.includes("multipart/report") && /report-type="?delivery-status/.test(contentType);
  const fromDaemon = BOUNCE_SENDER.test(from);
  if (isReport || (fromDaemon && BOUNCE_SUBJECT.test(subject)) || (fromDaemon && /^Final-Recipient:/im.test(raw))) {
    // A bounce quotes the original anywhere in its body.
    return { kind: "BOUNCE", from, subject, messageId, outreachIds: outreachIdsIn(raw), bounce: parseBounce(raw, subject) };
  }

  // A reply names the original only in its headers; a quoted body is not proof.
  const referenced = outreachIdsIn([...(headers.get("in-reply-to") ?? []), ...(headers.get("references") ?? [])].join(" "));
  const text = extractReplyText(raw);
  const thread = { messageId: first(headers, "message-id").slice(0, 300), references: (headers.get("references") ?? []).join(" ").slice(0, 2000) };
  if (fromDaemon || MACHINE_SENDER.test(from) || isAutomatic(headers, subject) || looksLikeAutoAck(subject, text)) {
    return { kind: "AUTO_REPLY", from, subject, messageId, outreachIds: referenced, text, thread };
  }
  return { kind: "REPLY", from, subject, messageId, outreachIds: referenced, text, thread };
}
