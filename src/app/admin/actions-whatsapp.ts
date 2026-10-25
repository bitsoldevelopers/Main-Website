"use server";

import { revalidatePath } from "next/cache";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { rateLimit } from "@/lib/rate-limit";
import { checkConnection } from "@/lib/whatsapp/client";
import { checkApp, runWhatsAppChecks, subscribeApp, type SetupCheck } from "@/lib/whatsapp/diagnostics";
import { WHATSAPP_FIELDS, readWhatsAppInput, type WhatsAppKey } from "@/lib/whatsapp/fields";
import { clearWhatsAppSettings, getWhatsAppSettings, newVerifyToken, saveWhatsAppSettings } from "@/lib/whatsapp/settings";

/**
 * Writes from Admin → Chatbot → Setup: the WhatsApp details, the webhook's
 * verify token, the setup checks and the webhook subscription. Activity log
 * entries name what changed, never a value.
 */

const SETUP_PATH = "/admin/chatbot/setup";
const CHECKS_PER_MINUTE = 6;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(error: unknown, fallback: string): string {
  return (error instanceof Error && error.message.split("\n").find(Boolean)) || fallback;
}

// ─── WhatsApp details ───────────────────────────────────────────────────────

export type WhatsAppFormState = { ok: boolean; error?: string; message?: string; warning?: string } | null;

/**
 * Saves what the form changes. Empty inputs keep their saved value, so a
 * secret does not have to be pasted again to change something else. Meta is
 * asked about the new details straight away, so a typo shows now instead of
 * when a customer writes.
 */
export async function saveWhatsAppDetails(_prev: WhatsAppFormState, formData: FormData): Promise<WhatsAppFormState> {
  const session = await requireAdminAction("chatbot.manage");

  let changed: Partial<Record<WhatsAppKey, string>>;
  try {
    const current = await getWhatsAppSettings({ fresh: true });
    const input = readWhatsAppInput((key) => str(formData, key), current.values);
    if ("error" in input) return { ok: false, error: input.error };
    changed = { ...input.changed };

    const autoReply = formData.get("WHATSAPP_AUTO_REPLY") === "on";
    if (autoReply !== current.autoReply) changed.WHATSAPP_AUTO_REPLY = autoReply ? "true" : "false";

    if (Object.keys(changed).length === 0) return { ok: true, message: "Nothing changed." };
    await saveWhatsAppSettings(changed);
  } catch (error) {
    return { ok: false, error: failure(error, "The details could not be saved.") };
  }

  const names = WHATSAPP_FIELDS.filter((field) => changed[field.key]).map((field) => field.label);
  if (changed.WHATSAPP_AUTO_REPLY) names.push(changed.WHATSAPP_AUTO_REPLY === "true" ? "replies switched on" : "replies switched off");
  void logActivity({ actor: actorLabel(session), action: "whatsapp.setup_saved", entity: "whatsapp", detail: names.join(", ") });
  revalidatePath(SETUP_PATH);

  const settings = await getWhatsAppSettings({ fresh: true });
  const notes: string[] = [];
  const warnings: string[] = [];
  if ((changed.WHATSAPP_PHONE_ID || changed.WHATSAPP_TOKEN) && settings.enabled) {
    const connection = await checkConnection(settings);
    (connection.ok ? notes : warnings).push(`${connection.detail.replace(/\.$/, "")}.`);
  }
  if ((changed.WHATSAPP_APP_ID || changed.WHATSAPP_APP_SECRET) && settings.appId && settings.appSecret) {
    const app = await checkApp(settings);
    if (app.status === "ok") notes.push(app.detail);
    if (app.status === "fail") warnings.push(app.detail);
  }
  return { ok: true, message: ["Saved.", ...notes].join(" "), warning: warnings.join(" ") || undefined };
}

/** Forget every detail entered on the Setup page. Server environment variables still apply. */
export async function forgetWhatsAppDetails(): Promise<{ ok: boolean; message?: string; error?: string }> {
  const session = await requireAdminAction("chatbot.manage");
  let count: number;
  try {
    count = await clearWhatsAppSettings();
  } catch (error) {
    return { ok: false, error: failure(error, "The details could not be removed.") };
  }
  void logActivity({ actor: actorLabel(session), action: "whatsapp.setup_cleared", entity: "whatsapp", detail: `${count} saved details removed` });
  revalidatePath(SETUP_PATH);
  return { ok: true, message: count ? "Removed. Only server environment variables apply now." : "Nothing was saved on this page." };
}

// ─── Verify token ───────────────────────────────────────────────────────────

/** A new random verify token. Meta uses it only when someone presses Verify and save. */
export async function generateWhatsAppVerifyToken(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminAction("chatbot.manage");
  try {
    await saveWhatsAppSettings({ WHATSAPP_VERIFY_TOKEN: newVerifyToken() });
  } catch (error) {
    return { ok: false, error: failure(error, "The verify token could not be saved.") };
  }
  void logActivity({ actor: actorLabel(session), action: "whatsapp.verify_token_generated", entity: "whatsapp", detail: "New webhook verify token" });
  revalidatePath(SETUP_PATH);
  return { ok: true };
}

// ─── Checks ─────────────────────────────────────────────────────────────────

export type ChecksResult = { ok: true; checks: SetupCheck[]; ranAt: string } | { ok: false; error: string };

export async function checkWhatsAppSetup(): Promise<ChecksResult> {
  const session = await requireAdminAction("chatbot.manage");
  // Each run calls Meta several times and the callback URL three times.
  if (!rateLimit(`whatsapp-checks:${session.sub}`, CHECKS_PER_MINUTE, 60_000)) {
    return { ok: false, error: "That is a lot of checks in a minute. Wait a moment and try again." };
  }
  try {
    const settings = await getWhatsAppSettings({ fresh: true });
    return { ok: true, checks: await runWhatsAppChecks(settings), ranAt: new Date().toISOString() };
  } catch (error) {
    return { ok: false, error: failure(error, "The checks could not run.") };
  }
}

/** Point the WhatsApp Business Account's webhooks at the token's app. */
export async function subscribeWhatsAppWebhooks(): Promise<{ ok: boolean; message: string }> {
  const session = await requireAdminAction("chatbot.manage");
  let result: { ok: boolean; message: string };
  try {
    result = await subscribeApp(await getWhatsAppSettings({ fresh: true }));
  } catch (error) {
    return { ok: false, message: failure(error, "The subscription could not be changed.") };
  }
  void logActivity({
    actor: actorLabel(session),
    action: result.ok ? "whatsapp.subscribed" : "whatsapp.subscribe_failed",
    entity: "whatsapp",
    detail: result.message,
  });
  return result;
}
