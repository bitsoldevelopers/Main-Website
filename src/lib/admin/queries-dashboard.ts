import { prisma } from "@/lib/prisma";
import { hasPermission, type AdminRole } from "./rbac";
import { safe, type Result } from "./queries";
import { APPLICATION_PREFIX, PROSPECT_SUBJECT, leadTopic } from "./leads";

/**
 * Extra reads for the dashboard cards and the navbar's notifications menu.
 * Same rule as queries.ts: every read goes through safe(), and the chatbot
 * tables are read separately because a database without the chatbot
 * migration must still show everything else.
 */

const TIME_ZONE = "Asia/Karachi";
const DAY = 86_400_000;

/** "2026-11-13" for the calendar day in Pakistan time. */
function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}

// ─── Notifications ──────────────────────────────────────────────────────────

export interface ShellNotification {
  id: string;
  kind: "lead" | "application" | "handoff" | "ticket" | "meeting";
  title: string;
  detail: string;
  href: string;
  /** ISO timestamp; the client compares it with the last "mark all as read". */
  at: string;
}

/** Fresh inquiries, chats handed to a person, and open requests, newest first. */
export async function getShellNotifications(role: AdminRole): Promise<ShellNotification[]> {
  const out: ShellNotification[] = [];

  if (hasPermission(role, "leads.read")) {
    const leads = await safe(() =>
      prisma.lead.findMany({
        where: { status: "NEW", NOT: { subject: PROSPECT_SUBJECT } },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, name: true, subject: true, createdAt: true },
      })
    );
    if (leads.ok) {
      for (const lead of leads.data) {
        const application = lead.subject.startsWith(APPLICATION_PREFIX);
        out.push({
          id: `lead-${lead.id}`,
          kind: application ? "application" : "lead",
          title: application ? `Job application from ${lead.name}` : `New inquiry from ${lead.name}`,
          detail: leadTopic(lead.subject),
          href: `/admin/leads/${lead.id}`,
          at: lead.createdAt.toISOString(),
        });
      }
    }
  }

  if (hasPermission(role, "chatbot.view")) {
    const [handoffs, requests] = await Promise.all([
      safe(() =>
        prisma.chatConversation.findMany({
          where: { handedOff: true, updatedAt: { gte: new Date(Date.now() - 3 * DAY) } },
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: { id: true, contactName: true, channel: true, handoverTeam: true, handedOffAt: true, updatedAt: true },
        })
      ),
      safe(() =>
        prisma.chatRequest.findMany({
          where: { OR: [{ kind: "TICKET", status: "OPEN" }, { kind: "MEETING", status: "REQUESTED" }] },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { id: true, reference: true, kind: true, subject: true, contactName: true, createdAt: true },
        })
      ),
    ]);
    if (handoffs.ok) {
      for (const chat of handoffs.data) {
        out.push({
          id: `chat-${chat.id}`,
          kind: "handoff",
          title: `${chat.contactName || "A visitor"} asked for a person`,
          detail: [chat.channel === "WHATSAPP" ? "WhatsApp" : "Website chat", chat.handoverTeam].filter(Boolean).join(" · "),
          href: `/admin/chatbot/conversations/${chat.id}`,
          at: (chat.handedOffAt ?? chat.updatedAt).toISOString(),
        });
      }
    }
    if (requests.ok) {
      for (const req of requests.data) {
        const meeting = req.kind === "MEETING";
        out.push({
          id: `req-${req.id}`,
          kind: meeting ? "meeting" : "ticket",
          title: meeting ? `Meeting request from ${req.contactName || "a visitor"}` : `Ticket ${req.reference}`,
          detail: req.subject,
          href: "/admin/chatbot/requests",
          at: req.createdAt.toISOString(),
        });
      }
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export interface DailyCount {
  key: string;
  /** "Nov 13" */
  label: string;
  /** "Thu" */
  weekday: string;
  count: number;
}

export interface ChatStats {
  conversations7: number;
  whatsapp7: number;
  handoffs7: number;
  requests30: number;
  openTickets: number;
  pendingMeetings: number;
  resolved30: number;
}

export interface DashboardExtras {
  /** Inbound leads per day, oldest first, the last 14 days in Pakistan time. */
  daily: DailyCount[];
  bySource: { source: string; count: number }[];
}

export function getDashboardExtras(): Promise<Result<DashboardExtras>> {
  return safe(async () => {
    const now = new Date();
    const days: DailyCount[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY);
      days.push({
        key: dayKey(d),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TIME_ZONE }),
        weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: TIME_ZONE }),
        count: 0,
      });
    }

    const [recent, sources] = await Promise.all([
      prisma.lead.findMany({
        where: { NOT: { subject: PROSPECT_SUBJECT }, createdAt: { gte: new Date(now.getTime() - 15 * DAY) } },
        select: { createdAt: true },
      }),
      prisma.lead.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
    ]);

    const byKey = new Map(days.map((d) => [d.key, d]));
    for (const row of recent) {
      const bucket = byKey.get(dayKey(row.createdAt));
      if (bucket) bucket.count += 1;
    }

    return {
      daily: days,
      bySource: sources.map((s) => ({ source: s.source, count: s._count._all })),
    };
  });
}

/** Chatbot numbers for the support card; fails on its own if the tables are missing. */
export function getChatStats(): Promise<Result<ChatStats>> {
  return safe(async () => {
    const since7 = new Date(Date.now() - 7 * DAY);
    const since30 = new Date(Date.now() - 30 * DAY);
    const [conversations7, whatsapp7, handoffs7, requests30, openTickets, pendingMeetings, resolved30] = await Promise.all([
      prisma.chatConversation.count({ where: { createdAt: { gte: since7 } } }),
      prisma.chatConversation.count({ where: { createdAt: { gte: since7 }, channel: "WHATSAPP" } }),
      prisma.chatConversation.count({ where: { handedOff: true, createdAt: { gte: since7 } } }),
      prisma.chatRequest.count({ where: { createdAt: { gte: since30 } } }),
      prisma.chatRequest.count({ where: { kind: "TICKET", status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } } }),
      prisma.chatRequest.count({ where: { kind: "MEETING", status: { in: ["REQUESTED", "RESCHEDULED"] } } }),
      prisma.chatRequest.count({
        where: { createdAt: { gte: since30 }, status: { in: ["RESOLVED", "CLOSED", "CONFIRMED", "COMPLETED"] } },
      }),
    ]);
    return { conversations7, whatsapp7, handoffs7, requests30, openTickets, pendingMeetings, resolved30 };
  });
}

const SOURCE_LABELS: Record<string, string> = {
  website: "Website form",
  csv: "CSV import",
  google_sheets: "Google Sheets",
  manual: "Added by hand",
  chatbot: "Chatbot",
  whatsapp: "WhatsApp",
  import: "Import",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
