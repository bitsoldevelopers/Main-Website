import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "./crypto";

/**
 * App details for Admin → Social: the ids and secrets that LinkedIn, Facebook
 * and Google issue for BITSOL's apps.
 *
 * They are entered on the Social page and stored encrypted in SiteSetting
 * under "social.<NAME>". A server environment variable of the same name is
 * used for anything not entered there, so either way of setting them works
 * and the panel wins when both exist.
 */

export const SETUP_KEYS = [
  "LINKEDIN_CLIENT_ID",
  "LINKEDIN_CLIENT_SECRET",
  "LINKEDIN_COMPANY_ID",
  "FACEBOOK_APP_ID",
  "FACEBOOK_APP_SECRET",
  "GEMINI_API_KEY",
] as const;
export type SetupKey = (typeof SETUP_KEYS)[number];

/** Every value, "" when it is set nowhere. */
export type SocialConfig = Record<SetupKey, string>;

export const SETUP_GROUPS = ["LINKEDIN", "FACEBOOK", "AI"] as const;
export type SetupGroup = (typeof SETUP_GROUPS)[number];

export interface SetupField {
  key: SetupKey;
  label: string;
  hint: string;
  /** Secrets are never sent back to the browser once saved. */
  secret: boolean;
  /** Digits only. */
  numeric?: boolean;
}

export const SETUP_FIELDS: Record<SetupGroup, SetupField[]> = {
  LINKEDIN: [
    { key: "LINKEDIN_CLIENT_ID", label: "Client ID", hint: "LinkedIn Developers → your app → Auth.", secret: false },
    { key: "LINKEDIN_CLIENT_SECRET", label: "Primary Client Secret", hint: "Same screen, under the Client ID.", secret: true },
    {
      key: "LINKEDIN_COMPANY_ID",
      label: "Company page ID",
      hint: "The number in the page's admin address: linkedin.com/company/12345678/admin",
      secret: false,
      numeric: true,
    },
  ],
  FACEBOOK: [
    { key: "FACEBOOK_APP_ID", label: "App ID", hint: "Meta for Developers → your app → App settings → Basic.", secret: false, numeric: true },
    { key: "FACEBOOK_APP_SECRET", label: "App secret", hint: "Same screen; press Show.", secret: true },
  ],
  AI: [{ key: "GEMINI_API_KEY", label: "Gemini API key", hint: "Free from aistudio.google.com/apikey", secret: true }],
};

export function isSetupGroup(value: string): value is SetupGroup {
  return (SETUP_GROUPS as readonly string[]).includes(value);
}

/** The fields of a group that have no value yet. */
export function missingSetup(group: SetupGroup, config: SocialConfig): SetupField[] {
  return SETUP_FIELDS[group].filter((field) => !config[field.key]);
}

/**
 * What a submitted form changes. Empty fields keep the value they have, so a
 * secret does not have to be typed again to change something else.
 */
export function readSetupInput(
  group: SetupGroup,
  valueOf: (key: SetupKey) => string,
  current: SocialConfig
): { changed: Partial<SocialConfig> } | { error: string } {
  const changed: Partial<SocialConfig> = {};
  for (const field of SETUP_FIELDS[group]) {
    const value = valueOf(field.key).trim();
    if (!value || value === current[field.key]) continue;
    if (value.length > 500) return { error: `The ${field.label} is too long to be right.` };
    if (field.numeric && !/^[0-9]+$/.test(value)) {
      return { error: `The ${field.label} is a number, with no spaces or letters.` };
    }
    changed[field.key] = value;
  }
  if (Object.keys(changed).length === 0) return { error: "Nothing was changed." };
  return { changed };
}

const PREFIX = "social.";

function fromEnvironment(): SocialConfig {
  return Object.fromEntries(SETUP_KEYS.map((key) => [key, process.env[key] ?? ""])) as SocialConfig;
}

export async function getSocialConfig(): Promise<SocialConfig> {
  const config = fromEnvironment();
  try {
    const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
    for (const row of rows) {
      const key = row.key.slice(PREFIX.length) as SetupKey;
      if (!SETUP_KEYS.includes(key)) continue;
      try {
        const value = decryptSecret(row.value);
        if (value) config[key] = value;
      } catch {
        // Saved under an ADMIN_SECRET that has since changed: unreadable, so
        // it counts as not entered and has to be typed in again.
      }
    }
  } catch {
    // Database unreachable: the environment variables are all there is.
  }
  return config;
}

export async function saveSocialConfig(values: Partial<SocialConfig>): Promise<void> {
  const entries = SETUP_KEYS.filter((key) => values[key]).map((key) => ({
    key: `${PREFIX}${key}`,
    value: encryptSecret(values[key] as string),
  }));
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.siteSetting.upsert({ where: { key: entry.key }, update: { value: entry.value }, create: entry })
    )
  );
}

// ─── Checking the details with the service that issued them ─────────────────

const CHECK_TIMEOUT = 20_000;

async function check(url: string, init?: RequestInit): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(CHECK_TIMEOUT) });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, body };
}

/**
 * Asks the service whether it recognises the details, so a typing mistake
 * shows up when they are saved and not later as a failed connection. Returns
 * what is wrong, or null when the details are good.
 */
export async function verifySetup(group: SetupGroup, config: SocialConfig): Promise<string | null> {
  try {
    if (group === "LINKEDIN") {
      // There is no "check my app" call; asking about a token that does not
      // exist is answered differently for a known app and an unknown one.
      const { body } = await check("https://www.linkedin.com/oauth/v2/introspectToken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.LINKEDIN_CLIENT_ID,
          client_secret: config.LINKEDIN_CLIENT_SECRET,
          token: "not-a-token",
        }),
      });
      if (body?.error === "invalid_client_id") return "LinkedIn does not know this Client ID.";
      if (body?.error === "invalid_client") return "LinkedIn rejected the Client Secret for this Client ID.";
      return null;
    }

    if (group === "FACEBOOK") {
      const query = new URLSearchParams({
        client_id: config.FACEBOOK_APP_ID,
        client_secret: config.FACEBOOK_APP_SECRET,
        grant_type: "client_credentials",
      });
      const { body } = await check(`https://graph.facebook.com/oauth/access_token?${query}`);
      if (body?.access_token) return null;
      const error = body?.error as { message?: string } | undefined;
      return `Facebook rejected these app details${error?.message ? `: ${error.message}` : "."}`;
    }

    const { status } = await check("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": config.GEMINI_API_KEY },
    });
    return status === 200 ? null : "Google rejected this API key.";
  } catch {
    return "The service could not be reached to check these details. Try again in a moment.";
  }
}
