import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Short, human-friendly random id used for the chatbot's reference numbers.
 * The alphabet excludes look-alike characters (0/O, 1/I/L) so a reference can
 * be read out over the phone or WhatsApp without ambiguity.
 */
export function shortId(length = 8): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** The kinds of chatbot records that carry a customer-facing reference number. */
export type ReferenceKind = "LEAD" | "TKT" | "QTE" | "MTG" | "CONV";

/** A customer-facing reference such as `BM-LEAD-7F3K2Q9A`. */
export function generateReference(kind: ReferenceKind, length = 8): string {
  return `BM-${kind}-${shortId(length)}`;
}

/** Reference for a web chat thread, issued by the browser on its first message. */
export function generateConversationReference(): string {
  return generateReference("CONV", 10);
}

/** True if the text contains Urdu/Punjabi (Arabic) script. */
export function isUrduScript(text: string): boolean {
  return /[؀-ۿ]/.test(text);
}

/** Format a number as Pakistani Rupees. */
export function formatPkr(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amount)}`;
}

/** Date + time for transcripts and activity feeds, in Pakistan time. */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  }).format(date);
}

/** Turn `PROPOSAL_SENT` into `Proposal sent` for labels. */
export function humanise(value: string): string {
  const spaced = value.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Truncate long text without breaking mid-word where possible. */
export function truncate(text: string, max = 120): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut}…`;
}
