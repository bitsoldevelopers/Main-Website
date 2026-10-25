/**
 * The WhatsApp Business details Admin → Chatbot → Setup asks for, and the
 * rules a pasted value must follow. Isomorphic: the setup form renders these
 * fields, the server validates and stores them.
 */

export const WHATSAPP_KEYS = [
  "WHATSAPP_APP_ID",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_WABA_ID",
  "WHATSAPP_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_AUTO_REPLY",
] as const;
export type WhatsAppKey = (typeof WHATSAPP_KEYS)[number];

/** The details typed into the form; the verify token is generated and auto-reply is a switch. */
export type DetailKey = Exclude<WhatsAppKey, "WHATSAPP_VERIFY_TOKEN" | "WHATSAPP_AUTO_REPLY">;

/** Where a value came from: entered on the Setup page, a server environment variable, or nowhere. */
export type SettingSource = "panel" | "environment" | "none";

export interface WhatsAppField {
  key: DetailKey;
  label: string;
  hint: string;
  /** Secrets are never sent back to the browser once saved. */
  secret: boolean;
  /** Digits only. */
  numeric?: boolean;
}

export const WHATSAPP_FIELDS: WhatsAppField[] = [
  {
    key: "WHATSAPP_APP_ID",
    label: "App ID",
    hint: "Meta for Developers → the app with the WhatsApp product → App settings → Basic.",
    secret: false,
    numeric: true,
  },
  {
    key: "WHATSAPP_APP_SECRET",
    label: "App secret",
    hint: "Same screen; press Show. Meta signs every webhook with it, so it must be this app's secret.",
    secret: true,
  },
  {
    key: "WHATSAPP_PHONE_ID",
    label: "Phone number ID",
    hint: "WhatsApp → API Setup. A long number shown under the phone number, not the phone number itself.",
    secret: false,
    numeric: true,
  },
  {
    key: "WHATSAPP_WABA_ID",
    label: "WhatsApp Business Account ID",
    hint: "WhatsApp → API Setup, just above the phone number ID.",
    secret: false,
    numeric: true,
  },
  {
    key: "WHATSAPP_TOKEN",
    label: "Permanent access token",
    hint: "Business Settings → Users → System users → Generate new token, expiry Never, with whatsapp_business_messaging and whatsapp_business_management. The temporary token on API Setup stops working after 24 hours.",
    secret: true,
  },
];

/**
 * What a submitted form changes. Empty inputs keep the value already saved,
 * so a secret does not have to be pasted again to change something else.
 */
export function readWhatsAppInput(
  valueOf: (key: DetailKey) => string,
  current: Record<DetailKey, string>
): { changed: Partial<Record<DetailKey, string>> } | { error: string } {
  const changed: Partial<Record<DetailKey, string>> = {};
  for (const field of WHATSAPP_FIELDS) {
    // Pasted values often carry a stray space or line break.
    const value = valueOf(field.key).replace(/\s+/g, "");
    if (!value || value === current[field.key]) continue;

    if (field.numeric && !/^[0-9]{5,25}$/.test(value)) {
      return { error: `The ${field.label} is a long number with no spaces, letters or + sign.` };
    }
    if (field.key === "WHATSAPP_APP_SECRET" && !/^[a-f0-9]{32}$/i.test(value)) {
      return { error: "An app secret is 32 characters, the digits 0–9 and the letters a–f. Press Show on Meta's screen and copy it again." };
    }
    if (field.key === "WHATSAPP_TOKEN") {
      if (/^[a-f0-9]{32}$/i.test(value)) return { error: "That is an app secret, not an access token." };
      if (value.length < 40 || value.length > 2000) return { error: "That does not look like an access token. They are long and usually start with EAA." };
    }
    changed[field.key] = value;
  }
  return { changed };
}
