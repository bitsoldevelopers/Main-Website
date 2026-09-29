import type { PillTone } from "@/lib/admin/leads";

/**
 * Labels and badge colours for the states the automation area shows. Pure
 * data, safe to import from client components.
 */

export interface Badge {
  label: string;
  tone: PillTone;
}

function lookup(map: Record<string, Badge>, value: string | null | undefined): Badge {
  return (value && map[value]) || { label: value ? value.replace(/_/g, " ").toLowerCase() : "—", tone: "slate" };
}

const VALIDITY: Record<string, Badge> = {
  VALID: { label: "✓ Valid", tone: "green" },
  RISKY: { label: "⚠ Risky", tone: "amber" },
  INVALID: { label: "✕ Invalid", tone: "red" },
  UNCHECKED: { label: "Not checked", tone: "slate" },
};
export const validityBadge = (value: string | null | undefined) => lookup(VALIDITY, value);

const RUN: Record<string, Badge> = {
  ACTIVE: { label: "Running", tone: "cyan" },
  PAUSED: { label: "Paused", tone: "amber" },
  STOPPED: { label: "Stopped", tone: "slate" },
  COMPLETED: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
};
export const runBadge = (value: string | null | undefined) => lookup(RUN, value);

const AUTOMATION: Record<string, Badge> = {
  DRAFT: { label: "Draft", tone: "slate" },
  ACTIVE: { label: "Active", tone: "green" },
  PAUSED: { label: "Paused", tone: "amber" },
};
export const automationBadge = (value: string | null | undefined) => lookup(AUTOMATION, value);

const IMPORT: Record<string, Badge> = {
  QUEUED: { label: "Queued", tone: "slate" },
  RUNNING: { label: "Importing", tone: "cyan" },
  COMPLETED: { label: "Completed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
};
export const importBadge = (value: string | null | undefined) => lookup(IMPORT, value);

const SYNC: Record<string, Badge> = {
  IDLE: { label: "Not synced yet", tone: "slate" },
  QUEUED: { label: "Queued", tone: "slate" },
  RUNNING: { label: "Syncing", tone: "cyan" },
  OK: { label: "In sync", tone: "green" },
  ERROR: { label: "Sync failed", tone: "red" },
};
export const syncBadge = (value: string | null | undefined) => lookup(SYNC, value);

const OUTCOME: Record<string, Badge> = {
  CREATED: { label: "New lead", tone: "green" },
  UPDATED: { label: "Updated", tone: "cyan" },
  UNCHANGED: { label: "No changes", tone: "slate" },
  DUPLICATE: { label: "Duplicate", tone: "amber" },
  REVIEW: { label: "Needs review", tone: "purple" },
  INVALID: { label: "Invalid", tone: "red" },
  SKIPPED: { label: "Skipped", tone: "slate" },
  FAILED: { label: "Failed", tone: "red" },
};
export const outcomeBadge = (value: string | null | undefined) => lookup(OUTCOME, value);

const MESSAGE: Record<string, Badge> = {
  QUEUED: { label: "Queued", tone: "slate" },
  SENT: { label: "Sent", tone: "cyan" },
  DELIVERED: { label: "Delivered", tone: "cyan" },
  OPENED: { label: "Opened", tone: "purple" },
  CLICKED: { label: "Clicked", tone: "purple" },
  REPLIED: { label: "Replied", tone: "green" },
  BOUNCED: { label: "Bounced", tone: "red" },
  COMPLAINED: { label: "Spam complaint", tone: "red" },
  FAILED: { label: "Failed", tone: "red" },
};
export const messageBadge = (value: string | null | undefined) => lookup(MESSAGE, value);

const JOB: Record<string, Badge> = {
  PENDING: { label: "Waiting", tone: "slate" },
  RUNNING: { label: "Running", tone: "cyan" },
  DONE: { label: "Done", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
};
export const jobBadge = (value: string | null | undefined) => lookup(JOB, value);

const TASK: Record<string, Badge> = {
  OPEN: { label: "Open", tone: "cyan" },
  DONE: { label: "Done", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "slate" },
};
export const taskBadge = (value: string | null | undefined) => lookup(TASK, value);

export const STEP_TYPE_LABELS: Record<string, string> = {
  SEND_EMAIL: "Send email",
  WAIT: "Wait",
  CREATE_TASK: "Human follow-up",
};

export const TRIGGER_LABELS: Record<string, string> = {
  IMPORT: "New leads from an import, or started by hand",
  MANUAL: "Started by hand only",
};

export const SKIP_REASON_LABELS: Record<string, string> = {
  INVALID: "invalid",
  BOUNCED: "bounced",
  UNSUBSCRIBED: "unsubscribed",
  SUPPRESSED: "on the suppression list",
};

/** "in 2 d", "in 5 h", "3 d ago": for due dates on either side of now. */
export function relativeTime(value: Date | string, now = Date.now()): string {
  const diff = new Date(value).getTime() - now;
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const text =
    minutes < 1
      ? "now"
      : minutes < 60
        ? `${minutes} min`
        : minutes < 60 * 36
          ? `${Math.round(minutes / 60)} h`
          : `${Math.round(minutes / 1440)} d`;
  if (text === "now") return "now";
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}
