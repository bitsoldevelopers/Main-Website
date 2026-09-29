import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPLICATION_PREFIX, PROSPECT_SUBJECT, isLeadStatus } from "@/lib/admin/leads";
import { PAGE_SIZE, safe, type Paged, type Result } from "@/lib/admin/queries";
import { candidateEmails } from "./lead-contacts";
import { normalizeEmail } from "./normalize";
import { getBestOutreachEmail, type OutreachSelection } from "./outreach-email";
import { loadSuppression } from "./suppression";
import type { SuppressionReason } from "./outreach-email";

/** Read side of the lead list and the lead profile. */

const DAY = 86_400_000;

// ─── Filters ────────────────────────────────────────────────────────────────

export interface LeadListFilters {
  page: number;
  q?: string;
  status?: string;
  kind?: string;
  priority?: string;
  campaign?: string;
  assigned?: string;
  company?: string;
  title?: string;
  location?: string;
  source?: string;
  tag?: string;
  automation?: string;
  /** "yes" | "no" */
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
  /** "today" | "7" | "30" | "90" */
  created?: string;
  /** "never" | "7" | "30" | "older" */
  contacted?: string;
  /** "overdue" | "7" | "none" */
  followup?: string;
  importId?: string;
}

export const FILTER_KEYS = [
  "q",
  "status",
  "kind",
  "priority",
  "campaign",
  "assigned",
  "company",
  "title",
  "location",
  "source",
  "tag",
  "automation",
  "email",
  "phone",
  "linkedin",
  "website",
  "created",
  "contacted",
  "followup",
  "importId",
] as const satisfies readonly (keyof LeadListFilters)[];

function yesNo(value: string | undefined, yes: Prisma.LeadWhereInput, no: Prisma.LeadWhereInput): Prisma.LeadWhereInput | null {
  if (value === "yes") return yes;
  if (value === "no") return no;
  return null;
}

export function leadWhere(filters: Omit<LeadListFilters, "page">, now = new Date()): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [];

  if (filters.status && isLeadStatus(filters.status)) and.push({ status: filters.status });
  if (filters.kind === "application") and.push({ subject: { startsWith: APPLICATION_PREFIX } });
  else if (filters.kind === "prospect") and.push({ subject: PROSPECT_SUBJECT });
  else if (filters.kind === "inquiry") and.push({ NOT: [{ subject: { startsWith: APPLICATION_PREFIX } }, { subject: PROSPECT_SUBJECT }] });
  if (filters.priority) and.push({ priority: filters.priority });
  if (filters.campaign) and.push({ utmCampaign: filters.campaign });
  if (filters.assigned === "none") and.push({ assignedToId: null });
  else if (filters.assigned) and.push({ assignedToId: filters.assigned });
  if (filters.company) and.push({ company: { contains: filters.company } });
  if (filters.title) and.push({ jobTitle: { contains: filters.title } });
  if (filters.location) {
    and.push({
      OR: [{ contactLocation: { contains: filters.location } }, { city: { contains: filters.location } }, { country: { contains: filters.location } }],
    });
  }
  if (filters.source) and.push({ source: filters.source });
  if (filters.importId) and.push({ sourceImportId: filters.importId });
  if (filters.tag) and.push({ tags: { some: { tagId: filters.tag } } });

  if (filters.automation === "none") and.push({ runs: { none: {} } });
  else if (["ACTIVE", "PAUSED", "COMPLETED", "STOPPED", "FAILED"].includes(filters.automation ?? "")) {
    and.push({ runs: { some: { status: filters.automation } } });
  }

  const availability = [
    yesNo(filters.email, { OR: [{ email: { not: "" } }, { emails: { some: {} } }] }, { email: "", emails: { none: {} } }),
    yesNo(
      filters.phone,
      { OR: [{ AND: [{ phone: { not: null } }, { phone: { not: "" } }] }, { phones: { some: {} } }] },
      { OR: [{ phone: null }, { phone: "" }], phones: { none: {} } }
    ),
    yesNo(filters.linkedin, { AND: [{ linkedinUrl: { not: null } }, { linkedinUrl: { not: "" } }] }, { OR: [{ linkedinUrl: null }, { linkedinUrl: "" }] }),
    yesNo(filters.website, { AND: [{ website: { not: null } }, { website: { not: "" } }] }, { OR: [{ website: null }, { website: "" }] }),
  ];
  for (const clause of availability) if (clause) and.push(clause);

  const days = (n: number) => new Date(now.getTime() - n * DAY);
  if (filters.created === "today") and.push({ createdAt: { gte: days(1) } });
  else if (["7", "30", "90"].includes(filters.created ?? "")) and.push({ createdAt: { gte: days(Number(filters.created)) } });

  if (filters.contacted === "never") and.push({ lastContactedAt: null });
  else if (filters.contacted === "7" || filters.contacted === "30") and.push({ lastContactedAt: { gte: days(Number(filters.contacted)) } });
  else if (filters.contacted === "older") and.push({ lastContactedAt: { lt: days(30) } });

  if (filters.followup === "overdue") {
    and.push({ OR: [{ followUpAt: { lt: now } }, { nextFollowUpAt: { lt: now } }] });
  } else if (filters.followup === "7") {
    const until = new Date(now.getTime() + 7 * DAY);
    and.push({ OR: [{ followUpAt: { gte: now, lte: until } }, { nextFollowUpAt: { gte: now, lte: until } }] });
  } else if (filters.followup === "none") {
    and.push({ followUpAt: null, nextFollowUpAt: null });
  }

  const q = filters.q?.trim();
  if (q) {
    const digits = q.replace(/\D/g, "");
    const or: Prisma.LeadWhereInput[] = [
      { name: { contains: q } },
      { firstName: { contains: q } },
      { lastName: { contains: q } },
      { company: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { linkedinUrl: { contains: q } },
      { website: { contains: q } },
      { contactLocation: { contains: q } },
      { city: { contains: q } },
      { country: { contains: q } },
      { jobTitle: { contains: q } },
      { emails: { some: { emailKey: { contains: q.toLowerCase() } } } },
      { phones: { some: { phone: { contains: q } } } },
    ];
    // "415 555 1234" finds "+1 (415) 555-1234".
    if (digits.length >= 5) or.push({ phones: { some: { phoneKey: { contains: digits.slice(-10) } } } });
    // Two words: a first and a last name.
    const words = q.split(/\s+/).filter(Boolean);
    if (words.length === 2) or.push({ AND: [{ firstName: { contains: words[0] } }, { lastName: { contains: words[1] } }] });
    and.push({ OR: or });
  }

  return and.length > 0 ? { AND: and } : {};
}

// ─── List ───────────────────────────────────────────────────────────────────

const listSelect = {
  id: true,
  name: true,
  email: true,
  subject: true,
  message: true,
  status: true,
  priority: true,
  company: true,
  jobTitle: true,
  contactLocation: true,
  city: true,
  country: true,
  phone: true,
  linkedinUrl: true,
  website: true,
  source: true,
  outreachEmail: true,
  lastContactedAt: true,
  nextFollowUpAt: true,
  followUpAt: true,
  createdAt: true,
  assignedTo: { select: { id: true, name: true, email: true } },
  tags: { select: { tag: { select: { id: true, name: true } } }, take: 4 },
  runs: { orderBy: { startedAt: "desc" }, take: 1, select: { status: true, emailsSent: true, automation: { select: { name: true } } } },
  _count: { select: { phones: true, emails: true } },
} satisfies Prisma.LeadSelect;

export type LeadListRow = Prisma.LeadGetPayload<{ select: typeof listSelect }>;

export function listLeads(filters: LeadListFilters): Promise<Result<Paged<LeadListRow>>> {
  return safe(async () => {
    const where = leadWhere(filters);
    const [items, total] = await Promise.all([
      prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: listSelect }),
      prisma.lead.count({ where }),
    ]);
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export interface LeadFilterOptions {
  sources: string[];
  tags: { id: string; name: string }[];
  assignees: { id: string; name: string | null; email: string }[];
  automations: { id: string; name: string; status: string }[];
  counts: { all: number; inquiry: number; application: number; prospect: number };
}

export function getLeadFilterOptions(): Promise<Result<LeadFilterOptions>> {
  return safe(async () => {
    const [sources, tags, assignees, automations, all, application, prospect] = await Promise.all([
      prisma.lead.groupBy({ by: ["source"], _count: { _all: true } }),
      prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true }, take: 200 }),
      prisma.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER", "EDITOR"] } }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } }),
      prisma.automation.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
      prisma.lead.count(),
      prisma.lead.count({ where: { subject: { startsWith: APPLICATION_PREFIX } } }),
      prisma.lead.count({ where: { subject: PROSPECT_SUBJECT } }),
    ]);
    return {
      sources: sources.map((s) => s.source),
      tags,
      assignees,
      automations,
      counts: { all, application, prospect, inquiry: all - application - prospect },
    };
  });
}

// ─── Export ─────────────────────────────────────────────────────────────────

const exportInclude = {
  emails: true,
  phones: true,
  assignedTo: { select: { name: true, email: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.LeadInclude;

export type LeadExportRow = Prisma.LeadGetPayload<{ include: typeof exportInclude }>;

export const EXPORT_LIMIT = 5000;

export function leadsForExport(input: { ids?: string[]; filters?: Omit<LeadListFilters, "page"> }): Promise<LeadExportRow[]> {
  const where: Prisma.LeadWhereInput = input.ids?.length ? { id: { in: input.ids } } : leadWhere(input.filters ?? {});
  return prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, take: EXPORT_LIMIT, include: exportInclude });
}

// ─── Profile ────────────────────────────────────────────────────────────────

const profileInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  notes: { orderBy: { createdAt: "desc" } },
  emails: true,
  phones: true,
  tags: { include: { tag: true }, orderBy: { createdAt: "asc" } },
  leadSource: true,
  companyRef: {
    include: {
      leads: {
        orderBy: { createdAt: "asc" },
        take: 25,
        select: { id: true, name: true, jobTitle: true, status: true, outreachEmail: true, contactLocation: true },
      },
      _count: { select: { leads: true } },
    },
  },
  runs: {
    orderBy: { startedAt: "desc" },
    take: 5,
    include: { automation: { select: { id: true, name: true, status: true, _count: { select: { steps: true } } } } },
  },
  messages: {
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, subject: true, toEmail: true, status: true, stepOrder: true, sentAt: true, openedAt: true, repliedAt: true, bouncedAt: true, openCount: true, error: true, bodyText: true, provider: true, createdAt: true },
  },
  tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }], take: 20, include: { assignedTo: { select: { name: true, email: true } } } },
  followUps: { where: { status: "SCHEDULED" }, orderBy: { dueAt: "asc" }, take: 5 },
  activities: { orderBy: { createdAt: "desc" }, take: 80 },
} satisfies Prisma.LeadInclude;

export type LeadProfile = Prisma.LeadGetPayload<{ include: typeof profileInclude }>;

export interface LeadProfileData {
  lead: LeadProfile;
  /** What the engine would pick right now, with the reasons for what it skipped. */
  selection: OutreachSelection;
  /** Why each stored address may not be emailed, if it may not. */
  suppression: Record<string, SuppressionReason>;
  /** Other leads using one of this lead's addresses. */
  sharedEmails: Record<string, { id: string; name: string }[]>;
}

export function getLeadProfile(id: string): Promise<Result<LeadProfileData | null>> {
  return safe(async () => {
    const lead = await prisma.lead.findUnique({ where: { id }, include: profileInclude });
    if (!lead) return null;

    const candidates = candidateEmails(lead);
    const keys = candidates.map((c) => c.emailKey);
    const lookup = await loadSuppression(keys);
    const suppression: Record<string, SuppressionReason> = {};
    for (const key of keys) {
      const reason = lookup(key);
      if (reason) suppression[key] = reason;
    }

    const sharedEmails: Record<string, { id: string; name: string }[]> = {};
    if (keys.length > 0) {
      const [stored, legacy] = await Promise.all([
        prisma.leadEmail.findMany({ where: { emailKey: { in: keys }, NOT: { leadId: id } }, select: { emailKey: true, lead: { select: { id: true, name: true } } }, take: 20 }),
        prisma.lead.findMany({ where: { email: { in: keys }, NOT: { id } }, select: { id: true, name: true, email: true }, take: 20 }),
      ]);
      const add = (key: string, other: { id: string; name: string }) => {
        const list = (sharedEmails[key] ??= []);
        if (!list.some((l) => l.id === other.id)) list.push(other);
      };
      for (const row of stored) add(row.emailKey, row.lead);
      for (const row of legacy) add(normalizeEmail(row.email), { id: row.id, name: row.name });
    }

    return {
      lead,
      selection: getBestOutreachEmail({ emails: candidates }, { suppression: lookup, locked: lead.outreachLocked }),
      suppression,
      sharedEmails,
    };
  });
}

// ─── Companies ──────────────────────────────────────────────────────────────

const companyInclude = {
  leads: {
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, jobTitle: true, status: true, outreachEmail: true, email: true, phone: true, contactLocation: true, linkedinUrl: true, lastContactedAt: true },
  },
} satisfies Prisma.CompanyInclude;

export type CompanyDetail = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>;

export function getCompany(id: string): Promise<Result<CompanyDetail | null>> {
  return safe(() => prisma.company.findUnique({ where: { id }, include: companyInclude }));
}

export type CompanyRow = Prisma.CompanyGetPayload<{ include: { _count: { select: { leads: true } } } }>;

export function listCompanies(filters: { page: number; q?: string }): Promise<Result<Paged<CompanyRow>>> {
  return safe(async () => {
    const where: Prisma.CompanyWhereInput = filters.q
      ? { OR: [{ name: { contains: filters.q } }, { domain: { contains: filters.q.toLowerCase() } }, { description: { contains: filters.q } }] }
      : {};
    const [items, total] = await Promise.all([
      prisma.company.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { leads: true } } } }),
      prisma.company.count({ where }),
    ]);
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}
