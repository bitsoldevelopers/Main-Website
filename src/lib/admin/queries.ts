import type { Prisma, Blog, Course, Lead, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { APPLICATION_PREFIX, LEAD_STATUSES, PROSPECT_SUBJECT, isBoardStatus, isLeadStatus, leadTopic, normalizeStatus, type LeadStatus } from "./leads";

/**
 * Read side of the admin. Every query is wrapped so that a database outage
 * renders a "database unreachable" panel instead of crashing the page: the
 * public site already degrades the same way (see app/(site)/page.tsx).
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export const PAGE_SIZE = 20;

function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.find((l) => /database|connect|denied|timeout|reach/i.test(l)) ?? lines[0] ?? "Unknown error";
}

/**
 * A database outage would otherwise log a full Prisma stack for every panel
 * on every request, and the dev overlay surfaces each console.error as a
 * red toast. Warn once per distinct message per process instead; the page
 * shows the same message in its "Database unreachable" panel.
 */
const reported = new Set<string>();

export async function safe<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    const message = errorMessage(err);
    if (!reported.has(message)) {
      reported.add(message);
      console.warn(`[admin] database query failed: ${message}`);
    }
    return { ok: false, error: message };
  }
}

export function pageFrom(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function paramFrom(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

// ─── Shell ──────────────────────────────────────────────────────────────────

export interface ShellStatus {
  dbOk: boolean;
  newLeads: number;
  drafts: number;
}

export async function getShellStatus(): Promise<ShellStatus> {
  const res = await safe(async () => {
    const [newLeads, drafts] = await Promise.all([
      prisma.lead.count({ where: { status: "NEW" } }),
      prisma.blog.count({ where: { published: false } }),
    ]);
    return { newLeads, drafts };
  });
  return res.ok ? { dbOk: true, ...res.data } : { dbOk: false, newLeads: 0, drafts: 0 };
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export type RecentLead = Pick<Lead, "id" | "name" | "email" | "subject" | "status" | "createdAt">;
export type RecentPost = Pick<Blog, "id" | "title" | "slug" | "author" | "published" | "createdAt">;

export interface DashboardData {
  leads: {
    total: number;
    fresh: number;
    last7: number;
    applications: number;
    byStatus: { status: LeadStatus; count: number }[];
    byTopic: { label: string; count: number }[];
  };
  posts: {
    total: number;
    published: number;
    drafts: number;
    last30: number;
    byMonth: { label: string; count: number }[];
  };
  courses: number;
  users: number;
  recentLeads: RecentLead[];
  recentPosts: RecentPost[];
}

export function getDashboard(): Promise<Result<DashboardData>> {
  return safe(async () => {
    const now = new Date();
    const since7 = new Date(now.getTime() - 7 * 86_400_000);
    const since30 = new Date(now.getTime() - 30 * 86_400_000);
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    // "What came in" means people who wrote to us. Imported prospects have
    // their own overview under Lead Automation.
    const inbound = { NOT: { subject: PROSPECT_SUBJECT } };

    const [
      leadTotal,
      leadFresh,
      lead7,
      applications,
      statusGroups,
      topicGroups,
      postTotal,
      postPublished,
      post30,
      postDates,
      courses,
      users,
      recentLeads,
      recentPosts,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "NEW" } }),
      prisma.lead.count({ where: { ...inbound, createdAt: { gte: since7 } } }),
      prisma.lead.count({ where: { subject: { startsWith: APPLICATION_PREFIX } } }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.lead.groupBy({
        by: ["subject"],
        where: inbound,
        _count: { _all: true },
        orderBy: { _count: { subject: "desc" } },
        take: 6,
      }),
      prisma.blog.count(),
      prisma.blog.count({ where: { published: true } }),
      prisma.blog.count({ where: { createdAt: { gte: since30 } } }),
      prisma.blog.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      prisma.course.count(),
      prisma.user.count(),
      prisma.lead.findMany({
        where: inbound,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, email: true, subject: true, status: true, createdAt: true },
      }),
      prisma.blog.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, title: true, slug: true, author: true, published: true, createdAt: true },
      }),
    ]);

    // Merge free-text statuses onto the known set so the breakdown is stable.
    const statusCounts = new Map<LeadStatus, number>();
    for (const g of statusGroups) {
      const key = normalizeStatus(g.status);
      statusCounts.set(key, (statusCounts.get(key) ?? 0) + g._count._all);
    }
    // The pipeline stages always show; outreach stages (imported, email
    // sent…) only once a lead is in them, so an empty CRM stays readable.
    const byStatus = LEAD_STATUSES.map((status) => ({
      status,
      count: statusCounts.get(status) ?? 0,
    })).filter((row) => row.count > 0 || isBoardStatus(row.status));

    const byTopic = topicGroups.map((g) => ({ label: leadTopic(g.subject), count: g._count._all }));

    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString("en-US", { month: "short" }),
        count: 0,
      });
    }
    for (const p of postDates) {
      const d = new Date(p.createdAt);
      const bucket = months.find((m) => m.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (bucket) bucket.count += 1;
    }

    return {
      leads: { total: leadTotal, fresh: leadFresh, last7: lead7, applications, byStatus, byTopic },
      posts: {
        total: postTotal,
        published: postPublished,
        drafts: postTotal - postPublished,
        last30: post30,
        byMonth: months.map(({ label, count }) => ({ label, count })),
      },
      courses,
      users,
      recentLeads,
      recentPosts,
    };
  });
}

// ─── Leads ──────────────────────────────────────────────────────────────────

export interface LeadFilters {
  page: number;
  status?: string;
  kind?: string;
  q?: string;
  priority?: string;
  campaign?: string;
  assigned?: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

export type LeadRow = Lead & { assignedTo: { id: string; name: string | null; email: string } | null };

function leadWhere(filters: Omit<LeadFilters, "page">): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};
  if (filters.status && isLeadStatus(filters.status)) where.status = filters.status;
  if (filters.kind === "application") where.subject = { startsWith: APPLICATION_PREFIX };
  else if (filters.kind === "inquiry") where.NOT = { subject: { startsWith: APPLICATION_PREFIX } };
  if (filters.priority) where.priority = filters.priority;
  if (filters.campaign) where.utmCampaign = filters.campaign;
  if (filters.assigned) where.assignedToId = filters.assigned;
  if (filters.q) {
    where.OR = [
      { name: { contains: filters.q } },
      { email: { contains: filters.q } },
      { subject: { contains: filters.q } },
      { message: { contains: filters.q } },
      { company: { contains: filters.q } },
      { phone: { contains: filters.q } },
    ];
  }
  return where;
}

export function listLeads(filters: LeadFilters): Promise<Result<Paged<LeadRow>>> {
  return safe(async () => {
    const where = leadWhere(filters);
    const page = filters.page;
    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { assignedTo: { select: { id: true, name: true, email: true } } },
      }),
      prisma.lead.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export type LeadDetail = Lead & {
  assignedTo: { id: string; name: string | null; email: string } | null;
  notes: { id: string; author: string; body: string; createdAt: Date }[];
};

export function getLead(id: string): Promise<Result<LeadDetail | null>> {
  return safe(() =>
    prisma.lead.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        notes: { orderBy: { createdAt: "desc" } },
      },
    })
  );
}

// ─── Blog ───────────────────────────────────────────────────────────────────

export interface PostFilters {
  page: number;
  q?: string;
  status?: string; // all | published | draft
}

export type PostRow = Pick<
  Blog,
  "id" | "title" | "slug" | "author" | "image" | "excerpt" | "tags" | "published" | "createdAt" | "updatedAt"
>;

export function listPosts(filters: PostFilters): Promise<Result<Paged<PostRow>>> {
  return safe(async () => {
    const where: Prisma.BlogWhereInput = {};
    if (filters.status === "published") where.published = true;
    else if (filters.status === "draft") where.published = false;
    if (filters.q) {
      where.OR = [{ title: { contains: filters.q } }, { slug: { contains: filters.q } }, { author: { contains: filters.q } }];
    }
    const page = filters.page;
    const [items, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        // Article HTML is left out of the listing: it is the bulk of the table.
        select: {
          id: true,
          title: true,
          slug: true,
          author: true,
          image: true,
          excerpt: true,
          tags: true,
          published: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.blog.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export function getPost(id: string): Promise<Result<Blog | null>> {
  return safe(() => prisma.blog.findUnique({ where: { id } }));
}

export function getBlogCounts(): Promise<Result<{ total: number; published: number }>> {
  return safe(async () => {
    const [total, published] = await Promise.all([prisma.blog.count(), prisma.blog.count({ where: { published: true } })]);
    return { total, published };
  });
}

export interface BlogSeoGaps {
  published: number;
  missingMeta: number;
  missingExcerpt: number;
  missingImage: number;
  untagged: number;
}

/** Published posts missing the fields the article template uses for SEO. */
export function getBlogSeoGaps(): Promise<Result<BlogSeoGaps>> {
  return safe(async () => {
    const live = { published: true } as const;
    const [published, missingMeta, missingExcerpt, missingImage, untagged] = await Promise.all([
      prisma.blog.count({ where: live }),
      prisma.blog.count({ where: { ...live, OR: [{ metaDescription: null }, { metaDescription: "" }] } }),
      prisma.blog.count({ where: { ...live, OR: [{ excerpt: null }, { excerpt: "" }] } }),
      prisma.blog.count({ where: { ...live, OR: [{ image: null }, { image: "" }] } }),
      prisma.blog.count({ where: { ...live, tags: { equals: [] } } }),
    ]);
    return { published, missingMeta, missingExcerpt, missingImage, untagged };
  });
}

// ─── Courses ────────────────────────────────────────────────────────────────

export type CourseRow = Course & { _count: { students: number } };

export function listCourses(): Promise<Result<CourseRow[]>> {
  return safe(() =>
    prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { students: true } } },
    })
  );
}

export function getCourse(id: string): Promise<Result<Course | null>> {
  return safe(() => prisma.course.findUnique({ where: { id } }));
}

// ─── Users ──────────────────────────────────────────────────────────────────

export type UserRow = Pick<User, "id" | "email" | "name" | "role" | "createdAt"> & { _count: { courses: number } };

export function listUsers(): Promise<Result<UserRow[]>> {
  return safe(() =>
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        _count: { select: { courses: true } },
      },
    })
  );
}

// ─── Settings / health ──────────────────────────────────────────────────────

export function pingDatabase(): Promise<Result<{ latencyMs: number }>> {
  return safe(async () => {
    const started = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { latencyMs: Date.now() - started };
  });
}

export interface IntegrationFlag {
  key: string;
  label: string;
  configured: boolean;
  usedBy: string;
}

/** Only whether each secret is set, never its value. */
export function integrationFlags(): IntegrationFlag[] {
  const has = (key: string) => Boolean(process.env[key]);
  return [
    { key: "DATABASE_URL", label: "MySQL database", configured: has("DATABASE_URL"), usedBy: "Blog, leads, courses, users" },
    { key: "ADMIN_SECRET", label: "Admin password", configured: has("ADMIN_SECRET"), usedBy: "This admin panel" },
    {
      key: "BLOG_API_KEY",
      label: "Blog API key",
      configured: has("BLOG_API_KEY"),
      usedBy: "POST /api/blog from the content automation",
    },
    {
      key: "RESEND_API_KEY",
      label: "Resend email",
      configured: has("RESEND_API_KEY") && process.env.RESEND_API_KEY !== "re_dummy",
      usedBy: "Lead and application notifications",
    },
    {
      key: "GEMINI_API_KEY",
      label: "AI writing (free tier)",
      configured: has("GEMINI_API_KEY") || has("GROQ_API_KEY") || has("OPENROUTER_API_KEY"),
      usedBy: "Drafting short posts in Social. Not used for articles.",
    },
    {
      key: "LINKEDIN_CLIENT_ID",
      label: "LinkedIn app",
      configured: has("LINKEDIN_CLIENT_ID") && has("LINKEDIN_CLIENT_SECRET") && has("LINKEDIN_COMPANY_ID"),
      usedBy: "Connecting the company page in Social",
    },
    {
      key: "FACEBOOK_APP_ID",
      label: "Facebook app",
      configured: has("FACEBOOK_APP_ID") && has("FACEBOOK_APP_SECRET"),
      usedBy: "Connecting the Facebook Page in Social",
    },
    {
      key: "TWITTER_API_KEY",
      label: "X / Twitter",
      configured: has("TWITTER_API_KEY") && has("TWITTER_ACCESS_TOKEN"),
      usedBy: "scripts/post-to-twitter.mjs",
    },
  ];
}
