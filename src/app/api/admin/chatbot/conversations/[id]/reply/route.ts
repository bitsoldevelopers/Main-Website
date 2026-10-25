import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/lib/chatbot/guard";
import { actorLabel } from "@/lib/admin/auth";
import { logEvent } from "@/lib/notify";
import { sendText } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 60 * 60 * 1000;

const bodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  /** Keep the assistant quiet while a person is talking. */
  pauseBot: z.boolean().default(true),
});

/**
 * A person on the team replies to a WhatsApp customer from the panel.
 *
 * Free-form messages are only allowed inside WhatsApp's 24-hour customer
 * service window, so the route checks the customer's last message first and
 * says so plainly instead of letting Meta reject the send.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi("chatbot.write");
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Write a message first." }, { status: 400 });

  const { id } = await params;
  const conversation = await prisma.chatConversation.findUnique({
    where: { id },
    select: { id: true, channel: true, contactPhone: true },
  });
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });
  if (conversation.channel !== "WHATSAPP" || !conversation.contactPhone) {
    return Response.json({ error: "Only WhatsApp conversations can be replied to from here." }, { status: 400 });
  }

  const waId = conversation.contactPhone.replace(/\D/g, "");
  const contact = await prisma.whatsappContact.findUnique({ where: { waId }, select: { lastInboundAt: true, isBlocked: true } });
  if (contact?.isBlocked) return Response.json({ error: "This number is blocked." }, { status: 400 });
  if (!contact?.lastInboundAt || Date.now() - contact.lastInboundAt.getTime() > WINDOW_MS) {
    return Response.json(
      { error: "The 24-hour reply window has closed. WhatsApp only allows an approved template message now." },
      { status: 409 }
    );
  }

  const result = await sendText(waId, parsed.data.text);
  if (!result.ok) {
    return Response.json({ error: result.error ?? "WhatsApp did not accept the message." }, { status: 502 });
  }

  await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversationId: id,
        role: "ASSISTANT",
        content: parsed.data.text,
        externalId: result.messageId ?? null,
        authorId: guard.session.sub,
      },
    }),
    prisma.chatConversation.update({
      where: { id },
      data: { handedOff: true, ...(parsed.data.pauseBot ? { botPaused: true } : {}) },
    }),
    prisma.whatsappContact.update({ where: { waId }, data: { lastOutboundAt: new Date() } }),
  ]);

  await logEvent({
    actor: actorLabel(guard.session),
    action: "chatbot.agent.replied",
    entity: "chatbot",
    entityId: id,
    message: "Replied to a WhatsApp customer from the panel.",
  });

  return Response.json({ ok: true });
}
