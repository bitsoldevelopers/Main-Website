import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { decryptSecret, encryptSecret } from "@/lib/admin/social/crypto";
import { WHATSAPP_KEYS, type SettingSource, type WhatsAppKey } from "./fields";

/**
 * WhatsApp Business connection details: the Meta app, the phone number, the
 * access token and the webhook's verify token.
 *
 * They are entered on Admin → Chatbot → Setup and stored encrypted in
 * SiteSetting under "whatsapp.<NAME>", with the key the Social page uses
 * (derived from ADMIN_SECRET). A server environment variable of the same name
 * is used for anything not entered there, and the panel wins when both exist —
 * the same rule as the Social page. Changing a value needs no redeploy.
 *
 * Read on every webhook delivery and every send, so it is cached briefly;
 * saving clears the cache at once.
 */

const PREFIX = "whatsapp.";
const CACHE_MS = 30_000;
/** Graph API version for every WhatsApp call. WHATSAPP_API_VERSION overrides it. */
const DEFAULT_API_VERSION = "v23.0";

export interface WhatsAppSettings {
  values: Record<WhatsAppKey, string>;
  sources: Record<WhatsAppKey, SettingSource>;
  appId: string;
  appSecret: string;
  phoneId: string;
  wabaId: string;
  token: string;
  verifyToken: string;
  /** The assistant answers WhatsApp messages. Off: they are only recorded for the team. */
  autoReply: boolean;
  apiVersion: string;
  /** Messages can be sent: a phone number ID and an access token are set. */
  enabled: boolean;
  /** Meta can deliver to the webhook: a verify token and the app secret are set. */
  webhookReady: boolean;
  /** The callback URL to give Meta. `/webhook` is rewritten to the API route. */
  webhookUrl: string;
  /** Set when the saved details could not be read; the environment is all there is. */
  error?: string;
}

/**
 * The cache lives on globalThis because Next.js loads this module more than
 * once in one server process: the Setup page's actions and the webhook route
 * each get their own copy. A module-level cache would let the webhook keep
 * the old verify token for 30 seconds after a save; a shared one is cleared
 * for both at once.
 */
const shared = globalThis as typeof globalThis & {
  __bitsolWhatsAppSettings?: { settings: WhatsAppSettings; at: number } | null;
};

function fromEnvironment(): Record<WhatsAppKey, string> {
  return Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, process.env[key]?.trim() ?? ""])) as Record<WhatsAppKey, string>;
}

export function buildSettings(
  values: Record<WhatsAppKey, string>,
  sources: Record<WhatsAppKey, SettingSource>,
  error?: string
): WhatsAppSettings {
  const autoReply = !/^(0|false|no|off)$/i.test(values.WHATSAPP_AUTO_REPLY || "true");
  return {
    values,
    sources,
    appId: values.WHATSAPP_APP_ID,
    appSecret: values.WHATSAPP_APP_SECRET,
    phoneId: values.WHATSAPP_PHONE_ID,
    wabaId: values.WHATSAPP_WABA_ID,
    token: values.WHATSAPP_TOKEN,
    verifyToken: values.WHATSAPP_VERIFY_TOKEN,
    autoReply,
    apiVersion: process.env.WHATSAPP_API_VERSION?.trim() || DEFAULT_API_VERSION,
    enabled: Boolean(values.WHATSAPP_PHONE_ID && values.WHATSAPP_TOKEN),
    webhookReady: Boolean(values.WHATSAPP_VERIFY_TOKEN && values.WHATSAPP_APP_SECRET),
    webhookUrl: `${config.appUrl}/webhook`,
    error,
  };
}

export async function getWhatsAppSettings(options: { fresh?: boolean } = {}): Promise<WhatsAppSettings> {
  const cache = shared.__bitsolWhatsAppSettings;
  if (!options.fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.settings;

  const values = fromEnvironment();
  const sources = Object.fromEntries(
    WHATSAPP_KEYS.map((key) => [key, values[key] ? "environment" : "none"])
  ) as Record<WhatsAppKey, SettingSource>;
  let error: string | undefined;

  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    for (const row of rows) {
      const key = row.key.slice(PREFIX.length) as WhatsAppKey;
      if (!WHATSAPP_KEYS.includes(key)) continue;
      try {
        const value = decryptSecret(row.value);
        if (value) {
          values[key] = value;
          sources[key] = "panel";
        }
      } catch {
        // Saved under an ADMIN_SECRET that has since changed: unreadable, so
        // it counts as not entered and has to be pasted again.
      }
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message.split("\n").find(Boolean) : String(caught);
  }

  const settings = buildSettings(values, sources, error);
  // A failed read is kept only briefly, so the webhook recovers with the database.
  shared.__bitsolWhatsAppSettings = { settings, at: error ? Date.now() - CACHE_MS + 5_000 : Date.now() };
  return settings;
}

export function invalidateWhatsAppSettings(): void {
  shared.__bitsolWhatsAppSettings = null;
}

export async function saveWhatsAppSettings(values: Partial<Record<WhatsAppKey, string>>): Promise<void> {
  const entries = WHATSAPP_KEYS.filter((key) => typeof values[key] === "string" && values[key] !== "").map((key) => ({
    key: `${PREFIX}${key}`,
    value: encryptSecret(values[key] as string),
  }));
  await prisma.$transaction(
    entries.map((entry) => prisma.siteSetting.upsert({ where: { key: entry.key }, update: { value: entry.value }, create: entry }))
  );
  invalidateWhatsAppSettings();
}

/** Forget every detail entered on the Setup page; environment variables still apply. */
export async function clearWhatsAppSettings(): Promise<number> {
  const { count } = await prisma.siteSetting.deleteMany({ where: { key: { startsWith: PREFIX } } });
  invalidateWhatsAppSettings();
  return count;
}

/** A verify token for Meta's webhook form: any string works, a long random one is best. */
export function newVerifyToken(): string {
  return randomBytes(20).toString("hex");
}
