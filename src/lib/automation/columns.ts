/**
 * The canonical prospect sheet and how each column lands in the CRM. This is
 * the single definition the wizard, the importer and the CSV export share.
 *
 * `field` is the CRM field name used in mappings and in the admin;
 * `header` is the exact column title in the Google Sheet.
 */

export const CRM_FIELDS = [
  "first_name",
  "last_name",
  "job_title",
  "company_name",
  "website",
  "linkedin_url",
  "email_primary",
  "email_secondary",
  "email_personal",
  "phone_primary",
  "company_phone",
  "phone_secondary",
  "phone_tertiary",
  "contact_location",
  "company_description",
] as const;
export type CrmField = (typeof CRM_FIELDS)[number];

export interface ColumnDefinition {
  header: string;
  field: CrmField;
  /** What the mapping screen calls the CRM side. */
  label: string;
  /** Other titles the same column goes by, compared after normalising. */
  aliases: string[];
}

export const SHEET_COLUMNS: ColumnDefinition[] = [
  { header: "First Name", field: "first_name", label: "First Name", aliases: ["first", "firstname", "fname", "given name"] },
  { header: "Last Name", field: "last_name", label: "Last Name", aliases: ["last", "lastname", "lname", "surname", "family name"] },
  { header: "Title", field: "job_title", label: "Job Title", aliases: ["job title", "position", "role", "designation"] },
  { header: "Company Name", field: "company_name", label: "Company Name", aliases: ["company", "organization", "organisation", "account", "employer"] },
  { header: "Website", field: "website", label: "Website", aliases: ["company website", "url", "site", "web", "domain"] },
  {
    header: "Contact LI Profile URL",
    field: "linkedin_url",
    label: "LinkedIn",
    aliases: ["linkedin", "linkedin url", "linkedin profile", "li profile url", "contact linkedin", "person linkedin url", "li url"],
  },
  { header: "Email 1", field: "email_primary", label: "Primary Email", aliases: ["email", "work email", "primary email", "business email", "email address"] },
  { header: "Email 2", field: "email_secondary", label: "Secondary Email", aliases: ["secondary email", "alternate email", "other email"] },
  { header: "Personal Email", field: "email_personal", label: "Personal Email", aliases: ["private email", "home email"] },
  {
    header: "Contact Phone 1",
    field: "phone_primary",
    label: "Primary Phone",
    aliases: ["phone", "phone 1", "mobile", "mobile phone", "contact phone", "direct phone", "cell", "phone number"],
  },
  { header: "Company Phone 1", field: "company_phone", label: "Company Phone", aliases: ["company phone", "office phone", "hq phone", "corporate phone", "switchboard"] },
  { header: "Contact Phone 2", field: "phone_secondary", label: "Secondary Phone", aliases: ["phone 2", "secondary phone", "other phone"] },
  { header: "Contact Phone 3", field: "phone_tertiary", label: "Tertiary Phone", aliases: ["phone 3", "tertiary phone"] },
  { header: "Contact Location", field: "contact_location", label: "Location", aliases: ["location", "city", "address", "person location", "country"] },
  {
    header: "Company Description",
    field: "company_description",
    label: "Company Description",
    aliases: ["description", "about", "company overview", "about company", "short description"],
  },
];

export const COLUMN_BY_FIELD: Record<CrmField, ColumnDefinition> = Object.fromEntries(
  SHEET_COLUMNS.map((column) => [column.field, column])
) as Record<CrmField, ColumnDefinition>;

export function isCrmField(value: string): value is CrmField {
  return (CRM_FIELDS as readonly string[]).includes(value);
}

/** Header comparison ignores case, spacing and punctuation. */
export function headerKey(header: unknown): string {
  return typeof header === "string" ? header.toLowerCase().replace(/[^a-z0-9]+/g, "") : "";
}

/** crmField → the sheet header it reads from; absent when not mapped. */
export type FieldMapping = Partial<Record<CrmField, string>>;

export interface MappingResult {
  mapping: FieldMapping;
  /** Canonical columns the sheet does not have. */
  missing: ColumnDefinition[];
  /** Sheet columns nothing reads from. They stay in the stored source row. */
  unmapped: string[];
  /** Mapped through an alias rather than the exact canonical title. */
  guessed: CrmField[];
}

/**
 * Maps a sheet's header row onto the CRM. Exact canonical titles win; aliases
 * fill what is left, and a header is never used for two fields.
 */
export function detectMapping(headers: string[]): MappingResult {
  const byKey = new Map<string, string>();
  for (const header of headers) {
    const key = headerKey(header);
    if (key && !byKey.has(key)) byKey.set(key, header);
  }

  const mapping: FieldMapping = {};
  const used = new Set<string>();
  const guessed: CrmField[] = [];

  for (const column of SHEET_COLUMNS) {
    const header = byKey.get(headerKey(column.header));
    if (header) {
      mapping[column.field] = header;
      used.add(header);
    }
  }
  for (const column of SHEET_COLUMNS) {
    if (mapping[column.field]) continue;
    for (const alias of column.aliases) {
      const header = byKey.get(headerKey(alias));
      if (header && !used.has(header)) {
        mapping[column.field] = header;
        used.add(header);
        guessed.push(column.field);
        break;
      }
    }
  }

  return {
    mapping,
    missing: SHEET_COLUMNS.filter((column) => !mapping[column.field]),
    unmapped: headers.filter((header) => header.trim() && !used.has(header)),
    guessed,
  };
}

/** Keeps only known fields that point at a header the sheet really has. */
export function sanitizeMapping(input: unknown, headers: string[]): FieldMapping {
  const mapping: FieldMapping = {};
  if (!input || typeof input !== "object") return mapping;
  const available = new Set(headers);
  const used = new Set<string>();
  for (const [field, header] of Object.entries(input as Record<string, unknown>)) {
    if (!isCrmField(field) || typeof header !== "string" || !available.has(header) || used.has(header)) continue;
    mapping[field] = header;
    used.add(header);
  }
  return mapping;
}

export function missingColumnWarnings(mapping: FieldMapping): string[] {
  return SHEET_COLUMNS.filter((column) => !mapping[column.field]).map((column) => `${column.header} column not found.`);
}
