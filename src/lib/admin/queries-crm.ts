import type { Campaign, Lead, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BOARD_STATUSES, LEAD_STATUSES, isBoardStatus, normalizeStatus, type LeadStatus } from "./leads";
import { PAGE_SIZE, safe, type Result } from "./queries";

/** Read side of the CRM additions: pipeline board, campaigns, assignees. */

const OFF_BOARD_STATUSES = LEAD_STATUSES.filter((status) => !isBoardStatus(status));

// ─── Pipeline board ─────────────────────────────────────────────────────────

export type BoardCard = Pick<
  Lead,
  "id" | "name" | "email" | "subject" | "company" | "priority" | "followUpAt" | "createdAt" | "status"
> & { assignedTo: { name: string | null; email: string } | null };

export interface BoardColumn {
  status: LeadStatus;
  total: number;
  cards: BoardCard[];
}

const BOARD_CARDS_PER_COLUMN = 25;

export function getLeadBoard(): Promise<Result<BoardColumn[]>> {
  return safe(async () => {
    // The board shows the stages a person works. Outreach stages (imported,
    // email sent…) are machine-driven and are left to the lead list, or a
    // thousand imported prospects would push every real conversation off it.
    const onBoard: Prisma.LeadWhereInput = { status: { notIn: OFF_BOARD_STATUSES } };
    // One query, bucketed in memory; the board caps what it shows per column.
    const [leads, counts] = await Promise.all([
      prisma.lead.findMany({
        where: onBoard,
        orderBy: { createdAt: "desc" },
        take: 400,
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          company: true,
          priority: true,
          followUpAt: true,
          createdAt: true,
          status: true,
          assignedTo: { select: { name: true, email: true } },
        },
      }),
      prisma.lead.groupBy({ by: ["status"], where: onBoard, _count: { _all: true } }),
    ]);

    const totals = new Map<LeadStatus, number>();
    for (const g of counts) {
      const key = normalizeStatus(g.status);
      totals.set(key, (totals.get(key) ?? 0) + g._count._all);
    }

    const columns: BoardColumn[] = BOARD_STATUSES.map((status) => ({
      status,
      total: totals.get(status) ?? 0,
      cards: [],
    }));
    const byStatus = new Map(columns.map((c) => [c.status, c]));
    for (const lead of leads) {
      const column = byStatus.get(normalizeStatus(lead.status));
      if (column && column.cards.length < BOARD_CARDS_PER_COLUMN) column.cards.push(lead);
    }
    return columns;
  });
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
export const CAMPAIGN_PLATFORMS = ["META", "GOOGLE", "LINKEDIN", "TIKTOK", "OTHER"] as const;

export type CampaignRow = Campaign & { leadCount: number };

export function listCampaigns(): Promise<Result<CampaignRow[]>> {
  return safe(async () => {
    const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
    const tags = campaigns.map((c) => c.utmCampaign).filter((v): v is string => Boolean(v));
    const counts =
      tags.length > 0
        ? await prisma.lead.groupBy({ by: ["utmCampaign"], where: { utmCampaign: { in: tags } }, _count: { _all: true } })
        : [];
    const byTag = new Map(counts.map((c) => [c.utmCampaign, c._count._all]));
    return campaigns.map((c) => ({ ...c, leadCount: c.utmCampaign ? (byTag.get(c.utmCampaign) ?? 0) : 0 }));
  });
}

export interface CampaignDetail {
  campaign: Campaign;
  leads: Pick<Lead, "id" | "name" | "email" | "subject" | "status" | "createdAt">[];
  leadCount: number;
}

export function getCampaign(id: string): Promise<Result<CampaignDetail | null>> {
  return safe(async () => {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return null;
    if (!campaign.utmCampaign) return { campaign, leads: [], leadCount: 0 };
    const where: Prisma.LeadWhereInput = { utmCampaign: campaign.utmCampaign };
    const [leads, leadCount] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
        select: { id: true, name: true, email: true, subject: true, status: true, createdAt: true },
      }),
      prisma.lead.count({ where }),
    ]);
    return { campaign, leads, leadCount };
  });
}

// ─── Assignees ──────────────────────────────────────────────────────────────

export interface Assignee {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

/** Accounts leads can be assigned to: everyone with an admin-capable role. */
export function listAssignees(): Promise<Result<Assignee[]>> {
  return safe(() =>
    prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER", "EDITOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    })
  );
}
