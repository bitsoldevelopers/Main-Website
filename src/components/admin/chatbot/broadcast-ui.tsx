import { Pill } from "@/components/admin/ui";
import type { PillTone } from "@/lib/admin/leads";

/**
 * Status badges shared by the Templates and Broadcasts pages. Server-safe:
 * no hooks, so the pages render them without a client boundary.
 */

const TEMPLATE_TONES: Record<string, PillTone> = {
  APPROVED: "green",
  PENDING: "amber",
  REJECTED: "red",
  PAUSED: "amber",
  DISABLED: "slate",
};

const BROADCAST_TONES: Record<string, PillTone> = {
  DRAFT: "slate",
  SCHEDULED: "purple",
  SENDING: "cyan",
  SENT: "green",
  FAILED: "red",
};

const RECIPIENT_TONES: Record<string, PillTone> = {
  PENDING: "slate",
  SENT: "cyan",
  DELIVERED: "green",
  READ: "green",
  FAILED: "red",
};

function label(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function TemplateStatusPill({ status }: { status: string }) {
  return <Pill tone={TEMPLATE_TONES[status] ?? "slate"}>{status === "PENDING" ? "Awaiting Meta" : label(status)}</Pill>;
}

export function BroadcastStatusPill({ status }: { status: string }) {
  return <Pill tone={BROADCAST_TONES[status] ?? "slate"}>{status === "SENDING" ? "Sending…" : label(status)}</Pill>;
}

export function RecipientStatusPill({ status }: { status: string }) {
  return <Pill tone={RECIPIENT_TONES[status] ?? "slate"}>{status === "SENT" ? "Accepted" : label(status)}</Pill>;
}
