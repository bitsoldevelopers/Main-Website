import crypto from "node:crypto";
import { after, NextRequest } from "next/server";
import { config } from "@/lib/config";
import { runFollowUps } from "@/lib/bot/followup";
import { claimDueBroadcasts, runBroadcastSafely } from "@/lib/whatsapp/broadcast";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WhatsApp follow-up scheduler. Call it every 15–30 minutes from the host's
 * cron with the secret (CHATBOT_CRON_SECRET, or the lead-automation
 * AUTOMATION_CRON_SECRET):
 *
 *     curl -fsS -H "Authorization: Bearer <secret>" https://bitsolmarketing.com/api/cron/follow-ups
 *
 * Safe to call more often: each lead gets at most one message per configured
 * step, and the run reports what it sent and why it skipped the rest.
 *
 * The same call starts any scheduled broadcast whose time has come. Those
 * runs continue after the response: a broadcast to thousands of people takes
 * longer than cron's curl will wait, and the recipient table makes a run cut
 * short safe to resume.
 */
async function handle(req: NextRequest) {
  const secret = config.cron.secret;
  if (!secret) {
    return Response.json({ error: "CHATBOT_CRON_SECRET is not set on this server." }, { status: 503 });
  }

  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const provided = header || req.nextUrl.searchParams.get("secret") || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return Response.json({ error: "Not authorised." }, { status: 401 });
  }

  if (!(await getWhatsAppSettings()).enabled) {
    return Response.json({ error: "WhatsApp is not connected: add the phone number ID and access token under Admin → Chatbot → Setup." }, { status: 503 });
  }

  let broadcasts: string[] = [];
  try {
    broadcasts = await claimDueBroadcasts();
  } catch (error) {
    console.error("[cron] could not claim scheduled broadcasts:", error);
  }
  if (broadcasts.length) {
    after(async () => {
      for (const id of broadcasts) await runBroadcastSafely(id);
    });
  }

  try {
    return Response.json({ ...(await runFollowUps()), broadcastsStarted: broadcasts.length });
  } catch (error) {
    console.error("[cron] follow-ups failed:", error);
    return Response.json({ error: "Follow-up run failed. See the server log.", broadcastsStarted: broadcasts.length }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
