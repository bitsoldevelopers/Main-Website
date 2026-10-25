import { NextRequest } from "next/server";
import { z } from "zod";
import {
  asksQuestion,
  extractCustomerDetails,
  planAssistantTurn,
  shouldEscalate,
  streamAssistantReply,
  suggestFollowUps,
  type CustomerDetails,
} from "@/lib/ai";
import { BRAND } from "@/lib/brands";
import { generateReference, generateConversationReference, truncate } from "@/lib/utils";
import { clientIp, rateLimit } from "@/lib/chatbot/rate";
import { prisma } from "@/lib/prisma";
import { logEvent, notifyTeam } from "@/lib/notify";
import { readCapture, recordsOf, syncCapture, type CaptureState } from "@/lib/capture";
import { detectLanguage } from "@/lib/i18n";
import { getBotConfig } from "@/lib/bot/config";
import { promptContextFor, teamRecipients } from "@/lib/bot/prompt";
import { config as appConfig } from "@/lib/config";
import type { ChatStreamEvent } from "@/types/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The website chatbot. Streams the assistant's reply as Server-Sent Events and,
 * once the reply is done, stores the turn and syncs the customer's details to
 * the CRM — a lead, a consultation request or a support ticket, each reported
 * back to the browser as a receipt.
 */

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        // Empty is allowed and dropped below: a reply the model failed to
        // produce sits in the client's transcript as an empty turn, and
        // rejecting it here would fail every message after it.
        content: z.string().max(4000),
      })
    )
    .min(1)
    .max(50),
  conversationRef: z.string().max(64).optional(),
  pageUrl: z.string().max(500).optional(),
});

const REFERENCE = /^BM-CONV-[A-Z0-9]{10}$/;

function sse(event: ChatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

const LANGUAGE_MAP = { en: "EN", ur: "UR", ur_roman: "UR_ROMAN", pa: "PA" } as const;

export async function POST(req: NextRequest) {
  const { allowed } = await rateLimit(`chat:${clientIp(req)}`, 30, 60);
  if (!allowed) {
    return Response.json({ error: "Too many requests. Please slow down and try again shortly." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const messages = parsed.data.messages.filter((m) => m.content.trim().length > 0);
  if (!messages.length) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const requestedRef = parsed.data.conversationRef;
  const reference = requestedRef && REFERENCE.test(requestedRef) ? requestedRef : generateConversationReference();

  // What this customer has already told us, so the representative neither asks
  // twice nor forgets a name given twenty messages ago. Bounded: a slow
  // database costs this turn its memory, not its reply.
  const [stored, botConfig] = await Promise.all([within(loadCapture(reference), 1500, null), getBotConfig()]);
  const known: CustomerDetails = stored?.details ?? {};
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = lastUser?.content ?? "";
  const language = detectLanguage(userText);

  const plan = await planAssistantTurn(messages, {
    channel: "WEB",
    details: known,
    records: stored ? recordsOf(stored) : undefined,
    // Contact details, voice and published pricing from Chatbot Studio.
    bot: promptContextFor(botConfig, language),
  });

  // Started now, alongside the reply, so it has usually finished by the time
  // the last token is sent.
  const extraction = extractCustomerDetails(messages, known, {
    brandPhones: [botConfig.contact.whatsappCta, botConfig.contact.businessPhone],
  });

  const ticketId = shouldEscalate(userText) ? generateReference("TKT") : undefined;
  const notifyTo = teamRecipients(botConfig, "SALES", appConfig.routing.salesEmail);

  const encoder = new TextEncoder();
  const startedAt = Date.now();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      // The visitor may close the tab mid-reply; the work below still finishes.
      const send = (event: ChatStreamEvent) => {
        try {
          controller.enqueue(encoder.encode(sse(event)));
        } catch {
          /* stream already closed by the client */
        }
      };

      // Tell the client the detected language immediately so it can switch
      // text direction while the model is still generating.
      send({ type: "meta", language: plan.language });

      try {
        for await (const chunk of streamAssistantReply(messages, plan)) {
          assistantText += chunk;
          send({ type: "chunk", text: chunk });
        }

        // A stream with no text — a safety block, or a thinking budget spent
        // entirely on thoughts — would leave an empty bubble. Say so instead.
        if (!assistantText.trim()) {
          throw new Error("The model returned no text.");
        }

        if (ticketId) {
          const note = `\n\n🎫 I've created ticket **${ticketId}** and passed this to the ${BRAND.name} team. Keep this reference for follow-up — you can also reach them on ${botConfig.contact.businessPhone}.`;
          assistantText += note;
          send({ type: "chunk", text: note });
        }

        send({
          type: "done",
          ticketId,
          suggestions: asksQuestion(assistantText) ? [] : suggestFollowUps(userText),
        });
      } catch (err) {
        console.error("[chat] stream error:", err instanceof Error ? err.message : err);
        // The customer sees this message in place of whatever had streamed, so
        // a partial or declined reply is not stored as the answer either.
        assistantText = "";
        const base = appConfig.ai.configured
          ? "Sorry, I'm having trouble responding right now. Please try again in a moment."
          : `The assistant is not switched on yet. Please WhatsApp us on ${botConfig.contact.whatsappCta} or email ${botConfig.contact.email}.`;
        send({
          type: "error",
          message: ticketId
            ? `${base}

I've passed your request to the ${BRAND.name} team — ticket ${ticketId}. You can also reach them on ${botConfig.contact.businessPhone}.`
            : base,
        });
      }

      // --- Best-effort persistence and CRM capture ----------------------------
      // The client re-enables the composer on `done`, so nobody waits on this.
      // The stream stays open only to report records the turn created.
      try {
        const conversationId = await persist({
          reference,
          language: LANGUAGE_MAP[plan.language],
          userText,
          assistantText,
          ticketId,
          known,
          latencyMs: Date.now() - startedAt,
          pageUrl: parsed.data.pageUrl,
          notifyTo,
          businessPhone: botConfig.contact.businessPhone,
        });

        const captured = await syncCapture({ conversationId, source: "CHATBOT", notifyTo }, await extraction);
        if (captured?.created.length) {
          send({ type: "capture", records: captured.created });
          if (captured.created.some((record) => record.kind === "LEAD")) {
            await prisma.chatEvent
              .create({ data: { type: "LEAD_CAPTURED", channel: "WEB", conversationId, leadId: captured.state.leadId ?? null } })
              .catch(() => {});
          }
        }
      } catch (e) {
        console.warn("[chat] persistence skipped:", (e as Error)?.message ?? e);
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** The capture stored on this conversation, or null for a new one. */
async function loadCapture(reference: string): Promise<CaptureState | null> {
  const conversation = await prisma.chatConversation.findUnique({
    where: { reference },
    select: { capture: true, leadId: true },
  });
  if (!conversation) return null;
  const capture = readCapture(conversation.capture);
  if (!capture.leadId && conversation.leadId) capture.leadId = conversation.leadId;
  return capture;
}

/** Resolve with `fallback` if the promise rejects or takes longer than `ms`. */
function within<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/**
 * Store the exchange for chat history, CRM context and analytics. Returns the
 * conversation id so the capture can be attached to it.
 */
async function persist(opts: {
  reference: string;
  language: string;
  userText: string;
  assistantText: string;
  ticketId?: string;
  known: CustomerDetails;
  latencyMs: number;
  pageUrl?: string;
  notifyTo: string[];
  businessPhone: string;
}): Promise<string> {
  const { reference, language, userText, assistantText, ticketId, known, latencyMs } = opts;

  const existing = await prisma.chatConversation.findUnique({ where: { reference }, select: { id: true } });
  const conversation = existing
    ? await prisma.chatConversation.update({ where: { id: existing.id }, data: { updatedAt: new Date(), language } })
    : await prisma.chatConversation.create({
        data: {
          reference,
          channel: "WEB",
          language,
          title: truncate(userText, 80),
          trafficSource: "WEBSITE",
          campaign: opts.pageUrl ? truncate(opts.pageUrl, 190) : null,
        },
      });

  if (!existing) {
    await prisma.chatEvent
      .create({ data: { type: "CONVERSATION_STARTED", channel: "WEB", conversationId: conversation.id, value: opts.pageUrl ? truncate(opts.pageUrl, 190) : "website" } })
      .catch(() => {});
  }

  if (userText) {
    await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: "USER", content: userText, language },
    });
  }

  // A failed turn has no reply worth keeping; the customer's message still is.
  if (assistantText.trim()) {
    await prisma.chatMessage.create({
      data: { conversationId: conversation.id, role: "ASSISTANT", content: assistantText, language, latencyMs },
    });
    await prisma.chatEvent.create({ data: { type: "AI_REPLY", channel: "WEB", conversationId: conversation.id } }).catch(() => {});
  }

  if (ticketId) {
    await prisma.chatRequest.create({
      data: {
        reference: ticketId,
        kind: "TICKET",
        status: "OPEN",
        category: "GENERAL",
        team: "SUPPORT",
        subject: "Escalated from the website chatbot",
        description: userText,
        // Whatever the assistant had already learned, so the person who
        // picks this up can call back without reading the whole transcript.
        contactName: known.name ?? null,
        contactPhone: known.phone ?? null,
        contactEmail: known.email ?? null,
        conversationId: conversation.id,
      },
    });

    await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { handedOff: true, handedOffAt: new Date(), handoverTeam: "SUPPORT" },
    });
    await prisma.chatEvent
      .create({ data: { type: "HANDOVER", channel: "WEB", conversationId: conversation.id, team: "SUPPORT", value: "Visitor asked for a person" } })
      .catch(() => {});

    await notifyTeam({
      to: opts.notifyTo,
      subject: `Human handoff requested — ${ticketId}`,
      body: [
        "A website visitor asked for a person.",
        "",
        `Ticket: ${ticketId}`,
        `Conversation: ${reference}`,
        known.name ? `Name: ${known.name}` : null,
        known.phone ? `Phone: ${known.phone}` : null,
        known.email ? `Email: ${known.email}` : null,
        "",
        "Their message:",
        userText,
      ]
        .filter((line) => line !== null)
        .join("\n"),
      link: `/admin/chatbot/conversations/${conversation.id}`,
    });

    await logEvent({
      action: "chatbot.escalated",
      entity: "chatbot",
      entityId: conversation.id,
      message: `Website chatbot escalated a conversation to a person (${ticketId}).`,
    });
  }

  return conversation.id;
}
