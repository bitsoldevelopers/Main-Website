import { after, type NextRequest } from "next/server";
import { logEvent } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/admin/session";
import { verifySignature } from "@/lib/whatsapp/client";
import { parseInbound, parseStatuses } from "@/lib/whatsapp/parse";
import { handleInbound } from "@/lib/whatsapp/handler";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { SELF_TEST_HEADER, isSelfTest } from "@/lib/whatsapp/self-test";
import type { WhatsAppWebhookBody } from "@/lib/whatsapp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * =============================================================================
 *  WhatsApp Cloud API webhook
 * =============================================================================
 *
 *  The callback URL given to Meta is https://bitsolmarketing.com/webhook;
 *  `/webhook` is rewritten to this route in next.config.mjs.
 *
 *  GET  — Meta's verification handshake, when someone presses "Verify and
 *         save" in Meta's webhook settings.
 *  POST — every inbound customer message and delivery receipt.
 *
 *   1. **Never trust the caller.** The URL is public, so a POST that is not
 *      signed with the Meta app's secret is refused before it is parsed.
 *   2. **Answer quickly, and always 200 once signed.** Meta redelivers on any
 *      other status or a slow answer, and the assistant's reply takes a few
 *      seconds, so messages are handled after the response is sent.
 *      Deduplication by message id makes the redeliveries that do happen safe.
 *
 *  The verify token and app secret come from Admin → Chatbot → Setup or the
 *  server environment.
 * =============================================================================
 */

function plain(body: string, status: number): Response {
  // Never cached: each verification carries its own challenge.
  return new Response(body, { status, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
}

/**
 * The settings as saved this moment. A verify token generated a second ago
 * must already work, and so must a new app secret, even in another server
 * process with its own cache. A burst of requests falls back to the short
 * cache instead of reading the database for each one.
 */
function latestSettings() {
  return getWhatsAppSettings({ fresh: rateLimit("whatsapp-webhook-fresh-settings", 30, 60_000) });
}

/** Meta's subscription handshake: echo `hub.challenge` when the verify token matches. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  const selfTest = isSelfTest(req.headers.get(SELF_TEST_HEADER));
  const settings = await latestSettings();

  if (!settings.verifyToken) {
    console.error("[whatsapp] no verify token is set — verification refused.");
    return plain("Webhook not configured", 500);
  }

  if (mode === "subscribe" && challenge && safeEqual(token, settings.verifyToken)) {
    if (!selfTest) {
      void logEvent({ action: "whatsapp.webhook.verified", entity: "whatsapp", message: "Meta verified the callback URL." });
    }
    return plain(challenge, 200);
  }

  // A verification attempt with the wrong token: the value in Meta's form differs from this site's.
  if (mode === "subscribe" && !selfTest && rateLimit("whatsapp-webhook-verify-failed", 10, 60_000)) {
    void logEvent({
      level: "WARN",
      action: "whatsapp.webhook.verify_failed",
      entity: "whatsapp",
      message: "A verification request arrived with a different verify token from the one on the Setup page.",
    });
  }
  return plain("Forbidden", 403);
}

export async function POST(req: NextRequest) {
  // The signature covers the exact bytes Meta sent, so the body is read as
  // text and only parsed afterwards.
  const raw = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const selfTest = isSelfTest(req.headers.get(SELF_TEST_HEADER));
  let settings = await getWhatsAppSettings();
  let signed = verifySignature(raw, signature, settings.appSecret);
  if (!signed) {
    // The cached app secret may predate a change made a moment ago.
    const latest = await latestSettings();
    if (latest.appSecret !== settings.appSecret) {
      settings = latest;
      signed = verifySignature(raw, signature, settings.appSecret);
    }
  }

  if (!signed) {
    // The Setup page's test sends a wrongly signed delivery on purpose.
    if (selfTest) return plain("Invalid signature", 401);
    console.warn("[whatsapp] rejected a webhook with an invalid signature.");
    if (rateLimit("whatsapp-webhook-rejected", 20, 60_000)) {
      void logEvent({
        level: "WARN",
        action: "whatsapp.webhook.rejected",
        entity: "whatsapp",
        message: settings.appSecret
          ? "A webhook delivery failed X-Hub-Signature-256 verification."
          : "A webhook delivery arrived, but no app secret is set to verify it.",
        metadata: { ip: clientIp(req) },
      });
    }
    return plain("Invalid signature", 401);
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(raw) as WhatsAppWebhookBody;
  } catch {
    // Malformed but signed — acknowledge so Meta stops retrying it.
    return plain("OK", 200);
  }

  after(async () => {
    try {
      for (const status of parseStatuses(body)) {
        if (status.status === "failed") {
          console.warn("[whatsapp] delivery failed:", status.id, status.errors?.[0]?.title ?? "unknown reason");
        }
      }
      // Sequential on purpose: two messages from the same person share a
      // conversation, and answering them in parallel would send the replies
      // out of order.
      for (const message of parseInbound(body)) {
        await handleInbound(message);
      }
    } catch (error) {
      console.error("[whatsapp] webhook processing error:", error);
    }
  });

  return plain("OK", 200);
}
