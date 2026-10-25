import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { guardApi } from "@/lib/chatbot/guard";
import { actorLabel } from "@/lib/admin/auth";
import { logEvent } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ botPaused: z.boolean().optional(), handedOff: z.boolean().optional() })
  .refine((body) => body.botPaused !== undefined || body.handedOff !== undefined, "Nothing to update.");

/** Pause or resume the assistant on a conversation, and open or close its handover. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi("chatbot.write");
  if ("response" in guard) return guard.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid update." }, { status: 400 });

  const { id } = await params;
  const conversation = await prisma.chatConversation.findUnique({ where: { id }, select: { id: true } });
  if (!conversation) return Response.json({ error: "Conversation not found." }, { status: 404 });

  const data: { botPaused?: boolean; handedOff?: boolean; handoverTeam?: null } = { ...parsed.data };
  if (parsed.data.handedOff === false) data.handoverTeam = null;

  await prisma.chatConversation.update({ where: { id }, data });

  await logEvent({
    actor: actorLabel(guard.session),
    action: "chatbot.conversation.updated",
    entity: "chatbot",
    entityId: id,
    message: `${parsed.data.botPaused === false ? "Resumed" : parsed.data.botPaused ? "Paused" : "Updated"} the assistant on a conversation.`,
    metadata: parsed.data,
  });
  return Response.json({ ok: true });
}
