import { prisma } from "@/lib/prisma";
import { asLanguage, type Language } from "@/lib/i18n";
import { logEvent } from "@/lib/notify";
import { findService } from "@/data/marketing/services";
import { sendButtons, sendList, sendTemplate, sendText } from "@/lib/whatsapp/client";
import { getBotConfig } from "./config";
import { isOpen } from "./hours";
import { offer, transcriptOf } from "./render";
import { fill, pick } from "./text";

/**
 * =============================================================================
 *  Smart follow-up
 * =============================================================================
 *
 *  A qualified WhatsApp lead who stops replying gets a short, polite check-in —
 *  at most one per configured step, and never:
 *
 *    • to anyone who opted out or was blocked,
 *    • while a person on the team is handling the conversation,
 *    • when the customer is the one waiting for a reply,
 *    • to a lead that is won, lost, unsubscribed or paused,
 *    • outside business hours (when configured),
 *    • outside WhatsApp's 24-hour window without an approved template.
 *
 *  `followUpCount` counts check-ins since the customer last wrote; the
 *  assistant resets it whenever they reply. Run it every 15–30 minutes from a
 *  scheduler calling `/api/cron/follow-ups`.
 * =============================================================================
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = ["WON", "LOST", "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED", "PAUSED"];
const LANGUAGE_BY_CODE: Record<string, Language> = { EN: "en", UR: "ur", UR_ROMAN: "ur_roman", PA: "pa" };

export interface FollowUpReport {
  checked: number;
  sent: number;
  skipped: Record<string, number>;
  note?: string;
}

export async function runFollowUps(now = new Date()): Promise<FollowUpReport> {
  const config = await getBotConfig();
  const rules = config.followUp;
  const report: FollowUpReport = { checked: 0, sent: 0, skipped: {} };
  const skip = (reason: string) => {
    report.skipped[reason] = (report.skipped[reason] ?? 0) + 1;
  };

  if (!rules.enabled || !rules.steps.length) return { ...report, note: "Follow-ups are switched off." };
  if (rules.onlyDuringBusinessHours && !isOpen(config.businessHours, now)) {
    return { ...report, note: "Outside business hours — nothing sent." };
  }

  const profiles = await prisma.chatLeadProfile.findMany({
    where: {
      source: "WHATSAPP",
      temperature: { in: rules.temperatures },
      optInStatus: { not: "OPTED_OUT" },
      followUpCount: { lt: rules.steps.length },
      conversationId: { not: null },
      lead: { status: { notIn: CLOSED_STATUSES } },
    },
    orderBy: { score: "desc" },
    take: 200,
    select: {
      leadId: true,
      conversationId: true,
      subService: true,
      serviceSlug: true,
      followUpCount: true,
      lead: { select: { name: true, status: true } },
    },
  });

  for (const profile of profiles) {
    report.checked += 1;
    const conversation = profile.conversationId
      ? await prisma.chatConversation.findUnique({
          where: { id: profile.conversationId },
          select: { id: true, contactPhone: true, handedOff: true, botPaused: true, language: true },
        })
      : null;
    if (!conversation?.contactPhone) {
      skip("no WhatsApp thread");
      continue;
    }
    if (conversation.handedOff || conversation.botPaused) {
      skip("a person is handling it");
      continue;
    }

    const contact = await prisma.whatsappContact.findFirst({
      where: { phone: conversation.contactPhone },
      select: { waId: true, optedOut: true, isBlocked: true, lastInboundAt: true },
    });
    if (!contact || contact.optedOut || contact.isBlocked) {
      skip("opted out or blocked");
      continue;
    }
    if (!contact.lastInboundAt) {
      skip("never wrote in");
      continue;
    }

    const last = await prisma.chatMessage.findFirst({
      where: { conversationId: conversation.id, role: { in: ["USER", "ASSISTANT"] } },
      orderBy: { createdAt: "desc" },
      select: { role: true },
    });
    if (last?.role === "USER") {
      skip("customer is waiting on us");
      continue;
    }

    const step = rules.steps[profile.followUpCount];
    const quietFor = now.getTime() - contact.lastInboundAt.getTime();
    if (quietFor < step.afterHours * 3_600_000) {
      skip("not due yet");
      continue;
    }

    const language = asLanguage(LANGUAGE_BY_CODE[conversation.language]) ?? "en";
    const service = profile.subService ?? (profile.serviceSlug ? findService(profile.serviceSlug)?.name : undefined) ?? "project";
    const name = profile.lead.name;
    const firstName = name && name !== "WhatsApp contact" ? name.split(" ")[0] : undefined;
    const body = fill(pick(rules.message, language), { name: firstName, service });

    let result: { ok: boolean; messageId?: string; error?: string };
    let transcript: string;

    if (quietFor < WINDOW_MS) {
      const messages = offer(
        body,
        rules.actions
          .map((key) => [key, config.actions[key]] as const)
          .filter(([, action]) => Boolean(action))
          .map(([key, action]) => ({ id: `a:${key}`, title: pick(action!.title, language) })),
        { listButton: pick(config.messages.menuButton, language), moreTitle: pick(config.messages.moreOptions, language) }
      );
      result = { ok: true };
      for (const message of messages) {
        result =
          message.type === "text"
            ? await sendText(contact.waId, message.body)
            : message.type === "buttons"
              ? await sendButtons(contact.waId, message.body, message.buttons, message.footer)
              : await sendList(contact.waId, message.body, message.button, message.rows, undefined, message.footer);
        if (!result.ok) break;
      }
      transcript = messages.map(transcriptOf).join("\n\n");
    } else if (rules.template) {
      const variables = rules.template.variables.map((v) => (v === "name" ? firstName ?? "there" : service));
      result = await sendTemplate(contact.waId, rules.template.name, rules.template.languageCode, variables);
      transcript = `[Template ${rules.template.name}] ${variables.join(" · ")}`;
    } else {
      skip("outside the 24-hour window and no template set");
      continue;
    }

    if (!result.ok) {
      skip("send failed");
      await logEvent({
        level: "ERROR",
        action: "chatbot.follow_up.failed",
        entity: "lead",
        entityId: profile.leadId,
        message: result.error ?? "Follow-up could not be sent.",
      });
      continue;
    }

    report.sent += 1;
    await prisma.$transaction([
      prisma.chatMessage.create({
        data: { conversationId: conversation.id, role: "ASSISTANT", content: transcript, externalId: result.messageId ?? null },
      }),
      prisma.chatLeadProfile.update({
        where: { leadId: profile.leadId },
        data: { followUpCount: { increment: 1 }, lastFollowUpAt: now },
      }),
      ...(profile.lead.status === "NEW" || profile.lead.status === "CONTACTED"
        ? [prisma.lead.update({ where: { id: profile.leadId }, data: { status: "FOLLOW_UP" } })]
        : []),
      prisma.whatsappContact.update({ where: { waId: contact.waId }, data: { lastOutboundAt: now } }),
      prisma.chatEvent.create({
        data: {
          type: "FOLLOW_UP_SENT",
          channel: "WHATSAPP",
          conversationId: conversation.id,
          leadId: profile.leadId,
          value: `step ${profile.followUpCount + 1}`,
        },
      }),
    ]);
  }

  return report;
}
