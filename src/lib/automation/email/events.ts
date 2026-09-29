import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markBounced, markLeadReplied, markUnsubscribed } from "../engine";
import { normalizeEmail } from "../normalize";
import { recordActivity } from "../timeline";

/**
 * Email events, from the provider's webhook into the CRM. Provider-neutral:
 * the webhook route turns a Resend payload into an InboundEvent and this
 * module does the rest, so another provider only needs its own small route.
 *
 * Every event is stored once (the provider's delivery id is unique), so a
 * webhook that is retried changes nothing the second time.
 */

export type EmailEventType =
  | "SENT"
  | "DELIVERED"
  | "DELAYED"
  | "OPENED"
  | "CLICKED"
  | "BOUNCED"
  | "COMPLAINED"
  | "FAILED"
  | "SUPPRESSED"
  | "RECEIVED";

export interface InboundEvent {
  type: EmailEventType;
  /** Unique per delivery attempt of the webhook. */
  providerEventId: string;
  /** The provider's id of the message the event is about. */
  providerMessageId?: string | null;
  occurredAt: Date;
  /** RECEIVED only: who wrote to us. */
  from?: string | null;
  subject?: string | null;
  detail?: string | null;
  /** Hard bounces are permanent; soft ones (mailbox full…) are not. */
  permanent?: boolean;
  payload: Prisma.InputJsonValue;
}

export type EventResult = "RECORDED" | "DUPLICATE" | "IGNORED";

const SOURCE = "Email provider";

/** Later statuses never fall back to earlier ones. */
const STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  FAILED: 1,
  SENT: 2,
  DELIVERED: 3,
  OPENED: 4,
  CLICKED: 5,
  REPLIED: 6,
  BOUNCED: 7,
  COMPLAINED: 7,
};

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "P2002";
}

export async function recordEmailEvent(event: InboundEvent): Promise<EventResult> {
  if (event.type === "RECEIVED") return recordReply(event);

  const message = event.providerMessageId
    ? await prisma.emailMessage.findFirst({
        where: { providerMessageId: event.providerMessageId },
        select: { id: true, leadId: true, toEmail: true, subject: true, status: true, openedAt: true, deliveredAt: true, clickedAt: true },
      })
    : null;
  // Events for mail this module did not send (the site's own notifications).
  if (!message) return "IGNORED";

  try {
    await prisma.emailEvent.create({
      data: {
        messageId: message.id,
        leadId: message.leadId,
        type: event.type,
        providerEventId: event.providerEventId.slice(0, 191),
        payload: event.payload,
        occurredAt: event.occurredAt,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "DUPLICATE";
    throw err;
  }

  const data: Prisma.EmailMessageUpdateInput = {};
  const promote = (status: string) => {
    if ((STATUS_RANK[status] ?? 0) > (STATUS_RANK[message.status] ?? 0)) data.status = status;
  };

  switch (event.type) {
    case "DELIVERED":
      promote("DELIVERED");
      if (!message.deliveredAt) data.deliveredAt = event.occurredAt;
      break;
    case "OPENED":
      promote("OPENED");
      data.openCount = { increment: 1 };
      if (!message.openedAt) {
        data.openedAt = event.occurredAt;
        await recordActivity({ leadId: message.leadId, type: "EMAIL_OPENED", title: `Email opened: ${message.subject}`, actor: SOURCE, createdAt: event.occurredAt });
      }
      break;
    case "CLICKED":
      promote("CLICKED");
      if (!message.clickedAt) {
        data.clickedAt = event.occurredAt;
        await recordActivity({
          leadId: message.leadId,
          type: "EMAIL_CLICKED",
          title: `Link clicked: ${message.subject}`,
          detail: event.detail ?? null,
          actor: SOURCE,
          createdAt: event.occurredAt,
        });
      }
      break;
    case "BOUNCED":
    case "SUPPRESSED":
      if (event.permanent === false) {
        data.error = event.detail ?? "Temporary delivery problem";
        break;
      }
      data.status = "BOUNCED";
      data.bouncedAt = event.occurredAt;
      data.error = event.detail ?? null;
      await markBounced({ leadId: message.leadId, email: message.toEmail, detail: event.detail ?? undefined, source: SOURCE });
      break;
    case "COMPLAINED":
      data.status = "COMPLAINED";
      await markUnsubscribed({ leadId: message.leadId, email: message.toEmail, source: "Spam complaint" });
      break;
    case "FAILED":
      promote("FAILED");
      data.error = event.detail ?? "The provider could not send this email";
      break;
    default:
      break;
  }

  if (Object.keys(data).length > 0) await prisma.emailMessage.update({ where: { id: message.id }, data });
  return "RECORDED";
}

/**
 * An email arrived at the reply address. It counts as a reply when the
 * sender is an address we have emailed; anything else is somebody else's
 * mail and is left alone.
 */
async function recordReply(event: InboundEvent): Promise<EventResult> {
  const from = normalizeEmail(event.from ?? "");
  if (!from) return "IGNORED";

  const message = await prisma.emailMessage.findFirst({
    where: { toEmail: from, sentAt: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { id: true, leadId: true },
  });
  if (!message) return "IGNORED";

  try {
    await prisma.emailEvent.create({
      data: {
        messageId: message.id,
        leadId: message.leadId,
        type: "RECEIVED",
        providerEventId: event.providerEventId.slice(0, 191),
        payload: event.payload,
        occurredAt: event.occurredAt,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) return "DUPLICATE";
    throw err;
  }

  await markLeadReplied({
    leadId: message.leadId,
    actor: "Reply detection",
    messageId: message.id,
    detail: event.subject ? `Subject: ${event.subject}` : undefined,
  });
  return "RECORDED";
}
