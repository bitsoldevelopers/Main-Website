import { prisma } from "@/lib/prisma";

/**
 * Central write path for the activity log. Best-effort by design: an audit
 * row must never break the operation it describes, so failures are swallowed
 * after a single console warning.
 */
export async function logActivity(entry: {
  actor: string;
  action: string;
  entity: string;
  entityId?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actor: entry.actor.slice(0, 191),
        action: entry.action.slice(0, 191),
        entity: entry.entity.slice(0, 191),
        entityId: entry.entityId ?? null,
        detail: entry.detail ?? null,
      },
    });
  } catch (err) {
    console.warn(`[admin] could not write activity log (${entry.action}):`, err instanceof Error ? err.message : err);
  }
}
