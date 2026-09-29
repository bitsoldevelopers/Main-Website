import { emailDomain, emailLocalPart, normalizeEmail } from "./normalize";

/**
 * Email validation for the import and for the lead profile.
 *
 *  ✓ VALID    well-formed, on a domain that accepts mail, addressed to a person
 *  ⚠ RISKY    deliverable in principle but a poor outreach target
 *  ✕ INVALID  will not reach anyone
 *
 * Everything here is synchronous and pure, so it is safe to import anywhere.
 * The DNS lookup that feeds `checkEmail` lives in domain-check.ts.
 */

export type EmailValidity = "VALID" | "RISKY" | "INVALID";

export type EmailReason =
  | "OK"
  | "EMPTY"
  | "BAD_FORMAT"
  | "TOO_LONG"
  | "RESERVED_DOMAIN"
  | "TYPO_DOMAIN"
  | "NO_REPLY_ADDRESS"
  | "ROLE_ADDRESS"
  | "DISPOSABLE_DOMAIN"
  | "NO_MAIL_SERVER"
  | "BOUNCED"
  | "UNSUBSCRIBED"
  | "SUPPRESSED";

export interface EmailCheck {
  validity: EmailValidity;
  reason: EmailReason;
}

export const EMAIL_REASON_LABELS: Record<EmailReason, string> = {
  OK: "Looks deliverable",
  EMPTY: "No address",
  BAD_FORMAT: "Not a valid email format",
  TOO_LONG: "Longer than an email address can be",
  RESERVED_DOMAIN: "Placeholder domain (example.com and similar)",
  TYPO_DOMAIN: "Domain looks like a typo of a major mailbox provider",
  NO_REPLY_ADDRESS: "No-reply or system mailbox",
  ROLE_ADDRESS: "Shared role mailbox (info@, sales@…), not a person",
  DISPOSABLE_DOMAIN: "Disposable mailbox provider",
  NO_MAIL_SERVER: "Domain has no mail server",
  BOUNCED: "A previous email to this address bounced",
  UNSUBSCRIBED: "This address unsubscribed",
  SUPPRESSED: "On the suppression list",
};

// RFC 5321/5322 in practice: no quoted local parts, which no real prospect uses.
const LOCAL = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;

const RESERVED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "domain.com",
  "email.com",
  "localhost.com",
  "none.com",
  "na.com",
]);
const RESERVED_TLDS = new Set(["test", "example", "invalid", "localhost", "local"]);

const TYPO_DOMAINS = new Set([
  "gmial.com",
  "gmai.com",
  "gmal.com",
  "gamil.com",
  "gmail.co",
  "gmail.con",
  "gmail.cm",
  "gnail.com",
  "gmaill.com",
  "hotmial.com",
  "hotmai.com",
  "hotmal.com",
  "hotmail.co",
  "hotmail.con",
  "yahooo.com",
  "yaho.com",
  "yahoo.co",
  "yahoo.con",
  "outlok.com",
  "outloo.com",
  "outlook.co",
  "outlook.con",
  "iclod.com",
  "icloud.co",
]);

const NO_REPLY_LOCALS = new Set([
  "noreply",
  "no-reply",
  "no_reply",
  "donotreply",
  "do-not-reply",
  "do_not_reply",
  "mailer-daemon",
  "postmaster",
  "abuse",
  "bounce",
  "bounces",
  "unsubscribe",
]);

export const ROLE_LOCALS = new Set([
  "info",
  "contact",
  "contactus",
  "hello",
  "hi",
  "sales",
  "support",
  "help",
  "admin",
  "administrator",
  "office",
  "mail",
  "email",
  "enquiries",
  "enquiry",
  "inquiries",
  "inquiry",
  "marketing",
  "team",
  "hr",
  "jobs",
  "careers",
  "recruitment",
  "billing",
  "accounts",
  "accounting",
  "finance",
  "press",
  "media",
  "pr",
  "legal",
  "privacy",
  "security",
  "webmaster",
  "service",
  "customerservice",
  "customercare",
  "orders",
  "reception",
  "general",
]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailo.com",
  "throwawaymail.com",
  "yopmail.com",
  "yopmail.net",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
  "mohmal.com",
  "emailondeck.com",
  "moakt.com",
  "tmpmail.org",
  "tmpmail.net",
  "burnermail.io",
]);

/**
 * True for mailboxes shared by a whole company. They are never used to decide
 * that two rows are the same person.
 */
export function isSharedMailbox(email: string): boolean {
  const local = emailLocalPart(normalizeEmail(email));
  return ROLE_LOCALS.has(local) || NO_REPLY_LOCALS.has(local);
}

/** Format and list checks. Accepts the address in any casing or wrapping. */
export function checkEmailSyntax(value: unknown): EmailCheck {
  const email = normalizeEmail(value);
  if (!email) return { validity: "INVALID", reason: "EMPTY" };
  if (email.length > 254) return { validity: "INVALID", reason: "TOO_LONG" };

  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) return { validity: "INVALID", reason: "BAD_FORMAT" };
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !LOCAL.test(local) || !DOMAIN.test(domain)) {
    return { validity: "INVALID", reason: "BAD_FORMAT" };
  }

  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (RESERVED_DOMAINS.has(domain) || RESERVED_TLDS.has(tld)) return { validity: "INVALID", reason: "RESERVED_DOMAIN" };
  if (TYPO_DOMAINS.has(domain)) return { validity: "INVALID", reason: "TYPO_DOMAIN" };
  if (NO_REPLY_LOCALS.has(local)) return { validity: "INVALID", reason: "NO_REPLY_ADDRESS" };
  if (DISPOSABLE_DOMAINS.has(domain)) return { validity: "RISKY", reason: "DISPOSABLE_DOMAIN" };
  if (ROLE_LOCALS.has(local)) return { validity: "RISKY", reason: "ROLE_ADDRESS" };
  return { validity: "VALID", reason: "OK" };
}

export type DomainStatus = "ACCEPTS_MAIL" | "NO_MAIL_SERVER" | "UNKNOWN";

/** Syntax verdict combined with what is known about the domain. */
export function checkEmail(value: unknown, domains?: Map<string, DomainStatus>): EmailCheck {
  const syntax = checkEmailSyntax(value);
  if (syntax.validity === "INVALID" || !domains) return syntax;
  const status = domains.get(emailDomain(normalizeEmail(value)));
  if (status === "NO_MAIL_SERVER") return { validity: "INVALID", reason: "NO_MAIL_SERVER" };
  return syntax;
}

export function validitySymbol(validity: string): string {
  if (validity === "VALID") return "✓";
  if (validity === "RISKY") return "⚠";
  if (validity === "INVALID") return "✕";
  return "·";
}
