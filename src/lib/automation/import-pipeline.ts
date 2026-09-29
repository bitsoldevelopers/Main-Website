import type { LeadImport, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROSPECT_SUBJECT, leadSourceLabel } from "@/lib/admin/leads";
import { COLUMN_BY_FIELD, detectMapping, sanitizeMapping, type CrmField, type FieldMapping } from "./columns";
import { lookupDomains } from "./domain-check";
import { enrollLead } from "./engine";
import { readWorksheet } from "./google/client";
import {
  DuplicateIndex,
  MATCH_LEVELS,
  buildQualityReport,
  dedupeKeys,
  emailDomainsOf,
  parseRow,
  type MatchLevel,
  type ParsedRow,
  type QualityReport,
} from "./import-parse";
import { materializeContacts, refreshOutreachEmail } from "./lead-contacts";
import { personKey } from "./normalize";
import { getBestOutreachEmail, type EmailType } from "./outreach-email";
import { readRoundRobinCursor, writeRoundRobinCursor } from "./settings";
import { parseImportSettings, type ImportSettings, type SourceTable } from "./sources/types";
import { loadSuppression, type SuppressionLookup } from "./suppression";
import { recordActivities, type TimelineEntry } from "./timeline";
import type { DomainStatus } from "./validate";

/**
 * The import, source to CRM:
 *
 *   source rows → normalise → validate → duplicate check → create / update
 *   → choose outreach email → assign → tag → start automation
 *
 * Nothing in here knows whether the rows came from Google Sheets or a CSV.
 * A row that fails is recorded and skipped; it never stops the batch.
 */

export const ROW_OUTCOMES = {
  CREATED: "New lead",
  UPDATED: "Updated",
  UNCHANGED: "No changes",
  DUPLICATE: "Duplicate",
  REVIEW: "Needs review",
  INVALID: "Invalid",
  SKIPPED: "Skipped",
  FAILED: "Failed",
} as const;
export type RowOutcome = keyof typeof ROW_OUTCOMES;

const IMPORT_ACTOR = "Import";
const CHUNK = 500;

interface Counts {
  total: number;
  created: number;
  updated: number;
  duplicates: number;
  invalid: number;
  skipped: number;
  failed: number;
  automationStarted: number;
}

interface FileOwner {
  rowNumber: number;
  leadId: string | null;
}

interface Context {
  batch: LeadImport;
  settings: ImportSettings;
  sourceLabel: string;
  sourceName: string;
  sourceWorksheet: string | null;
  leadSourceId: string | null;
  crm: DuplicateIndex<string>;
  file: DuplicateIndex<FileOwner>;
  companies: Map<string, string>;
  suppression: SuppressionLookup;
  tagIds: string[];
  tagNames: string[];
  assignees: { id: string; label: string }[];
  cursor: number;
  automation: { id: string; name: string; active: boolean } | null;
  counts: Counts;
  warnings: string[];
}

interface RowResult {
  /** True for a row that repeats an earlier row of the same file. */
  repeat?: boolean;
  outcome: RowOutcome;
  leadId: string | null;
  matchLevel: string | null;
  message: string | null;
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function cut(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

function personKeyOfLead(lead: { firstName: string | null; lastName: string | null; name: string }): string {
  if (lead.firstName || lead.lastName) return personKey(lead.firstName, lead.lastName);
  const [first, ...rest] = lead.name.trim().split(/\s+/);
  return personKey(first ?? "", rest.join(" "));
}

// ─── Loading the source ─────────────────────────────────────────────────────

async function loadTable(batch: LeadImport & { worksheet: { connectionId: string; spreadsheetId: string; worksheetId: number } | null }): Promise<SourceTable> {
  if (batch.worksheet) {
    const { table } = await readWorksheet(batch.worksheet.connectionId, batch.worksheet.spreadsheetId, batch.worksheet.worksheetId);
    return table;
  }
  if (!batch.payload) throw new Error("This import has no rows to process (its upload was already cleared).");
  const parsed = JSON.parse(batch.payload) as SourceTable;
  if (!Array.isArray(parsed.headers) || !Array.isArray(parsed.rows)) throw new Error("The uploaded rows are unreadable.");
  return parsed;
}

/** The mapping a batch runs with: what the admin confirmed, or what is detected. */
export function resolveMapping(settings: ImportSettings, headers: string[]): FieldMapping {
  const chosen = sanitizeMapping(settings.mapping, headers);
  return Object.keys(chosen).length > 0 ? chosen : detectMapping(headers).mapping;
}

export async function parseTable(
  table: SourceTable,
  mapping: FieldMapping,
  options: { checkDomains: boolean }
): Promise<ParsedRow[]> {
  let domains: Map<string, DomainStatus> | undefined;
  if (options.checkDomains) {
    domains = await lookupDomains(emailDomainsOf(table.headers, table.rows, mapping));
  }
  return table.rows.map((cells, i) => parseRow(table.headers, cells, mapping, table.firstRowNumber + i, domains));
}

// ─── What the CRM already holds ─────────────────────────────────────────────

const personSelect = { firstName: true, lastName: true, name: true } as const;

async function loadCrmIndex(rows: ParsedRow[]): Promise<DuplicateIndex<string>> {
  const index = new DuplicateIndex<string>();
  const emailKeys = new Set<string>();
  const phoneKeys = new Set<string>();
  const linkedinKeys = new Set<string>();
  const identityKeys = new Set<string>();

  for (const row of rows) {
    for (const { key } of dedupeKeys(row)) {
      const [kind, ...rest] = key.split(":");
      const value = rest.join(":");
      if (kind === "email") emailKeys.add(value);
      else if (kind === "phone") phoneKeys.add(value);
      else if (kind === "linkedin") linkedinKeys.add(value);
      else if (kind === "identity") identityKeys.add(value);
    }
  }

  for (const chunk of chunks([...emailKeys])) {
    const [stored, legacy] = await Promise.all([
      prisma.leadEmail.findMany({ where: { emailKey: { in: chunk } }, select: { emailKey: true, leadId: true, lead: { select: personSelect } } }),
      // Leads from the website forms, created before contact rows existed.
      prisma.lead.findMany({ where: { email: { in: chunk } }, select: { id: true, email: true, ...personSelect } }),
    ]);
    for (const row of stored) index.add([{ level: "PRIMARY_EMAIL", key: `email:${row.emailKey}` }], row.leadId, personKeyOfLead(row.lead));
    for (const lead of legacy) {
      index.add([{ level: "PRIMARY_EMAIL", key: `email:${lead.email.trim().toLowerCase()}` }], lead.id, personKeyOfLead(lead));
    }
  }
  for (const chunk of chunks([...phoneKeys])) {
    const stored = await prisma.leadPhone.findMany({
      where: { phoneKey: { in: chunk }, type: "PRIMARY" },
      select: { phoneKey: true, leadId: true, lead: { select: personSelect } },
    });
    for (const row of stored) index.add([{ level: "PRIMARY_PHONE", key: `phone:${row.phoneKey}` }], row.leadId, personKeyOfLead(row.lead));
  }
  for (const chunk of chunks([...linkedinKeys])) {
    const leads = await prisma.lead.findMany({ where: { linkedinKey: { in: chunk } }, select: { id: true, linkedinKey: true, ...personSelect } });
    for (const lead of leads) index.add([{ level: "LINKEDIN", key: `linkedin:${lead.linkedinKey}` }], lead.id, personKeyOfLead(lead));
  }
  for (const chunk of chunks([...identityKeys])) {
    const leads = await prisma.lead.findMany({ where: { identityKey: { in: chunk } }, select: { id: true, identityKey: true, ...personSelect } });
    for (const lead of leads) index.add([{ level: "NAME_COMPANY", key: `identity:${lead.identityKey}` }], lead.id, personKeyOfLead(lead));
  }
  return index;
}

async function loadCompanies(rows: ParsedRow[]): Promise<Map<string, string>> {
  const keys = [...new Set(rows.map((row) => row.companyKey).filter(Boolean))];
  const map = new Map<string, string>();
  for (const chunk of chunks(keys)) {
    const found = await prisma.company.findMany({ where: { nameKey: { in: chunk } }, select: { id: true, nameKey: true } });
    for (const company of found) map.set(company.nameKey, company.id);
  }
  return map;
}

async function ensureTags(names: string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const existing = await prisma.tag.findMany({ where: { name: { in: names } }, select: { id: true, name: true } });
  const byName = new Map(existing.map((tag) => [tag.name.toLowerCase(), tag.id]));
  const ids: string[] = [];
  for (const name of names) {
    let id = byName.get(name.toLowerCase());
    if (!id) {
      id = (await prisma.tag.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } })).id;
      byName.set(name.toLowerCase(), id);
    }
    ids.push(id);
  }
  return ids;
}

async function loadAssignees(settings: ImportSettings, warnings: string[]): Promise<{ id: string; label: string }[]> {
  if (settings.assignmentMode === "UNASSIGNED") return [];
  const where: Prisma.UserWhereInput =
    settings.assignmentMode === "USER"
      ? { id: settings.assigneeId ?? "", role: { in: ["ADMIN", "MANAGER", "EDITOR"] } }
      : settings.assignmentMode === "TEAM"
        ? { role: settings.assignmentTeam ?? "MANAGER" }
        : { role: { in: ["ADMIN", "MANAGER"] } };
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true } });
  if (users.length === 0) {
    warnings.push("Nobody matched the assignment setting, so the new leads were left unassigned.");
  }
  return users.map((user) => ({ id: user.id, label: user.name || user.email }));
}

async function ensureLeadSource(type: string, name: string, key: string): Promise<string> {
  const source = await prisma.leadSource.upsert({
    where: { key: cut(key, 191) },
    update: { name: cut(name, 300) },
    create: { type, name: cut(name, 300), key: cut(key, 191) },
    select: { id: true },
  });
  return source.id;
}

// ─── Writing one row ────────────────────────────────────────────────────────

async function resolveCompany(ctx: Context, row: ParsedRow): Promise<string | null> {
  if (!row.companyKey) return null;
  const known = ctx.companies.get(row.companyKey);
  const companyPhone = row.phones.find((p) => p.type === "COMPANY")?.phone ?? null;
  if (known) {
    // Fill what the company record is missing; never overwrite what it has.
    const company = await prisma.company.findUnique({ where: { id: known }, select: { website: true, description: true, phone: true } });
    if (company) {
      const patch: Prisma.CompanyUpdateInput = {};
      if (!company.website && row.website) {
        patch.website = cut(row.website.url, 500);
        patch.domain = cut(row.website.domain, 191);
      }
      if (!company.description && row.values.company_description) patch.description = row.values.company_description;
      if (!company.phone && companyPhone) patch.phone = cut(companyPhone, 191);
      if (Object.keys(patch).length > 0) await prisma.company.update({ where: { id: known }, data: patch });
    }
    return known;
  }
  const name = row.values.company_name || row.website?.domain || "";
  const created = await prisma.company.upsert({
    where: { nameKey: row.companyKey },
    update: {},
    create: {
      name: cut(name, 300),
      nameKey: row.companyKey,
      website: row.website ? cut(row.website.url, 500) : null,
      domain: row.website ? cut(row.website.domain, 191) : null,
      description: row.values.company_description || null,
      phone: companyPhone ? cut(companyPhone, 191) : null,
    },
    select: { id: true },
  });
  ctx.companies.set(row.companyKey, created.id);
  return created.id;
}

function sourceLine(ctx: Context, row: ParsedRow): string {
  return [ctx.sourceName, ctx.sourceWorksheet, `row ${row.rowNumber}`].filter(Boolean).join(" › ");
}

function profileFields(row: ParsedRow) {
  const v = row.values;
  return {
    firstName: v.first_name ? cut(v.first_name, 191) : null,
    lastName: v.last_name ? cut(v.last_name, 191) : null,
    jobTitle: v.job_title ? cut(v.job_title, 300) : null,
    company: v.company_name ? cut(v.company_name, 191) : null,
    website: row.website ? cut(row.website.url, 500) : v.website ? cut(v.website, 500) : null,
    linkedinUrl: v.linkedin_url ? cut(v.linkedin_url, 500) : null,
    linkedinKey: row.linkedinKey || null,
    contactLocation: v.contact_location ? cut(v.contact_location, 300) : null,
    companyDescription: v.company_description || null,
    identityKey: row.identityKey || null,
  };
}

async function createLead(ctx: Context, row: ParsedRow): Promise<string> {
  const companyId = await resolveCompany(ctx, row);
  const selection = getBestOutreachEmail({ emails: row.emails }, { suppression: ctx.suppression });
  const firstEmail = selection.selected_email ?? row.emails[0]?.email ?? "";
  const phone = row.phones.find((p) => p.type !== "COMPANY")?.phone ?? row.phones[0]?.phone ?? null;

  let assignee: { id: string; label: string } | null = null;
  if (ctx.assignees.length > 0) {
    assignee = ctx.settings.assignmentMode === "USER" ? ctx.assignees[0] : ctx.assignees[ctx.cursor++ % ctx.assignees.length];
  }

  const lead = await prisma.lead.create({
    data: {
      name: cut(row.name || firstEmail || "Unnamed prospect", 191),
      email: cut(firstEmail, 191),
      subject: PROSPECT_SUBJECT,
      message: "",
      status: selection.selected_email ? "READY_FOR_OUTREACH" : "IMPORTED",
      phone: phone ? cut(phone, 191) : null,
      source: ctx.batch.sourceType,
      ...profileFields(row),
      companyId,
      outreachEmail: selection.selected_email ? cut(selection.selected_email, 191) : null,
      outreachEmailReason: selection.selection_reason,
      sourceName: cut(ctx.sourceName, 300),
      sourceWorksheet: ctx.sourceWorksheet ? cut(ctx.sourceWorksheet, 300) : null,
      sourceRow: row.rowNumber,
      sourceImportId: ctx.batch.id,
      leadSourceId: ctx.leadSourceId,
      assignedToId: assignee?.id ?? null,
      emails: {
        create: row.emails.map((email) => ({
          email: cut(email.email, 320),
          emailKey: email.emailKey,
          type: email.type,
          validity: email.validity,
          validityReason: email.reason,
          isPrimary: email.type === "PRIMARY",
          isOutreach: email.email === selection.selected_email,
        })),
      },
      phones: {
        create: row.phones.map((p) => ({ phone: cut(p.phone, 191), phoneKey: p.phoneKey, type: p.type, isPrimary: p.type === "PRIMARY" })),
      },
      tags: { create: ctx.tagIds.map((tagId) => ({ tagId })) },
    },
    select: { id: true },
  });

  const entries: TimelineEntry[] = [
    { leadId: lead.id, type: "IMPORTED", title: `${ctx.sourceLabel} imported`, detail: sourceLine(ctx, row), actor: IMPORT_ACTOR },
    { leadId: lead.id, type: "LEAD_CREATED", title: "Lead created", actor: IMPORT_ACTOR },
    {
      leadId: lead.id,
      type: "DUPLICATE_CHECKED",
      title: "Duplicate checked",
      detail: "No existing lead matched by email, phone, LinkedIn or name and company.",
      actor: IMPORT_ACTOR,
    },
    {
      leadId: lead.id,
      type: "OUTREACH_EMAIL_SELECTED",
      title: selection.selected_email ? `Outreach email selected: ${selection.selected_email}` : "No usable outreach email",
      detail: [`Reason: ${selection.selection_reason}`, ...selection.skipped.map((s) => `Skipped ${s.email} (${s.reason.toLowerCase()})`)].join("\n"),
      actor: IMPORT_ACTOR,
    },
  ];
  if (assignee) entries.push({ leadId: lead.id, type: "ASSIGNED", title: `Assigned to ${assignee.label}`, actor: IMPORT_ACTOR });
  if (ctx.tagNames.length > 0) entries.push({ leadId: lead.id, type: "TAGGED", title: `Tagged: ${ctx.tagNames.join(", ")}`, actor: IMPORT_ACTOR });
  await recordActivities(entries);

  if (ctx.automation?.active && selection.selected_email) {
    const result = await enrollLead({ leadId: lead.id, automationId: ctx.automation.id, actor: IMPORT_ACTOR });
    if (result.ok) ctx.counts.automationStarted++;
  }
  return lead.id;
}

const FIELD_LABEL: Record<string, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  jobTitle: "Title",
  company: "Company Name",
  website: "Website",
  linkedinUrl: "LinkedIn",
  contactLocation: "Location",
  companyDescription: "Company Description",
};

/** Applies a row to an existing lead. Returns what changed, by label. */
async function updateLead(ctx: Context, leadId: string, row: ParsedRow): Promise<string[] | null> {
  await materializeContacts(leadId);
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { emails: true, phones: true } });
  if (!lead) return null;

  const changed: string[] = [];
  const data: Prisma.LeadUncheckedUpdateInput = {};
  const incoming = profileFields(row);

  // Empty cells never erase what the CRM knows.
  for (const key of ["firstName", "lastName", "jobTitle", "company", "website", "linkedinUrl", "contactLocation", "companyDescription"] as const) {
    const value = incoming[key];
    if (value && value !== lead[key]) {
      data[key] = value;
      changed.push(FIELD_LABEL[key]);
    }
  }
  if (incoming.linkedinKey && incoming.linkedinKey !== lead.linkedinKey) data.linkedinKey = incoming.linkedinKey;
  if (incoming.identityKey && incoming.identityKey !== lead.identityKey) data.identityKey = incoming.identityKey;

  // A prospect's display name follows the source; an inquiry keeps the name the person typed.
  if (lead.subject === PROSPECT_SUBJECT && row.name && row.name !== lead.name) data.name = cut(row.name, 191);

  const companyId = await resolveCompany(ctx, row);
  if (companyId && companyId !== lead.companyId) data.companyId = companyId;

  const sameSource = Boolean(ctx.leadSourceId) && lead.leadSourceId === ctx.leadSourceId;
  const notes: string[] = [];

  // Emails: three slots, never merged, never silently replaced.
  const emails = [...lead.emails];
  for (const email of row.emails) {
    const same = emails.find((e) => e.emailKey === email.emailKey);
    if (same) {
      if (!same.bouncedAt && (same.validity !== email.validity || same.validityReason !== email.reason)) {
        await prisma.leadEmail.update({ where: { id: same.id }, data: { validity: email.validity, validityReason: email.reason } });
      }
      continue;
    }
    const fresh = {
      email: cut(email.email, 320),
      emailKey: email.emailKey,
      validity: email.validity,
      validityReason: email.reason,
      bouncedAt: null,
      isOutreach: false,
    };
    const slot = emails.find((e) => e.type === email.type);
    if (!slot) {
      const created = await prisma.leadEmail.create({ data: { ...fresh, leadId, type: email.type, isPrimary: email.type === "PRIMARY" } });
      emails.push(created);
      changed.push(COLUMN_BY_FIELD[emailField(email.type)].header);
    } else if (sameSource) {
      // The same source row now carries a different address in this column.
      const updated = await prisma.leadEmail.update({ where: { id: slot.id }, data: fresh });
      emails[emails.indexOf(slot)] = updated;
      changed.push(COLUMN_BY_FIELD[emailField(email.type)].header);
    } else {
      const free = (["PRIMARY", "SECONDARY", "PERSONAL"] as EmailType[]).find((type) => !emails.some((e) => e.type === type));
      if (free) {
        const created = await prisma.leadEmail.create({ data: { ...fresh, leadId, type: free, isPrimary: false } });
        emails.push(created);
        changed.push(`Email (${email.email})`);
      } else {
        notes.push(`${email.email} was not stored: this lead already has three email addresses.`);
      }
    }
  }

  const phones = [...lead.phones];
  for (const phone of row.phones) {
    if (phone.phoneKey && phones.some((p) => p.phoneKey === phone.phoneKey && p.type === phone.type)) continue;
    const slot = phones.find((p) => p.type === phone.type);
    const fresh = { phone: cut(phone.phone, 191), phoneKey: phone.phoneKey };
    if (!slot) {
      phones.push(await prisma.leadPhone.create({ data: { ...fresh, leadId, type: phone.type, isPrimary: phone.type === "PRIMARY" } }));
      changed.push(COLUMN_BY_FIELD[phoneField(phone.type)].header);
    } else if (sameSource && slot.phone !== phone.phone) {
      phones[phones.indexOf(slot)] = await prisma.leadPhone.update({ where: { id: slot.id }, data: fresh });
      changed.push(COLUMN_BY_FIELD[phoneField(phone.type)].header);
    }
  }
  if (!lead.phone) {
    const phone = phones.find((p) => p.type !== "COMPANY")?.phone;
    if (phone) data.phone = phone;
  }
  if (!lead.email && emails.length > 0) data.email = cut(emails[0].email, 191);

  if (ctx.tagIds.length > 0) {
    const added = await prisma.leadTag.createMany({ data: ctx.tagIds.map((tagId) => ({ leadId, tagId })), skipDuplicates: true });
    if (added.count > 0) changed.push("Tags");
  }

  if (Object.keys(data).length > 0) await prisma.lead.update({ where: { id: leadId }, data });

  const selection = await refreshOutreachEmail(leadId, { actor: IMPORT_ACTOR });
  if (lead.status === "IMPORTED" && selection.selected_email) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "READY_FOR_OUTREACH" } });
  }

  if (changed.length > 0) {
    await recordActivities([
      {
        leadId,
        type: "LEAD_UPDATED",
        title: `Updated from ${ctx.sourceLabel}`,
        detail: [sourceLine(ctx, row), `Changed: ${changed.join(", ")}`, ...notes].join("\n"),
        actor: IMPORT_ACTOR,
      },
    ]);
  }
  return changed;
}

function emailField(type: string): CrmField {
  return type === "PRIMARY" ? "email_primary" : type === "SECONDARY" ? "email_secondary" : "email_personal";
}

function phoneField(type: string): CrmField {
  if (type === "PRIMARY") return "phone_primary";
  if (type === "SECONDARY") return "phone_secondary";
  if (type === "TERTIARY") return "phone_tertiary";
  return "company_phone";
}

function matchLabel(level: string): string {
  return level in MATCH_LEVELS ? MATCH_LEVELS[level as MatchLevel].label.toLowerCase() : "the same source row";
}

interface KnownRow {
  id: string;
  sourceHash: string;
  leadId: string | null;
  outcome: string;
}

async function processRow(ctx: Context, row: ParsedRow, known: Map<string, KnownRow>): Promise<RowResult> {
  if (row.blank) return { outcome: "SKIPPED", leadId: null, matchLevel: null, message: "Empty row" };
  if (row.invalidReason) return { outcome: "INVALID", leadId: null, matchLevel: null, message: row.invalidReason };

  const keys = dedupeKeys(row);
  const earlier = ctx.file.find(keys, row.personKey);
  if (earlier) {
    return {
      repeat: true,
      outcome: "DUPLICATE",
      leadId: earlier.value.leadId,
      matchLevel: earlier.level,
      message: `Same contact as row ${earlier.value.rowNumber} (matched by ${matchLabel(earlier.level)}).`,
    };
  }

  const notes = row.warnings.length > 0 ? row.warnings.join(" ") : null;
  const previous = known.get(row.sourceKey);
  const previousLead = previous?.leadId ? await prisma.lead.findUnique({ where: { id: previous.leadId }, select: { id: true } }) : null;

  if (previous && previousLead && previous.sourceHash === row.sourceHash && ["CREATED", "UPDATED", "UNCHANGED"].includes(previous.outcome)) {
    ctx.file.add(keys, { rowNumber: row.rowNumber, leadId: previousLead.id }, row.personKey);
    return { outcome: "UNCHANGED", leadId: previousLead.id, matchLevel: "SOURCE_ROW", message: null };
  }

  const crmMatch = ctx.crm.find(keys, row.personKey);
  const match = previousLead ? { level: "SOURCE_ROW", value: previousLead.id } : crmMatch;

  let result: RowResult;
  if (match) {
    const by = `matched by ${matchLabel(match.level)}`;
    if (ctx.settings.duplicateMode === "SKIP") {
      result = { outcome: "DUPLICATE", leadId: match.value, matchLevel: match.level, message: `Already in the CRM (${by}); skipped.` };
    } else if (ctx.settings.duplicateMode === "REVIEW") {
      result = { outcome: "REVIEW", leadId: match.value, matchLevel: match.level, message: `Already in the CRM (${by}); waiting for review.` };
    } else {
      const changed = await updateLead(ctx, match.value, row);
      if (changed === null) {
        // The matched lead was deleted between the lookup and now.
        const leadId = await createLead(ctx, row);
        ctx.crm.add(keys, leadId, row.personKey);
        result = { outcome: "CREATED", leadId, matchLevel: null, message: notes };
      } else if (changed.length === 0) {
        result = { outcome: "UNCHANGED", leadId: match.value, matchLevel: match.level, message: `Already up to date (${by}).` };
      } else {
        result = {
          outcome: "UPDATED",
          leadId: match.value,
          matchLevel: match.level,
          message: [`Updated ${changed.join(", ")} (${by}).`, notes].filter(Boolean).join(" "),
        };
      }
    }
  } else {
    const leadId = await createLead(ctx, row);
    ctx.crm.add(keys, leadId, row.personKey);
    result = { outcome: "CREATED", leadId, matchLevel: null, message: notes };
  }

  ctx.file.add(keys, { rowNumber: row.rowNumber, leadId: result.leadId }, row.personKey);
  return result;
}

function count(counts: Counts, outcome: RowOutcome): void {
  if (outcome === "CREATED") counts.created++;
  else if (outcome === "UPDATED") counts.updated++;
  else if (outcome === "DUPLICATE" || outcome === "REVIEW") counts.duplicates++;
  else if (outcome === "INVALID") counts.invalid++;
  else if (outcome === "FAILED") counts.failed++;
  else counts.skipped++;
}

function countData(counts: Counts) {
  return {
    totalRows: counts.total,
    createdCount: counts.created,
    updatedCount: counts.updated,
    duplicateCount: counts.duplicates,
    invalidCount: counts.invalid,
    skippedCount: counts.skipped,
    failedCount: counts.failed,
    automationStarted: counts.automationStarted,
  };
}

// ─── The batch ──────────────────────────────────────────────────────────────

async function buildContext(
  batch: LeadImport & { worksheet: { spreadsheetId: string; spreadsheetName: string; worksheetId: number; worksheetTitle: string; leadSourceId: string | null } | null },
  settings: ImportSettings,
  rows: ParsedRow[]
): Promise<Context> {
  const warnings: string[] = [];
  const sourceName = batch.worksheet?.spreadsheetName ?? batch.label;
  const sourceWorksheet = batch.worksheet?.worksheetTitle ?? null;

  let leadSourceId = batch.leadSourceId ?? batch.worksheet?.leadSourceId ?? null;
  if (!leadSourceId) {
    const key = batch.worksheet
      ? `google_sheets:${batch.worksheet.spreadsheetId}:${batch.worksheet.worksheetId}`
      : `${batch.sourceType}:${batch.label.toLowerCase()}`;
    leadSourceId = await ensureLeadSource(batch.sourceType, [sourceName, sourceWorksheet].filter(Boolean).join(" › "), key);
    await prisma.leadImport.update({ where: { id: batch.id }, data: { leadSourceId } });
    if (batch.worksheetId) await prisma.googleSheetWorksheet.update({ where: { id: batch.worksheetId }, data: { leadSourceId } });
  }

  let automation: Context["automation"] = null;
  if (settings.autoStartAutomation && settings.automationId) {
    const found = await prisma.automation.findUnique({ where: { id: settings.automationId }, select: { id: true, name: true, status: true } });
    if (!found) warnings.push("The automation chosen for this import no longer exists; no automation was started.");
    else {
      automation = { id: found.id, name: found.name, active: found.status === "ACTIVE" };
      if (!automation.active) {
        warnings.push(`"${found.name}" is ${found.status.toLowerCase()}, so no automation was started. Activate it and start it from the lead list.`);
      }
    }
  }

  const [crm, companies, tagIds, assignees, cursor, suppression] = await Promise.all([
    loadCrmIndex(rows),
    loadCompanies(rows),
    ensureTags(settings.tags),
    loadAssignees(settings, warnings),
    readRoundRobinCursor(),
    loadSuppression(rows.flatMap((row) => row.emails.map((email) => email.emailKey))),
  ]);

  return {
    batch,
    settings,
    sourceLabel: leadSourceLabel(batch.sourceType),
    sourceName,
    sourceWorksheet,
    leadSourceId,
    crm,
    file: new DuplicateIndex<FileOwner>(),
    companies,
    suppression,
    tagIds,
    tagNames: settings.tags,
    assignees,
    cursor,
    automation,
    counts: { total: 0, created: 0, updated: 0, duplicates: 0, invalid: 0, skipped: 0, failed: 0, automationStarted: 0 },
    warnings,
  };
}

const batchInclude = {
  worksheet: true,
} as const;

/** Runs one import batch to the end. Called by the job queue. */
export async function runImport(importId: string): Promise<string> {
  const batch = await prisma.leadImport.findUnique({ where: { id: importId }, include: batchInclude });
  if (!batch) return "The import no longer exists";
  if (batch.status === "COMPLETED") return "Already completed";

  const startedAt = new Date();
  await prisma.leadImport.update({ where: { id: batch.id }, data: { status: "RUNNING", startedAt, error: null } });
  if (batch.worksheetId) {
    await prisma.googleSheetWorksheet.update({ where: { id: batch.worksheetId }, data: { syncStatus: "RUNNING", lastSyncAt: startedAt } });
  }

  try {
    const settings = parseImportSettings(batch.settings);
    const table = await loadTable(batch);
    const mapping = resolveMapping(settings, table.headers);
    if (Object.keys(mapping).length === 0) {
      throw new Error("None of the expected columns were found in the header row, so there is nothing to import.");
    }
    const rows = await parseTable(table, mapping, { checkDomains: settings.checkDomains });
    const quality: QualityReport = buildQualityReport(rows);
    const ctx = await buildContext(batch, settings, rows);

    // For a linked worksheet, rows that became leads are tracked across syncs
    // and updated in place; everything else (duplicates, invalid rows…) is the
    // log of one sync and is replaced by the next.
    const known = new Map<string, KnownRow>();
    if (batch.worksheetId) {
      await prisma.leadImportRow.deleteMany({
        where: { worksheetId: batch.worksheetId, outcome: { notIn: ["CREATED", "UPDATED", "UNCHANGED"] } },
      });
      const previous = await prisma.leadImportRow.findMany({
        where: { worksheetId: batch.worksheetId },
        select: { id: true, sourceKey: true, sourceHash: true, leadId: true, outcome: true },
      });
      for (const row of previous) if (!known.has(row.sourceKey)) known.set(row.sourceKey, row);
    }

    const toCreate: Prisma.LeadImportRowCreateManyInput[] = [];
    const unchanged: string[] = [];
    const flush = async () => {
      if (toCreate.length > 0) await prisma.leadImportRow.createMany({ data: toCreate.splice(0) });
      await prisma.leadImport.update({ where: { id: batch.id }, data: countData(ctx.counts) });
    };

    for (const row of rows) {
      if (row.blank) continue;
      ctx.counts.total++;

      let result: RowResult;
      try {
        result = await processRow(ctx, row, known);
      } catch (err) {
        result = { outcome: "FAILED", leadId: null, matchLevel: null, message: err instanceof Error ? err.message.slice(0, 500) : "Unknown error" };
      }
      count(ctx.counts, result.outcome);

      const previous = known.get(row.sourceKey);
      if (previous && result.outcome === "UNCHANGED") {
        unchanged.push(previous.id);
      } else {
        const record = {
          importId: batch.id,
          rowNumber: row.rowNumber,
          sourceHash: row.sourceHash,
          raw: row.raw,
          leadId: result.leadId,
          outcome: result.outcome,
          matchLevel: result.matchLevel,
          message: result.message,
          lastSyncedAt: new Date(),
        };
        // A repeated row shares its key with the row it repeats; it gets its own record.
        if (previous && !result.repeat) await prisma.leadImportRow.update({ where: { id: previous.id }, data: record });
        else toCreate.push({ ...record, worksheetId: batch.worksheetId, sourceKey: row.sourceKey });
      }
      if (ctx.counts.total % 25 === 0) await flush();
    }
    await flush();
    for (const chunk of chunks(unchanged)) {
      await prisma.leadImportRow.updateMany({ where: { id: { in: chunk } }, data: { lastSyncedAt: new Date() } });
    }
    if (ctx.assignees.length > 0) await writeRoundRobinCursor(ctx.cursor);

    const missingColumns = Object.values(COLUMN_BY_FIELD)
      .filter((column) => !mapping[column.field])
      .map((column) => column.header);
    const qualityJson: Prisma.InputJsonObject = { ...quality, warnings: ctx.warnings, missingColumns };

    const finishedAt = new Date();
    await prisma.leadImport.update({
      where: { id: batch.id },
      data: { status: "COMPLETED", finishedAt, payload: null, quality: qualityJson, ...countData(ctx.counts) },
    });
    if (batch.worksheet) {
      const interval = batch.worksheet.syncIntervalMinutes;
      await prisma.googleSheetWorksheet.update({
        where: { id: batch.worksheet.id },
        data: {
          syncStatus: "OK",
          lastSyncAt: finishedAt,
          lastSuccessfulSyncAt: finishedAt,
          nextSyncAt: interval > 0 ? new Date(finishedAt.getTime() + interval * 60_000) : null,
          lastError: null,
          rowsProcessed: ctx.counts.total,
          rowsCreated: ctx.counts.created,
          rowsUpdated: ctx.counts.updated,
          rowsSkipped: ctx.counts.skipped + ctx.counts.duplicates + ctx.counts.invalid,
          rowsFailed: ctx.counts.failed,
        },
      });
    }
    return `${ctx.counts.total} rows: ${ctx.counts.created} new, ${ctx.counts.updated} updated, ${ctx.counts.duplicates} duplicates, ${ctx.counts.invalid} invalid, ${ctx.counts.skipped} skipped, ${ctx.counts.failed} failed`;
  } catch (err) {
    const message = err instanceof Error ? err.message : "The import failed";
    await prisma.leadImport.update({ where: { id: batch.id }, data: { status: "FAILED", finishedAt: new Date(), error: message.slice(0, 2000) } });
    if (batch.worksheet) {
      const interval = batch.worksheet.syncIntervalMinutes;
      await prisma.googleSheetWorksheet.update({
        where: { id: batch.worksheet.id },
        data: {
          syncStatus: "ERROR",
          lastError: message.slice(0, 2000),
          // Keep the schedule going: a sheet that was briefly unreachable heals itself.
          nextSyncAt: interval > 0 ? new Date(Date.now() + interval * 60_000) : null,
        },
      });
    }
    throw err;
  }
}

// ─── Reviewing held duplicates ──────────────────────────────────────────────

export type ReviewDecision = "UPDATE" | "CREATE" | "DISMISS";

/** Resolves one row that "Ask for review" held back. */
export async function resolveReviewRow(rowId: string, decision: ReviewDecision): Promise<RowOutcome | null> {
  const record = await prisma.leadImportRow.findUnique({ where: { id: rowId }, include: { import: { include: batchInclude } } });
  if (!record || record.outcome !== "REVIEW") return null;

  let outcome: RowOutcome = "DUPLICATE";
  let leadId = record.leadId;
  let message = "Reviewed: kept the existing lead as it is.";

  if (decision !== "DISMISS") {
    const batch = record.import;
    const settings = parseImportSettings(batch.settings);
    const raw = record.raw as Record<string, string>;
    const headers = Object.keys(raw);
    const mapping = resolveMapping(settings, headers);
    const row = parseRow(headers, headers.map((header) => raw[header] ?? ""), mapping, record.rowNumber);
    const ctx = await buildContext(batch, { ...settings, duplicateMode: "UPDATE" }, [row]);

    if (decision === "UPDATE" && record.leadId) {
      const changed = await updateLead(ctx, record.leadId, row);
      if (changed === null) return null;
      outcome = changed.length > 0 ? "UPDATED" : "UNCHANGED";
      message = changed.length > 0 ? `Reviewed: updated ${changed.join(", ")}.` : "Reviewed: the lead was already up to date.";
    } else {
      leadId = await createLead(ctx, row);
      outcome = "CREATED";
      message = "Reviewed: created as a separate lead.";
    }
    if (ctx.assignees.length > 0) await writeRoundRobinCursor(ctx.cursor);
    if (ctx.counts.automationStarted > 0) {
      await prisma.leadImport.update({ where: { id: batch.id }, data: { automationStarted: { increment: ctx.counts.automationStarted } } });
    }
  }

  await prisma.$transaction([
    prisma.leadImportRow.update({ where: { id: record.id }, data: { outcome, leadId, message, lastSyncedAt: new Date() } }),
    prisma.leadImport.update({
      where: { id: record.importId },
      data:
        outcome === "CREATED"
          ? { duplicateCount: { decrement: 1 }, createdCount: { increment: 1 } }
          : outcome === "UPDATED"
            ? { duplicateCount: { decrement: 1 }, updatedCount: { increment: 1 } }
            : outcome === "UNCHANGED"
              ? { duplicateCount: { decrement: 1 }, skippedCount: { increment: 1 } }
              : {},
    }),
  ]);
  return outcome;
}
