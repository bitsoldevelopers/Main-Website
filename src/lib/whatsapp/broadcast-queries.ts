import type { Broadcast, BroadcastRecipient, Prisma, WhatsappTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { safe, type Result } from "@/lib/admin/queries";
import { readVariables } from "./templates";

/**
 * Reads for Admin → Chatbot → Templates and Broadcasts. Every function
 * returns a `Result` so a page can show "database unreachable" instead of a
 * 500, the same contract as the rest of the admin.
 */

/** A template as the broadcast composer needs it: approved, with its placeholders. */
export interface ComposerTemplate {
  id: string;
  name: string;
  metaName: string;
  languageCode: string;
  body: string;
  headerText: string | null;
  /** TEXT, IMAGE, VIDEO, DOCUMENT, or null when the template has no header. */
  headerFormat: string | null;
  footerText: string | null;
  variables: string[];
}

function toComposerTemplate(row: WhatsappTemplate): ComposerTemplate {
  return {
    id: row.id,
    name: row.name,
    metaName: row.metaName,
    languageCode: row.languageCode,
    body: row.body,
    headerText: row.headerText,
    headerFormat: row.headerFormat,
    footerText: row.footerText,
    variables: readVariables(row.variables),
  };
}

/** Only an approved template can open a conversation outside the 24-hour window. */
async function approvedTemplates(): Promise<ComposerTemplate[]> {
  const rows = await prisma.whatsappTemplate.findMany({
    where: { status: "APPROVED", metaId: { not: null } },
    orderBy: { name: "asc" },
  });
  return rows.map(toComposerTemplate);
}

export type TemplateRow = Omit<WhatsappTemplate, "variables"> & { variables: string[] };

export interface TemplateList {
  templates: TemplateRow[];
  approved: number;
  pending: number;
  lastSyncedAt: Date | null;
}

export function listTemplates(): Promise<Result<TemplateList>> {
  return safe(async () => {
    const rows = await prisma.whatsappTemplate.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] });
    const templates = rows.map((row) => ({ ...row, variables: readVariables(row.variables) }));
    const lastSyncedAt = rows.reduce<Date | null>((latest, row) => (row.syncedAt && (!latest || row.syncedAt > latest) ? row.syncedAt : latest), null);
    return {
      templates,
      approved: templates.filter((row) => row.status === "APPROVED").length,
      pending: templates.filter((row) => row.status === "PENDING").length,
      lastSyncedAt,
    };
  });
}

const broadcastListArgs = { include: { template: { select: { name: true, status: true } } } } satisfies Prisma.BroadcastDefaultArgs;
export type BroadcastRow = Prisma.BroadcastGetPayload<typeof broadcastListArgs>;

export interface BroadcastList {
  broadcasts: BroadcastRow[];
  /** Recipients still to be messaged, per broadcast: what Send and Retry act on. */
  pending: Record<string, number>;
  sentCount: number;
  delivered: number;
  templates: ComposerTemplate[];
}

export function listBroadcasts(): Promise<Result<BroadcastList>> {
  return safe(async () => {
    const [broadcasts, sentCount, reach, templates, waiting] = await Promise.all([
      prisma.broadcast.findMany({ ...broadcastListArgs, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.broadcast.count({ where: { status: "SENT" } }),
      prisma.broadcast.aggregate({ _sum: { delivered: true } }),
      approvedTemplates(),
      prisma.broadcastRecipient.groupBy({ by: ["broadcastId"], where: { status: { in: ["PENDING", "FAILED"] } }, _count: { _all: true } }),
    ]);
    return {
      broadcasts,
      pending: Object.fromEntries(waiting.map((row) => [row.broadcastId, row._count._all])),
      sentCount,
      delivered: reach._sum.delivered ?? 0,
      templates,
    };
  });
}

export type BroadcastDetail = Broadcast & { template: Pick<WhatsappTemplate, "name" | "metaName" | "status" | "body"> | null };

export interface BroadcastView {
  broadcast: BroadcastDetail;
  recipients: BroadcastRecipient[];
  pending: number;
}

/** One broadcast with its recipients, failures first. */
export function getBroadcast(id: string): Promise<Result<BroadcastView | null>> {
  return safe(async () => {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: { template: { select: { name: true, metaName: true, status: true, body: true } } },
    });
    if (!broadcast) return null;
    const [recipients, pending] = await Promise.all([
      prisma.broadcastRecipient.findMany({
        where: { broadcastId: id },
        // Failures first, then everyone still waiting, then the rest.
        orderBy: [{ status: "asc" }, { sentAt: "desc" }],
        take: 500,
      }),
      prisma.broadcastRecipient.count({ where: { broadcastId: id, status: { in: ["PENDING", "FAILED"] } } }),
    ]);
    return { broadcast, recipients, pending };
  });
}
