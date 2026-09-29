/**
 * Normalisers for the duplicate detector and the validator. Every function is
 * pure and returns a comparison key; the value the source supplied is stored
 * untouched next to it, so nothing here ever rewrites what the CRM shows.
 */

/** Trim and collapse internal runs of whitespace; "" for anything not a string. */
export function clean(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return "";
  return value.replace(/[ ​-‍﻿]/g, " ").replace(/\s+/g, " ").trim();
}

/** Multi-line text (company descriptions): keep line breaks, trim the ends. */
export function cleanText(value: unknown): string {
  if (typeof value !== "string") return clean(value);
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[​-‍﻿]/g, "")
    .trim();
}

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

// ─── Email ──────────────────────────────────────────────────────────────────

/**
 * "  John.Smith@Company.COM " → "john.smith@company.com". Also unwraps the
 * shapes spreadsheets tend to hold: `mailto:` links, `Name <address>` and
 * markdown links.
 */
export function normalizeEmail(value: unknown): string {
  let email = clean(value);
  if (!email) return "";
  const markdown = email.match(/\[([^\]]+)\]\(mailto:[^)]+\)/i);
  if (markdown) email = markdown[1];
  const angled = email.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (angled) email = angled[1];
  email = email.replace(/^mailto:/i, "").replace(/\?.*$/, "");
  // A space inside an address is left in, so the validator rejects it:
  // closing the gap would quietly turn it into somebody else's address.
  return email.replace(/[,;]+$/, "").trim().toLowerCase();
}

export function emailDomain(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).toLowerCase();
}

export function emailLocalPart(email: string): string {
  const at = email.lastIndexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

// ─── Phone ──────────────────────────────────────────────────────────────────

/**
 * Comparison key for a phone number: digits only, extension dropped, and the
 * last ten digits when there are more, so "+1 (415) 555-1234" and
 * "415-555-1234" are the same number. "" when it is too short to be a phone.
 */
export function normalizePhone(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const withoutExtension = raw.replace(/\s*(?:ext\.?|extension|x)\s*\d+\s*$/i, "");
  let digits = withoutExtension.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length < 7 || digits.length > 15) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Digits with the country code kept, for tel: and wa.me links. */
export function phoneDigits(value: unknown): string {
  const raw = clean(value).replace(/\s*(?:ext\.?|extension|x)\s*\d+\s*$/i, "");
  const digits = raw.replace(/\D/g, "");
  return digits.startsWith("00") ? digits.slice(2) : digits;
}

// ─── URLs ───────────────────────────────────────────────────────────────────

function parseUrl(value: string): URL | null {
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

export interface NormalizedWebsite {
  /** A link that opens: protocol added when the source left it out. */
  url: string;
  /** Host without "www.", lower-cased. */
  domain: string;
  /** domain + path, for comparing two websites. */
  key: string;
}

export function normalizeWebsite(value: unknown): NormalizedWebsite | null {
  const raw = clean(value);
  if (!raw || /\s/.test(raw)) return null;
  const url = parseUrl(raw);
  if (!url) return null;
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return { url: url.toString(), domain, key: `${domain}${path.toLowerCase()}` };
}

/**
 * "https://www.linkedin.com/in/John-Smith/?utm=x" and
 * "pk.linkedin.com/in/john-smith" both become "linkedin.com/in/john-smith".
 * "" when the value is not a LinkedIn URL.
 */
export function normalizeLinkedin(value: unknown): string {
  const raw = clean(value);
  if (!raw) return "";
  const url = parseUrl(raw);
  if (!url) return "";
  const host = url.hostname.toLowerCase();
  if (host !== "linkedin.com" && !host.endsWith(".linkedin.com")) return "";
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    path = url.pathname;
  }
  path = path.toLowerCase().replace(/\/+$/, "").replace(/\/{2,}/g, "/");
  if (!path || path === "/") return "";
  return `linkedin.com${path}`.slice(0, 191);
}

// ─── Names and companies ────────────────────────────────────────────────────

function nameToken(value: unknown): string {
  return stripDiacritics(clean(value).toLowerCase())
    .replace(/[^a-z0-9\u0080-￿ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const COMPANY_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "llp",
  "ltd",
  "limited",
  "corp",
  "corporation",
  "co",
  "company",
  "gmbh",
  "ag",
  "sa",
  "srl",
  "bv",
  "plc",
  "pty",
  "pvt",
  "private",
  "pte",
  "fzc",
  "fze",
  "fzco",
  "smc",
]);

/** "ABC Technologies (Pvt.) Ltd." → "abc technologies". */
export function companyKey(value: unknown): string {
  const base = nameToken(value);
  if (!base) return "";
  const words = base.split(" ");
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ").slice(0, 191);
}

/** Level-6 identity: first name + last name + company, all three required. */
export function identityKey(firstName: unknown, lastName: unknown, company: unknown): string {
  const first = nameToken(firstName);
  const last = nameToken(lastName);
  const org = companyKey(company);
  if (!first || !last || !org) return "";
  return `${first}|${last}|${org}`.slice(0, 191);
}

/** First + last name only, used to stop a shared phone merging two people. */
export function personKey(firstName: unknown, lastName: unknown): string {
  const first = nameToken(firstName);
  const last = nameToken(lastName);
  return first || last ? `${first}|${last}` : "";
}

/** "First Last", falling back to whatever is known. */
export function displayName(firstName: unknown, lastName: unknown, fallback = ""): string {
  const name = [clean(firstName), clean(lastName)].filter(Boolean).join(" ");
  return name || fallback;
}
