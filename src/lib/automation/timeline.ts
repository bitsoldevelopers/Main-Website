import { prisma } from "@/lib/prisma";

/**
 * Write path for the per-lead timeline (LeadActivity). Like the panel-wide
 * activity log it is best-effort: a timeline row must never fail the import
 * or the send it describes.
 */

export const ACTIVITY_TYPES = [
  "IMPORTED",
  "LEAD_CREATED",
  "LEAD_UPDATED",
  "DUPLICATE_CHECKED",
  "OUTREACH_EMAIL_SELECTED",
  "ASSIGNED",
  "TAGGED",
  "STATUS_CHANGED",
  "AUTOMATION_STARTED",
  "AUTOMATION_PAUSED",
  "AUTOMATION_RESUMED",
  "AUTOMATION_STOPPED",
  "AUTOMATION_COMPLETED",
  "EMAIL_SENT",
  "EMAIL_DELIVERED",
  "EMAIL_OPENED",
  "EMAIL_CLICKED",
  "EMAIL_BOUNCED",
  "EMAIL_FAILED",
  "FOLLOW_UP_SCHEDULED",
  "FOLLOW_UP_SENT",
  "REPLIED",
  "UNSUBSCRIBED",
  "TASK_CREATED",
  "TASK_COMPLETED",
  "NOTE",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface TimelineEntry {
  leadId: string;
  type: ActivityType;
  title: string;
  detail?: string | null;
  actor?: string;
  createdAt?: Date;
}

function row(entry: TimelineEntry) {
  return {
    leadId: entry.leadId,
    type: entry.type,
    title: entry.title.slice(0, 191),
    detail: entry.detail ?? null,
    actor: (entry.actor ?? "System").slice(0, 191),
    ...(entry.createdAt ? { createdAt: entry.createdAt } : {}),
  };
}

export async function recordActivity(entry: TimelineEntry): Promise<void> {
  try {
    await prisma.leadActivity.create({ data: row(entry) });
  } catch (err) {
    console.warn(`[automation] could not write timeline (${entry.type}):`, err instanceof Error ? err.message : err);
  }
}

/**
 * Several entries in one insert. They are stamped a millisecond apart, in the
 * order given, so the timeline shows them in the order they happened.
 */
export async function recordActivities(entries: TimelineEntry[]): Promise<void> {
  if (entries.length === 0) return;
  const base = Date.now();
  try {
    await prisma.leadActivity.createMany({
      data: entries.map((entry, i) => row({ ...entry, createdAt: entry.createdAt ?? new Date(base + i) })),
    });
  } catch (err) {
    console.warn("[automation] could not write timeline batch:", err instanceof Error ? err.message : err);
  }
}
