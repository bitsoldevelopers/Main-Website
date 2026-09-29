import { NextResponse } from "next/server";
import { Resend } from "resend";
import { recordEmailEvent, type EmailEventType, type InboundEvent } from "@/lib/automation/email/events";

/**
 * Resend's webhook: delivery, opens, clicks, bounces, complaints, and mail
 * received at the reply address (Resend Inbound). Add it in the Resend
 * dashboard as https://bitsolmarketing.com/api/webhooks/resend and put the
 * signing secret it shows in RESEND_WEBHOOK_SECRET.
 *
 * Every request must carry a valid Svix signature; without the secret the
 * endpoint is disabled (404), because an unsigned event could mark leads as
 * bounced or replied.
 */

const TYPES: Record<string, EmailEventType> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELAYED",
  "email.opened": "OPENED",
  "email.clicked": "CLICKED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.failed": "FAILED",
  "email.suppressed": "SUPPRESSED",
  "email.received": "RECEIVED",
};

interface ResendPayload {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    subject?: string;
    created_at?: string;
    bounce?: { message?: string; type?: string; subType?: string };
    click?: { link?: string };
    failed?: { reason?: string };
    suppressed?: { message?: string; type?: string };
  };
}

function when(value: string | undefined): Date {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The signature covers the exact bytes, so read the body as text.
  const body = await req.text();
  const id = req.headers.get("svix-id") ?? "";
  const timestamp = req.headers.get("svix-timestamp") ?? "";
  const signature = req.headers.get("svix-signature") ?? "";
  if (!id || !timestamp || !signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let payload: ResendPayload;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY || "re_webhook_verification_only");
    payload = resend.webhooks.verify({ payload: body, headers: { id, timestamp, signature }, webhookSecret: secret }) as ResendPayload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const type = payload.type ? TYPES[payload.type] : undefined;
  if (!type || !payload.data) return NextResponse.json({ ok: true, result: "IGNORED" });

  const data = payload.data;
  const bounceType = (data.bounce?.type ?? data.suppressed?.type ?? "").toLowerCase();
  const event: InboundEvent = {
    type,
    providerEventId: id,
    providerMessageId: type === "RECEIVED" ? null : (data.email_id ?? null),
    occurredAt: when(payload.created_at ?? data.created_at),
    from: data.from ?? null,
    subject: data.subject ?? null,
    detail:
      data.bounce?.message ??
      data.suppressed?.message ??
      data.failed?.reason ??
      data.click?.link ??
      null,
    // Resend reports "Permanent" for hard bounces and "Transient" for soft ones.
    permanent: bounceType ? bounceType !== "transient" && bounceType !== "temporary" : true,
    payload: JSON.parse(body) as InboundEvent["payload"],
  };

  try {
    const result = await recordEmailEvent(event);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // A 5xx makes Resend retry, which is right for a database hiccup.
    console.warn("[automation] webhook could not be recorded:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not record the event" }, { status: 500 });
  }
}
