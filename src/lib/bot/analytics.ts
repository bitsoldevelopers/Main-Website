import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * =============================================================================
 *  Chatbot analytics
 * =============================================================================
 *
 *  One round of queries feeds every dashboard view; each shows the slice its
 *  reader acts on. Counts of things the assistant *did* come from `ChatEvent`;
 *  counts of things in the CRM come from the CRM tables themselves. Filterable
 *  by channel: the website widget, WhatsApp, or both.
 * =============================================================================
 */

export type AnalyticsChannel = "ALL" | "WEB" | "WHATSAPP";

export interface Row {
  label: string;
  count: number;
}

export interface ChatbotAnalytics {
  days: number;
  channel: AnalyticsChannel;
  conversations: number;
  newLeads: number;
  qualifiedLeads: number;
  hotLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  quotesRequested: number;
  demosRequested: number;
  callsRequested: number;
  growthPlans: number;
  handovers: number;
  tickets: number;
  meetings: number;
  followUpsSent: number;
  optOuts: number;
  enterprise: number;
  aiReplies: number;
  fallbacks: number;
  flowsStarted: number;
  flowsCompleted: number;
  /** Share of conversations the assistant handled without a person. */
  aiResolutionRate: number;
  /** Average seconds from a customer message to the next reply. */
  responseSeconds: number | null;
  sendFailures: number;
  daily: Row[];
  temperatures: Row[];
  stages: Row[];
  services: Row[];
  intents: Row[];
  countries: Row[];
  languages: Row[];
  sources: Row[];
  campaigns: Row[];
  handoversByTeam: Row[];
  flows: Row[];
  menus: Row[];
  events: Row[];
  ticketCategories: Row[];
  ticketStatuses: Row[];
}

export function emptyAnalytics(days: number, channel: AnalyticsChannel): ChatbotAnalytics {
  return {
    days,
    channel,
    conversations: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    hotLeads: 0,
    wonLeads: 0,
    lostLeads: 0,
    conversionRate: 0,
    quotesRequested: 0,
    demosRequested: 0,
    callsRequested: 0,
    growthPlans: 0,
    handovers: 0,
    tickets: 0,
    meetings: 0,
    followUpsSent: 0,
    optOuts: 0,
    enterprise: 0,
    aiReplies: 0,
    fallbacks: 0,
    flowsStarted: 0,
    flowsCompleted: 0,
    aiResolutionRate: 0,
    responseSeconds: null,
    sendFailures: 0,
    daily: [],
    temperatures: [],
    stages: [],
    services: [],
    intents: [],
    countries: [],
    languages: [],
    sources: [],
    campaigns: [],
    handoversByTeam: [],
    flows: [],
    menus: [],
    events: [],
    ticketCategories: [],
    ticketStatuses: [],
  };
}

function rows<T extends Record<string, unknown>>(
  groups: Array<T & { _count: { _all: number } }>,
  key: keyof T,
  limit = 8
): Row[] {
  return groups
    .map((group) => ({ label: String(group[key] ?? "Not recorded"), count: group._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function chatbotAnalytics(
  days: number,
  channel: AnalyticsChannel = "ALL"
): Promise<{ data: ChatbotAnalytics; error?: string }> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const channelFilter = channel === "ALL" ? {} : { channel };
  const leadSource = channel === "ALL" ? {} : { source: channel === "WEB" ? "CHATBOT" : "WHATSAPP" };

  try {
    const conversationsWhere = { ...channelFilter, createdAt: { gte: since } };
    const profilesWhere = { ...leadSource, createdAt: { gte: since } };
    const eventsWhere = { ...channelFilter, createdAt: { gte: since } };
    const requestsWhere = (kind: "TICKET" | "MEETING") => ({
      kind,
      createdAt: { gte: since },
      ...(channel === "ALL" ? {} : { conversation: { is: { channel } } }),
    });

    const [
      conversations,
      handedOff,
      conversationRows,
      newLeads,
      qualifiedLeads,
      hotLeads,
      wonLeads,
      lostLeads,
      eventGroups,
      tickets,
      meetings,
      sendFailures,
      temperatureGroups,
      stageGroups,
      serviceGroups,
      intentGroups,
      countryGroups,
      languageGroups,
      sourceGroups,
      campaignGroups,
      handoverGroups,
      flowGroups,
      menuGroups,
      ticketCategoryGroups,
      ticketStatusGroups,
      response,
    ] = await Promise.all([
      prisma.chatConversation.count({ where: conversationsWhere }),
      prisma.chatConversation.count({ where: { ...conversationsWhere, handedOff: true } }),
      prisma.chatConversation.findMany({ where: conversationsWhere, select: { createdAt: true } }),
      prisma.chatLeadProfile.count({ where: profilesWhere }),
      prisma.chatLeadProfile.count({ where: { ...profilesWhere, temperature: { in: ["WARM", "HOT", "HIGH_PRIORITY"] } } }),
      prisma.chatLeadProfile.count({ where: { ...profilesWhere, temperature: { in: ["HOT", "HIGH_PRIORITY"] } } }),
      prisma.chatLeadProfile.count({ where: { ...profilesWhere, lead: { status: "WON" } } }),
      prisma.chatLeadProfile.count({ where: { ...leadSource, lead: { status: "LOST", updatedAt: { gte: since } } } }),
      prisma.chatEvent.groupBy({ by: ["type"], _count: { _all: true }, where: eventsWhere }),
      prisma.chatRequest.count({ where: requestsWhere("TICKET") }),
      prisma.chatRequest.count({ where: requestsWhere("MEETING") }),
      prisma.activityLog.count({ where: { action: "whatsapp.send.failed", createdAt: { gte: since } } }),
      prisma.chatLeadProfile.groupBy({ by: ["temperature"], _count: { _all: true }, where: profilesWhere }),
      prisma.lead.groupBy({ by: ["status"], _count: { _all: true }, where: { chatProfile: { is: profilesWhere } } }),
      prisma.chatLeadProfile.groupBy({ by: ["subService"], _count: { _all: true }, where: profilesWhere }),
      prisma.chatLeadProfile.groupBy({ by: ["intent"], _count: { _all: true }, where: profilesWhere }),
      prisma.lead.groupBy({ by: ["country"], _count: { _all: true }, where: { chatProfile: { is: profilesWhere } } }),
      prisma.chatConversation.groupBy({ by: ["language"], _count: { _all: true }, where: conversationsWhere }),
      prisma.chatConversation.groupBy({ by: ["trafficSource"], _count: { _all: true }, where: conversationsWhere }),
      prisma.chatConversation.groupBy({
        by: ["campaign"],
        _count: { _all: true },
        where: { ...conversationsWhere, campaign: { not: null } },
      }),
      prisma.chatEvent.groupBy({ by: ["team"], _count: { _all: true }, where: { ...eventsWhere, type: "HANDOVER" } }),
      prisma.chatEvent.groupBy({ by: ["value"], _count: { _all: true }, where: { ...eventsWhere, type: "FLOW_COMPLETED" } }),
      prisma.chatEvent.groupBy({
        by: ["value"],
        _count: { _all: true },
        where: { ...eventsWhere, type: { in: ["MENU_OPENED", "SERVICE_VIEWED"] }, value: { not: "root" } },
      }),
      prisma.chatRequest.groupBy({ by: ["category"], _count: { _all: true }, where: requestsWhere("TICKET") }),
      prisma.chatRequest.groupBy({ by: ["status"], _count: { _all: true }, where: requestsWhere("TICKET") }),
      prisma.$queryRaw<Array<{ seconds: unknown }>>(Prisma.sql`
        SELECT AVG(TIMESTAMPDIFF(SECOND, t.createdAt, t.next_at)) AS seconds
        FROM (
          SELECT m.role, m.createdAt,
                 LEAD(m.createdAt) OVER (PARTITION BY m.conversationId ORDER BY m.createdAt) AS next_at,
                 LEAD(m.role) OVER (PARTITION BY m.conversationId ORDER BY m.createdAt) AS next_role
          FROM ChatMessage m
          JOIN ChatConversation c ON c.id = m.conversationId
          WHERE m.createdAt >= ${since}
          ${channel === "ALL" ? Prisma.empty : Prisma.sql`AND c.channel = ${channel}`}
        ) t
        WHERE t.role = 'USER' AND t.next_role = 'ASSISTANT'
      `),
    ]);

    const event = (type: string) => eventGroups.find((group) => group.type === type)?._count._all ?? 0;

    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      buckets.set(day.toISOString().slice(0, 10), 0);
    }
    for (const row of conversationRows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    const rawSeconds = response[0]?.seconds;
    const seconds = rawSeconds == null ? null : Number(rawSeconds);

    return {
      data: {
        days,
        channel,
        conversations,
        newLeads,
        qualifiedLeads,
        hotLeads,
        wonLeads,
        lostLeads,
        conversionRate: newLeads ? Math.round((wonLeads / newLeads) * 1000) / 10 : 0,
        quotesRequested: event("QUOTE_REQUESTED"),
        demosRequested: event("DEMO_REQUESTED"),
        callsRequested: event("CALL_REQUESTED"),
        growthPlans: event("GROWTH_PLAN_REQUESTED"),
        handovers: event("HANDOVER"),
        tickets,
        meetings,
        followUpsSent: event("FOLLOW_UP_SENT"),
        optOuts: event("OPTED_OUT"),
        enterprise: event("ENTERPRISE_DETECTED"),
        aiReplies: event("AI_REPLY"),
        fallbacks: event("FALLBACK"),
        flowsStarted: event("FLOW_STARTED"),
        flowsCompleted: event("FLOW_COMPLETED"),
        aiResolutionRate: conversations ? Math.round(((conversations - handedOff) / conversations) * 1000) / 10 : 0,
        responseSeconds: seconds != null && Number.isFinite(seconds) ? seconds : null,
        sendFailures,
        daily: Array.from(buckets, ([label, count]) => ({ label, count })),
        temperatures: rows(temperatureGroups, "temperature"),
        stages: rows(stageGroups, "status", 12),
        services: rows(serviceGroups, "subService"),
        intents: rows(intentGroups, "intent"),
        countries: rows(countryGroups, "country"),
        languages: rows(languageGroups, "language"),
        sources: rows(sourceGroups, "trafficSource", 12),
        campaigns: rows(campaignGroups, "campaign"),
        handoversByTeam: rows(handoverGroups, "team"),
        flows: rows(flowGroups, "value", 10),
        menus: rows(menuGroups, "value", 10),
        events: rows(eventGroups, "type", 25),
        ticketCategories: rows(ticketCategoryGroups, "category"),
        ticketStatuses: rows(ticketStatusGroups, "status"),
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[chatbot] analytics failed:", message);
    const summary = message.split("\n").map((line) => line.trim()).find(Boolean);
    return { data: emptyAnalytics(days, channel), error: summary ?? "Query failed" };
  }
}
