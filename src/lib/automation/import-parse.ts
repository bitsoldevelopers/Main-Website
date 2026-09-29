import { CRM_FIELDS, type CrmField, type FieldMapping } from "./columns";
import { sha256 } from "./crypto";
import {
  clean,
  cleanText,
  companyKey,
  displayName,
  emailDomain,
  identityKey,
  normalizeEmail,
  normalizeLinkedin,
  normalizePhone,
  normalizeWebsite,
  personKey,
  type NormalizedWebsite,
} from "./normalize";
import type { EmailType } from "./outreach-email";
import { checkEmail, isSharedMailbox, type DomainStatus, type EmailReason, type EmailValidity } from "./validate";

/**
 * The pure half of the import: one source row in, one normalised and
 * validated row out. No database here, so the same code powers the wizard's
 * preview, the import itself and the tests.
 */

export const PHONE_TYPES = ["PRIMARY", "SECONDARY", "TERTIARY", "COMPANY"] as const;
export type PhoneType = (typeof PHONE_TYPES)[number];

export const PHONE_TYPE_LABELS: Record<PhoneType, string> = {
  PRIMARY: "Contact Phone 1",
  SECONDARY: "Contact Phone 2",
  TERTIARY: "Contact Phone 3",
  COMPANY: "Company Phone 1",
};

const EMAIL_FIELDS: { field: CrmField; type: EmailType }[] = [
  { field: "email_primary", type: "PRIMARY" },
  { field: "email_secondary", type: "SECONDARY" },
  { field: "email_personal", type: "PERSONAL" },
];

const PHONE_FIELDS: { field: CrmField; type: PhoneType }[] = [
  { field: "phone_primary", type: "PRIMARY" },
  { field: "phone_secondary", type: "SECONDARY" },
  { field: "phone_tertiary", type: "TERTIARY" },
  { field: "company_phone", type: "COMPANY" },
];

export interface ParsedEmail {
  type: EmailType;
  /** As the source wrote it (trimmed). */
  email: string;
  emailKey: string;
  validity: EmailValidity;
  reason: EmailReason;
  /** info@, sales@…: deliverable, but says nothing about who the person is. */
  shared: boolean;
}

export interface ParsedPhone {
  type: PhoneType;
  phone: string;
  /** "" when the value is not a usable phone number. */
  phoneKey: string;
}

export interface ParsedRow {
  rowNumber: number;
  /** Every source column, by header, exactly as supplied. */
  raw: Record<string, string>;
  /** The mapped CRM fields, trimmed. */
  values: Record<CrmField, string>;
  emails: ParsedEmail[];
  phones: ParsedPhone[];
  website: NormalizedWebsite | null;
  linkedinKey: string;
  identityKey: string;
  personKey: string;
  companyKey: string;
  /** Best available display name. */
  name: string;
  blank: boolean;
  /** Why this row cannot become a lead; null when it can. */
  invalidReason: string | null;
  warnings: string[];
  sourceKey: string;
  sourceHash: string;
}

function emptyValues(): Record<CrmField, string> {
  return Object.fromEntries(CRM_FIELDS.map((field) => [field, ""])) as Record<CrmField, string>;
}

export function parseRow(
  headers: string[],
  cells: string[],
  mapping: FieldMapping,
  rowNumber: number,
  domains?: Map<string, DomainStatus>
): ParsedRow {
  const raw: Record<string, string> = {};
  headers.forEach((header, i) => {
    if (header) raw[header] = cells[i] ?? "";
  });

  const values = emptyValues();
  for (const field of CRM_FIELDS) {
    const header = mapping[field];
    if (!header) continue;
    const cell = raw[header] ?? "";
    values[field] = field === "company_description" ? cleanText(cell) : clean(cell);
  }

  const warnings: string[] = [];

  const emails: ParsedEmail[] = [];
  const seenEmails = new Set<string>();
  for (const { field, type } of EMAIL_FIELDS) {
    const email = values[field];
    if (!email) continue;
    const emailKey = normalizeEmail(email).slice(0, 191);
    // The same address in two columns is one address, kept where it came first.
    if (seenEmails.has(emailKey)) continue;
    seenEmails.add(emailKey);
    const check = checkEmail(email, domains);
    emails.push({ type, email, emailKey, validity: check.validity, reason: check.reason, shared: isSharedMailbox(emailKey) });
  }

  const phones: ParsedPhone[] = [];
  for (const { field, type } of PHONE_FIELDS) {
    const phone = values[field];
    if (!phone) continue;
    const phoneKey = normalizePhone(phone);
    if (!phoneKey) warnings.push(`${PHONE_TYPE_LABELS[type]} "${phone}" does not look like a phone number.`);
    phones.push({ type, phone, phoneKey });
  }

  const website = values.website ? normalizeWebsite(values.website) : null;
  if (values.website && !website) warnings.push(`Website "${values.website}" is not a valid URL.`);

  const linkedinKey = values.linkedin_url ? normalizeLinkedin(values.linkedin_url) : "";
  if (values.linkedin_url && !linkedinKey) warnings.push(`LinkedIn "${values.linkedin_url}" is not a LinkedIn URL.`);

  const blank = cells.every((cell) => clean(cell) === "");
  const usableEmails = emails.filter((email) => email.validity !== "INVALID" || email.reason !== "BAD_FORMAT");
  const primaryPhone = phones.find((phone) => phone.type === "PRIMARY" && phone.phoneKey);
  const ident = identityKey(values.first_name, values.last_name, values.company_name);
  const hasIdentity = usableEmails.length > 0 || phones.some((p) => p.phoneKey) || Boolean(linkedinKey) || Boolean(ident);

  const name = displayName(values.first_name, values.last_name, values.company_name);
  const invalidReason = blank
    ? null
    : hasIdentity
      ? null
      : "No email, phone, LinkedIn profile or full name with company: nothing to identify this contact by.";

  const personalEmail = (type: EmailType) => emails.find((e) => e.type === type && !e.shared && e.reason !== "BAD_FORMAT")?.emailKey;
  const strongest =
    (personalEmail("PRIMARY") && `e:${personalEmail("PRIMARY")}`) ||
    (personalEmail("SECONDARY") && `e:${personalEmail("SECONDARY")}`) ||
    (personalEmail("PERSONAL") && `e:${personalEmail("PERSONAL")}`) ||
    (linkedinKey && `l:${linkedinKey}`) ||
    (primaryPhone && `p:${primaryPhone.phoneKey}|${personKey(values.first_name, values.last_name)}`) ||
    (ident && `n:${ident}`) ||
    `r:${CRM_FIELDS.map((field) => values[field]).join("\u001f")}`;

  return {
    rowNumber,
    raw,
    values,
    emails,
    phones,
    website,
    linkedinKey,
    identityKey: ident,
    personKey: personKey(values.first_name, values.last_name),
    companyKey: companyKey(values.company_name) || (website ? companyKey(website.domain) : ""),
    name,
    blank,
    invalidReason,
    warnings,
    sourceKey: sha256(strongest).slice(0, 40),
    sourceHash: sha256(CRM_FIELDS.map((field) => values[field]).join("\u001f")).slice(0, 40),
  };
}

/** Every email domain in a table, so they can be looked up once, together. */
export function emailDomainsOf(headers: string[], rows: string[][], mapping: FieldMapping): string[] {
  const columns = EMAIL_FIELDS.map(({ field }) => (mapping[field] ? headers.indexOf(mapping[field] as string) : -1)).filter((i) => i >= 0);
  const domains = new Set<string>();
  for (const row of rows) {
    for (const column of columns) {
      const domain = emailDomain(normalizeEmail(row[column]));
      if (domain && domain.includes(".")) domains.add(domain);
    }
  }
  return [...domains];
}

// ─── Duplicate detection ────────────────────────────────────────────────────

export const MATCH_LEVELS = {
  PRIMARY_EMAIL: { level: 1, label: "Primary email" },
  SECONDARY_EMAIL: { level: 2, label: "Secondary email" },
  PERSONAL_EMAIL: { level: 3, label: "Personal email" },
  PRIMARY_PHONE: { level: 4, label: "Primary contact phone" },
  LINKEDIN: { level: 5, label: "LinkedIn profile URL" },
  NAME_COMPANY: { level: 6, label: "First name + last name + company" },
} as const;
export type MatchLevel = keyof typeof MATCH_LEVELS;

const EMAIL_LEVEL: Record<EmailType, MatchLevel> = {
  PRIMARY: "PRIMARY_EMAIL",
  SECONDARY: "SECONDARY_EMAIL",
  PERSONAL: "PERSONAL_EMAIL",
};

export interface DedupeKey {
  level: MatchLevel;
  /** "email:…", "phone:…", "linkedin:…" or "identity:…". */
  key: string;
}

/**
 * A row's identity keys, strongest first. Shared mailboxes and the company
 * switchboard are left out: they identify a company, not a person.
 */
export function dedupeKeys(row: Pick<ParsedRow, "emails" | "phones" | "linkedinKey" | "identityKey">): DedupeKey[] {
  const keys: DedupeKey[] = [];
  for (const type of ["PRIMARY", "SECONDARY", "PERSONAL"] as const) {
    const email = row.emails.find((e) => e.type === type);
    if (email && !email.shared && email.reason !== "BAD_FORMAT" && email.reason !== "EMPTY") {
      keys.push({ level: EMAIL_LEVEL[type], key: `email:${email.emailKey}` });
    }
  }
  const phone = row.phones.find((p) => p.type === "PRIMARY" && p.phoneKey);
  if (phone) keys.push({ level: "PRIMARY_PHONE", key: `phone:${phone.phoneKey}` });
  if (row.linkedinKey) keys.push({ level: "LINKEDIN", key: `linkedin:${row.linkedinKey}` });
  if (row.identityKey) keys.push({ level: "NAME_COMPANY", key: `identity:${row.identityKey}` });
  return keys;
}

/** Two people can share a phone line; two different names on it are two people. */
export function namesConflict(a: string, b: string): boolean {
  return a !== "" && b !== "" && a !== b;
}

export interface IndexedMatch<T> {
  level: MatchLevel;
  value: T;
}

/** key → owner lookups with the duplicate hierarchy and the phone guard built in. */
export class DuplicateIndex<T> {
  private readonly owners = new Map<string, { value: T; personKey: string }[]>();

  add(keys: DedupeKey[], value: T, person: string): void {
    for (const { key } of keys) {
      const list = this.owners.get(key) ?? [];
      if (!list.some((owner) => owner.value === value)) list.push({ value, personKey: person });
      this.owners.set(key, list);
    }
  }

  find(keys: DedupeKey[], person: string): IndexedMatch<T> | null {
    for (const { level, key } of keys) {
      const owners = this.owners.get(key);
      if (!owners) continue;
      const owner = level === "PRIMARY_PHONE" ? owners.find((o) => !namesConflict(o.personKey, person)) : owners[0];
      if (owner) return { level, value: owner.value };
    }
    return null;
  }
}

// ─── Data quality ───────────────────────────────────────────────────────────

export interface QualityReport {
  totalRows: number;
  blankRows: number;
  validEmails: number;
  riskyEmails: number;
  invalidEmails: number;
  missingEmails: number;
  duplicateEmails: number;
  missingNames: number;
  missingCompanies: number;
  missingWebsites: number;
  invalidWebsites: number;
  missingLinkedin: number;
  invalidLinkedin: number;
  missingPhones: number;
}

export type QualityIssue =
  | "invalid_email"
  | "risky_email"
  | "missing_email"
  | "duplicate_email"
  | "missing_name"
  | "missing_company"
  | "missing_website"
  | "missing_linkedin"
  | "missing_phone";

/** The issues one row has; the report is these, counted. */
export function rowIssues(row: ParsedRow, duplicateEmail: boolean): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (row.emails.length === 0) issues.push("missing_email");
  else if (row.emails.every((e) => e.validity === "INVALID")) issues.push("invalid_email");
  else if (!row.emails.some((e) => e.validity === "VALID")) issues.push("risky_email");
  if (duplicateEmail) issues.push("duplicate_email");
  if (!row.values.first_name && !row.values.last_name) issues.push("missing_name");
  if (!row.values.company_name) issues.push("missing_company");
  if (!row.website) issues.push("missing_website");
  if (!row.linkedinKey) issues.push("missing_linkedin");
  if (!row.phones.some((p) => p.phoneKey)) issues.push("missing_phone");
  return issues;
}

/** Rows that repeat an email address an earlier row already used. */
export function duplicateEmailRows(rows: ParsedRow[]): Set<number> {
  const seen = new Set<string>();
  const duplicates = new Set<number>();
  for (const row of rows) {
    if (row.blank) continue;
    let repeated = false;
    for (const email of row.emails) {
      if (email.shared || email.reason === "BAD_FORMAT") continue;
      if (seen.has(email.emailKey)) repeated = true;
      seen.add(email.emailKey);
    }
    if (repeated) duplicates.add(row.rowNumber);
  }
  return duplicates;
}

export function buildQualityReport(rows: ParsedRow[]): QualityReport {
  const duplicates = duplicateEmailRows(rows);
  const report: QualityReport = {
    totalRows: 0,
    blankRows: 0,
    validEmails: 0,
    riskyEmails: 0,
    invalidEmails: 0,
    missingEmails: 0,
    duplicateEmails: duplicates.size,
    missingNames: 0,
    missingCompanies: 0,
    missingWebsites: 0,
    invalidWebsites: 0,
    missingLinkedin: 0,
    invalidLinkedin: 0,
    missingPhones: 0,
  };
  for (const row of rows) {
    if (row.blank) {
      report.blankRows++;
      continue;
    }
    report.totalRows++;
    const issues = rowIssues(row, false);
    if (issues.includes("missing_email")) report.missingEmails++;
    else if (issues.includes("invalid_email")) report.invalidEmails++;
    else if (issues.includes("risky_email")) report.riskyEmails++;
    else report.validEmails++;
    if (issues.includes("missing_name")) report.missingNames++;
    if (issues.includes("missing_company")) report.missingCompanies++;
    if (issues.includes("missing_website")) {
      report.missingWebsites++;
      if (row.values.website) report.invalidWebsites++;
    }
    if (issues.includes("missing_linkedin")) {
      report.missingLinkedin++;
      if (row.values.linkedin_url) report.invalidLinkedin++;
    }
    if (issues.includes("missing_phone")) report.missingPhones++;
  }
  return report;
}
