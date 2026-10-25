import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE, safe, type Paged, type Result } from "@/lib/admin/queries";

/**
 * Read side of Admin → Chatbot. Every query is wrapped so that a database
 * outage renders a "database unreachable" panel instead of crashing the page.
 */

// ─── Conversations ──────────────────────────────────────────────────────────

export type ConversationFilter = "all" | "web" | "whatsapp" | "handoff" | "leads";

export interface ConversationFilters {
  page: number;
  filter: ConversationFilter;
  q?: string;
}

const conversationListArgs = {
  include: {
    _count: { select: { messages: true, requests: true } },
    lead: { select: { id: true, name: true, status: true } },
    messages: { orderBy: { createdAt: "desc" as const }, take: 1, select: { content: true, role: true } },
  },
} satisfies Prisma.ChatConversationDefaultArgs;

export type ConversationRow = Prisma.ChatConversationGetPayload<typeof conversationListArgs>;

function conversationWhere(filters: ConversationFilters): Prisma.ChatConversationWhereInput {
  const where: Prisma.ChatConversationWhereInput = {};
  if (filters.filter === "web") where.channel = "WEB";
  if (filters.filter === "whatsapp") where.channel = "WHATSAPP";
  if (filters.filter === "handoff") where.handedOff = true;
  if (filters.filter === "leads") where.leadId = { not: null };
  if (filters.q) {
    where.OR = [
      { reference: { contains: filters.q } },
      { contactName: { contains: filters.q } },
      { contactPhone: { contains: filters.q } },
      { title: { contains: filters.q } },
      { lead: { name: { contains: filters.q } } },
    ];
  }
  return where;
}

export function listConversations(filters: ConversationFilters): Promise<Result<Paged<ConversationRow>>> {
  return safe(async () => {
    const where = conversationWhere(filters);
    const page = filters.page;
    const [items, total] = await Promise.all([
      prisma.chatConversation.findMany({
        where,
        ...conversationListArgs,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.chatConversation.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export interface ConversationStats {
  total: number;
  web: number;
  whatsapp: number;
  handoffs: number;
  today: number;
  withLead: number;
}

export function conversationStats(): Promise<Result<ConversationStats>> {
  return safe(async () => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [total, web, whatsapp, handoffs, today, withLead] = await Promise.all([
      prisma.chatConversation.count(),
      prisma.chatConversation.count({ where: { channel: "WEB" } }),
      prisma.chatConversation.count({ where: { channel: "WHATSAPP" } }),
      prisma.chatConversation.count({ where: { handedOff: true } }),
      prisma.chatConversation.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.chatConversation.count({ where: { leadId: { not: null } } }),
    ]);
    return { total, web, whatsapp, handoffs, today, withLead };
  });
}

const conversationDetailArgs = {
  include: {
    messages: { orderBy: { createdAt: "asc" as const } },
    requests: { select: { id: true, reference: true, kind: true, status: true } },
    lead: { select: { id: true, name: true, status: true, chatProfile: { select: { reference: true, score: true, temperature: true } } } },
  },
} satisfies Prisma.ChatConversationDefaultArgs;

export type ConversationDetail = Prisma.ChatConversationGetPayload<typeof conversationDetailArgs>;

export function getConversation(id: string): Promise<Result<ConversationDetail | null>> {
  return safe(() => prisma.chatConversation.findUnique({ where: { id }, ...conversationDetailArgs }));
}

export interface ConversationSide {
  authors: Map<string, string>;
  contact: { lastInboundAt: Date | null; optedOut: boolean; isBlocked: boolean } | null;
}

/** Who wrote the staff messages, and the WhatsApp contact's reply window. */
export function conversationSide(authorIds: string[], contactPhone: string | null): Promise<Result<ConversationSide>> {
  return safe(async () => {
    const [users, contact] = await Promise.all([
      authorIds.length
        ? prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } })
        : Promise.resolve([]),
      contactPhone
        ? prisma.whatsappContact.findUnique({
            where: { waId: contactPhone.replace(/\D/g, "") },
            select: { lastInboundAt: true, optedOut: true, isBlocked: true },
          })
        : Promise.resolve(null),
    ]);
    return { authors: new Map(users.map((u) => [u.id, u.name ?? u.email])), contact };
  });
}

/** The chatbot conversations a lead came from, for the lead profile page. */
export function conversationsForLead(leadId: string): Promise<Result<Array<{ id: string; reference: string; channel: string; updatedAt: Date; messages: number }>>> {
  return safe(async () => {
    const rows = await prisma.chatConversation.findMany({
      where: { leadId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, reference: true, channel: true, updatedAt: true, _count: { select: { messages: true } } },
    });
    return rows.map((row) => ({ id: row.id, reference: row.reference, channel: row.channel, updatedAt: row.updatedAt, messages: row._count.messages }));
  });
}

// ─── Knowledge base ─────────────────────────────────────────────────────────

export interface KnowledgeList {
  entries: Prisma.ChatKnowledgeGetPayload<Record<string, never>>[];
  categories: { category: string; count: number }[];
  states: { state: string; count: number }[];
}

export function listKnowledge(filters: { category?: string; q?: string } = {}): Promise<Result<KnowledgeList>> {
  return safe(async () => {
    const where: Prisma.ChatKnowledgeWhereInput = {};
    if (filters.category) where.category = filters.category;
    if (filters.q) where.OR = [{ question: { contains: filters.q } }, { answer: { contains: filters.q } }, { slug: { contains: filters.q } }];
    const [entries, categories, states] = await Promise.all([
      prisma.chatKnowledge.findMany({ where, orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }], take: 300 }),
      prisma.chatKnowledge.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { category: "asc" } }),
      prisma.chatKnowledge.groupBy({ by: ["state"], _count: { _all: true } }),
    ]);
    return {
      entries,
      categories: categories.map((c) => ({ category: c.category, count: c._count._all })),
      states: states.map((s) => ({ state: s.state, count: s._count._all })),
    };
  });
}

export function getKnowledge(id: string) {
  return safe(() => prisma.chatKnowledge.findUnique({ where: { id } }));
}

// ─── Tickets & meetings ─────────────────────────────────────────────────────

export type RequestKind = "TICKET" | "MEETING";

export interface RequestFilters {
  page: number;
  kind?: RequestKind;
  status?: string;
}

const requestArgs = {
  include: {
    lead: { select: { id: true, name: true } },
    conversation: { select: { id: true, reference: true, channel: true } },
  },
} satisfies Prisma.ChatRequestDefaultArgs;

export type RequestRow = Prisma.ChatRequestGetPayload<typeof requestArgs>;

export function listRequests(filters: RequestFilters): Promise<Result<Paged<RequestRow>>> {
  return safe(async () => {
    const where: Prisma.ChatRequestWhereInput = {};
    if (filters.kind) where.kind = filters.kind;
    if (filters.status) where.status = filters.status;
    const page = filters.page;
    const [items, total] = await Promise.all([
      prisma.chatRequest.findMany({ where, ...requestArgs, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.chatRequest.count({ where }),
    ]);
    return { items, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export interface RequestCounts {
  openTickets: number;
  pendingMeetings: number;
  tickets: number;
  meetings: number;
}

export function requestCounts(): Promise<Result<RequestCounts>> {
  return safe(async () => {
    const [openTickets, pendingMeetings, tickets, meetings] = await Promise.all([
      prisma.chatRequest.count({ where: { kind: "TICKET", status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
      prisma.chatRequest.count({ where: { kind: "MEETING", status: { in: ["REQUESTED", "RESCHEDULED"] } } }),
      prisma.chatRequest.count({ where: { kind: "TICKET" } }),
      prisma.chatRequest.count({ where: { kind: "MEETING" } }),
    ]);
    return { openTickets, pendingMeetings, tickets, meetings };
  });
}

// ─── Setup ──────────────────────────────────────────────────────────────────

export interface ChatbotHealth {
  knowledgeRows: number;
  knowledgePublished: number;
  customisedSections: number;
  recentQuestions: { id: string; content: string; language: string | null; createdAt: Date; conversationId: string }[];
}

export function chatbotHealth(): Promise<Result<ChatbotHealth>> {
  return safe(async () => {
    const [knowledgeRows, knowledgePublished, customisedSections, recentQuestions] = await Promise.all([
      prisma.chatKnowledge.count(),
      prisma.chatKnowledge.count({ where: { state: "PUBLISHED" } }),
      prisma.chatbotSetting.count({ where: { key: { startsWith: "bot." } } }),
      prisma.chatMessage.findMany({
        where: { role: "USER" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, content: true, language: true, createdAt: true, conversationId: true },
      }),
    ]);
    return { knowledgeRows, knowledgePublished, customisedSections, recentQuestions };
  });
}
