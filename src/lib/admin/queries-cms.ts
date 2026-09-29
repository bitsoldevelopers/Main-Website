import type { ActivityLog, Faq, Media, Prisma, Redirect, Testimonial } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, safe, type Paged, type Result } from "./queries";

/** Read side of the CMS additions: testimonials, FAQs, media, redirects, audit log. */

// ─── Testimonials & FAQs ────────────────────────────────────────────────────

export function listTestimonials(): Promise<Result<Testimonial[]>> {
  return safe(() => prisma.testimonial.findMany({ orderBy: [{ order: "asc" }, { createdAt: "asc" }] }));
}

export function getTestimonial(id: string): Promise<Result<Testimonial | null>> {
  return safe(() => prisma.testimonial.findUnique({ where: { id } }));
}

export const FAQ_PAGES = ["home"] as const;

export function listFaqs(page?: string): Promise<Result<Faq[]>> {
  return safe(() =>
    prisma.faq.findMany({
      where: page ? { page } : undefined,
      orderBy: [{ page: "asc" }, { order: "asc" }, { createdAt: "asc" }],
    })
  );
}

export function getFaq(id: string): Promise<Result<Faq | null>> {
  return safe(() => prisma.faq.findUnique({ where: { id } }));
}

// ─── Media ──────────────────────────────────────────────────────────────────

export interface MediaFilters {
  page: number;
  q?: string;
  type?: string; // image | video | document
}

export function listMedia(filters: MediaFilters): Promise<Result<Paged<Media>>> {
  return safe(async () => {
    const where: Prisma.MediaWhereInput = {};
    if (filters.type === "image") where.mime = { startsWith: "image/" };
    else if (filters.type === "video") where.mime = { startsWith: "video/" };
    else if (filters.type === "document") where.NOT = [{ mime: { startsWith: "image/" } }, { mime: { startsWith: "video/" } }];
    if (filters.q) {
      where.OR = [{ filename: { contains: filters.q } }, { alt: { contains: filters.q } }, { path: { contains: filters.q } }];
    }
    const page = filters.page;
    const [items, total] = await Promise.all([
      prisma.media.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE * 2, take: PAGE_SIZE * 2 }),
      prisma.media.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / (PAGE_SIZE * 2))) };
  });
}

// ─── Redirects ──────────────────────────────────────────────────────────────

export function listRedirects(): Promise<Result<Redirect[]>> {
  return safe(() => prisma.redirect.findMany({ orderBy: { createdAt: "desc" } }));
}

// ─── Activity log ───────────────────────────────────────────────────────────

export interface ActivityFilters {
  page: number;
  entity?: string;
  q?: string;
}

export function listActivity(filters: ActivityFilters): Promise<Result<Paged<ActivityLog>>> {
  return safe(async () => {
    const where: Prisma.ActivityLogWhereInput = {};
    if (filters.entity) where.entity = filters.entity;
    if (filters.q) {
      where.OR = [
        { actor: { contains: filters.q } },
        { action: { contains: filters.q } },
        { detail: { contains: filters.q } },
        { entityId: filters.q },
      ];
    }
    const page = filters.page;
    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50 }),
      prisma.activityLog.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / 50)) };
  });
}

export function recentActivity(take = 8): Promise<Result<ActivityLog[]>> {
  return safe(() => prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take }));
}

/** Distinct entities present in the log, for the filter tabs. */
export function activityEntities(): Promise<Result<string[]>> {
  return safe(async () => {
    const rows = await prisma.activityLog.groupBy({ by: ["entity"], orderBy: { entity: "asc" } });
    return rows.map((r) => r.entity);
  });
}

// ─── Platform counters for the dashboard ────────────────────────────────────

export interface PlatformCounts {
  campaigns: number;
  activeCampaigns: number;
  media: number;
  redirects: number;
  testimonials: number;
  faqs: number;
}

export function getPlatformCounts(): Promise<Result<PlatformCounts>> {
  return safe(async () => {
    const [campaigns, activeCampaigns, media, redirects, testimonials, faqs] = await Promise.all([
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: "ACTIVE" } }),
      prisma.media.count(),
      prisma.redirect.count({ where: { active: true } }),
      prisma.testimonial.count(),
      prisma.faq.count(),
    ]);
    return { campaigns, activeCampaigns, media, redirects, testimonials, faqs };
  });
}
