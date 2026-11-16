import crypto from "node:crypto";
import { clampText } from "@/lib/bot/render";
import { getWhatsAppSettings, type WhatsAppSettings } from "./settings";
import type { ListRow, ReplyButton } from "./types";

/**
 * =============================================================================
 *  WhatsApp Cloud API client
 * =============================================================================
 *
 *  Thin wrapper over the Graph API `/messages` endpoint plus the webhook
 *  signature check. Dependency-free (`fetch` + `node:crypto`). The number,
 *  token and API version come from the WhatsApp settings (Admin → Chatbot →
 *  Setup, or the server environment).
 *
 *  Every send is best-effort and returns a result object instead of throwing:
 *  a failed reply must never take down the webhook, because Meta reads a
 *  non-200 as "redeliver this message" and the customer would be answered
 *  twice once the outage clears.
 * =============================================================================
 */

const GRAPH_HOST = "https://graph.facebook.com";

/** WhatsApp hard-caps a text body at 4096 characters. */
const MAX_BODY = 4096;

export interface SendResult {
  ok: boolean;
  /** `wamid.…` of the message Meta accepted. */
  messageId?: string;
  error?: string;
}

async function post(payload: Record<string, unknown>): Promise<SendResult> {
  const settings = await getWhatsAppSettings();
  if (!settings.enabled) {
    return { ok: false, error: "WhatsApp is not connected: add the phone number ID and access token under Admin → Chatbot → Setup." };
  }

  try {
    const response = await fetch(`${GRAPH_HOST}/${settings.apiVersion}/${settings.phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
      // A hung Graph call must not hold the webhook open indefinitely.
      signal: AbortSignal.timeout(15_000),
    });

    const body = (await response.json().catch(() => null)) as
      | { messages?: Array<{ id?: string }>; error?: { message?: string } }
      | null;

    if (!response.ok) {
      const message = body?.error?.message ?? `HTTP ${response.status}`;
      console.error("[whatsapp] send failed:", message);
      return { ok: false, error: message };
    }

    return { ok: true, messageId: body?.messages?.[0]?.id };
  } catch (error) {
    const message = unreachable(error, 15);
    console.error("[whatsapp] send error:", message);
    return { ok: false, error: message };
  }
}

/**
 * Split a reply that exceeds WhatsApp's 4096-character limit.
 *
 * Prefers paragraph breaks, then sentence ends, then a hard cut — a chopped
 * word looks broken in a chat thread in a way it never does in a web bubble.
 */
export function splitForWhatsApp(text: string, limit = MAX_BODY): string[] {
  const clean = text.trim();
  if (clean.length <= limit) return clean ? [clean] : [];

  const parts: string[] = [];
  let rest = clean;

  while (rest.length > limit) {
    const window = rest.slice(0, limit);
    const breakAt =
      lastIndexBefore(window, "\n\n") ??
      lastIndexBefore(window, "\n") ??
      lastIndexBefore(window, ". ") ??
      lastIndexBefore(window, " ") ??
      limit;
    parts.push(rest.slice(0, breakAt).trim());
    rest = rest.slice(breakAt).trim();
  }

  if (rest) parts.push(rest);
  return parts;
}

function lastIndexBefore(window: string, needle: string): number | null {
  const index = window.lastIndexOf(needle);
  // Only accept a break in the last third, or long replies fragment into
  // needlessly short bubbles.
  return index > window.length * 0.6 ? index + needle.length : null;
}

/**
 * Convert the assistant's markdown to WhatsApp's formatting.
 *
 * WhatsApp understands `*bold*`, `_italic_` and ```` ```code``` ```` only.
 * Left alone, `**text**` and `### Heading` render as literal asterisks and
 * hashes in the customer's thread.
 */
export function toWhatsAppMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s*(.+)$/gm, "*$1*") // headings → bold line
    .replace(/\*\*(.+?)\*\*/gs, "*$1*") // bold
    .replace(/(^|[\s(])__(.+?)__(?=[\s).,!?]|$)/gs, "$1_$2_") // underscore bold
    .replace(/^\s*[-*]\s+/gm, "• ") // bullets
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, "$1: $2") // links
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Send a plain text reply, splitting it across bubbles when it is too long. */
export async function sendText(to: string, text: string): Promise<SendResult> {
  const chunks = splitForWhatsApp(toWhatsAppMarkdown(text));
  if (!chunks.length) return { ok: true };

  let last: SendResult = { ok: true };
  for (const chunk of chunks) {
    last = await post({
      to,
      type: "text",
      // No link preview card on top of every answer that mentions the website.
      text: { preview_url: false, body: chunk },
    });
    if (!last.ok) break;
  }
  return last;
}

/** Send up to three tappable reply buttons. */
export async function sendButtons(to: string, body: string, buttons: ReplyButton[], footer?: string): Promise<SendResult> {
  const usable = buttons.slice(0, 3);
  if (!usable.length) return sendText(to, body);

  return post({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: clamp(toWhatsAppMarkdown(body), 1024) },
      ...(footer ? { footer: { text: clamp(footer, 60) } } : {}),
      action: {
        buttons: usable.map((button) => ({
          type: "reply",
          reply: { id: clamp(button.id, 256), title: clamp(button.title, 20) },
        })),
      },
    },
  });
}

/** Send a tappable list — used where there are more options than three. */
export async function sendList(
  to: string,
  body: string,
  buttonLabel: string,
  rows: ListRow[],
  header?: string,
  footer?: string
): Promise<SendResult> {
  const usable = rows.slice(0, 10);
  if (!usable.length) return sendText(to, body);

  return post({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(header ? { header: { type: "text", text: clamp(header, 60) } } : {}),
      body: { text: clamp(toWhatsAppMarkdown(body), 1024) },
      ...(footer ? { footer: { text: clamp(footer, 60) } } : {}),
      action: {
        button: clamp(buttonLabel, 20),
        sections: [
          {
            title: "Options",
            rows: usable.map((row) => ({
              id: clamp(row.id, 200),
              title: clamp(row.title, 24),
              ...(row.description ? { description: clamp(row.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
}

/** The picture, clip or file at the top of a template with a media header. */
export interface TemplateHeaderMedia {
  format: "IMAGE" | "VIDEO" | "DOCUMENT";
  /** Public URL Meta can fetch, or a media id already uploaded to the account. */
  link: string;
  /** Shown as the file name on a document header. */
  filename?: string;
}

export interface TemplateHeader {
  /** Values for a text header's `{{1}}`, `{{2}}`… */
  text?: string[];
  media?: TemplateHeaderMedia;
}

/** The `template` object of a template send, as Meta's `/messages` wants it. */
export function templatePayload(templateName: string, languageCode: string, variables: string[], header?: TemplateHeader): Record<string, unknown> {
  const components: Array<Record<string, unknown>> = [];
  const headerParameters: Array<Record<string, unknown>> = [];

  if (header?.media) {
    const { format, link, filename } = header.media;
    const kind = format.toLowerCase(); // image | video | document
    headerParameters.push({
      type: kind,
      // Meta accepts either `link` (a public URL it fetches) or `id` (media
      // already uploaded). A value that is all digits can only be an id.
      [kind]: {
        ...(/^\d+$/.test(link) ? { id: link } : { link }),
        ...(filename && kind === "document" ? { filename } : {}),
      },
    });
  }
  for (const text of header?.text ?? []) headerParameters.push({ type: "text", text });
  if (headerParameters.length) components.push({ type: "header", parameters: headerParameters });

  if (variables.length) {
    components.push({ type: "body", parameters: variables.map((text) => ({ type: "text", text })) });
  }

  return {
    name: templateName,
    language: { code: languageCode },
    ...(components.length ? { components } : {}),
  };
}

/**
 * Send a pre-approved template — required to open a conversation outside the
 * 24-hour customer service window (follow-ups after a day, broadcasts).
 * `variables` fills the BODY's `{{1}}`, `{{2}}`… in order; Meta only ever
 * sees positions. A template whose header is an image, video or document
 * needs `header.media` on every send: Meta does not keep the file that was
 * approved, and omitting it fails the message rather than sending it
 * without a picture.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  languageCode = "en",
  variables: string[] = [],
  header?: TemplateHeader
): Promise<SendResult> {
  return post({ to, type: "template", template: templatePayload(templateName, languageCode, variables, header) });
}

/** Mark an inbound message as read (blue ticks). */
export async function markAsRead(messageId: string): Promise<void> {
  await post({ status: "read", message_id: messageId });
}

// ------------------------------------------------------- Connection check ---

export interface ConnectionCheck {
  ok: boolean;
  /** One line, written for whoever is looking at the admin panel. */
  detail: string;
  /** Present on success — proof of which number the credentials actually open. */
  number?: string;
  verifiedName?: string;
  qualityRating?: string;
  /** CONNECTED once the number is registered and live on the Cloud API. */
  status?: string;
  /** CLOUD_API for a number this app can send from. */
  platformType?: string;
  codeVerificationStatus?: string;
  /** Present on failure — Meta's own error code, worth quoting in a support thread. */
  code?: number;
}

const PHONE_FIELDS = "display_phone_number,verified_name,quality_rating,status,platform_type,code_verification_status";
const BASIC_PHONE_FIELDS = "display_phone_number,verified_name,quality_rating,status";

interface PhoneBody {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  status?: string;
  platform_type?: string;
  code_verification_status?: string;
  error?: { message?: string; code?: number };
}

/**
 * Ask Meta, from this server, whether the phone number ID and access token
 * work together. The value is in *where* it runs: a token can work from a
 * laptop and still fail in production, because the server holds a different
 * value or cannot reach Meta at all. Read-only: it sends nothing.
 */
export async function checkConnection(given?: WhatsAppSettings): Promise<ConnectionCheck> {
  const settings = given ?? (await getWhatsAppSettings());
  if (!settings.phoneId || !settings.token) {
    return { ok: false, detail: "No phone number ID or access token yet. Add them under WhatsApp details." };
  }

  const ask = async (fields: string) => {
    const response = await fetch(`${GRAPH_HOST}/${settings.apiVersion}/${settings.phoneId}?fields=${fields}`, {
      headers: { Authorization: `Bearer ${settings.token}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    return { response, body: (await response.json().catch(() => null)) as PhoneBody | null };
  };

  try {
    let { response, body } = await ask(PHONE_FIELDS);
    // A field this API version does not know is a #100 error; the basic set always exists.
    if (!response.ok && body?.error?.code === 100 && /nonexist/i.test(body.error.message ?? "")) {
      ({ response, body } = await ask(BASIC_PHONE_FIELDS));
    }

    if (!response.ok) {
      const code = body?.error?.code;
      return {
        ok: false,
        code,
        detail:
          code === 190
            ? "Meta rejected the access token: it is invalid or has expired. Paste a permanent System User token."
            : code === 100
              ? "Meta does not know this phone number ID, or the token has no access to it. Check the phone number ID."
              : body?.error?.message ?? `Meta returned HTTP ${response.status}.`,
      };
    }

    return {
      ok: true,
      detail: `Connected as ${body?.verified_name ?? "this business"} · ${body?.display_phone_number ?? "number unknown"}${
        body?.status ? ` · ${body.status.toLowerCase()}` : ""
      }`,
      number: body?.display_phone_number,
      verifiedName: body?.verified_name,
      qualityRating: body?.quality_rating,
      status: body?.status,
      platformType: body?.platform_type,
      codeVerificationStatus: body?.code_verification_status,
    };
  } catch (error) {
    return { ok: false, detail: unreachable(error, 8) };
  }
}

/** Why Meta could not be reached, in words that point at the cause. */
export function unreachable(error: unknown, seconds: number): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw === "fetch failed" || /ENOTFOUND|ECONNREFUSED|EAI_AGAIN/.test(raw)
    ? `This server cannot reach graph.facebook.com (${raw}). Outbound HTTPS is being blocked.`
    : /timed? ?out|aborted/i.test(raw)
      ? `Timed out reaching graph.facebook.com after ${seconds}s.`
      : raw;
}

// ------------------------------------------------------------- Signature ----

/**
 * Verify Meta's `X-Hub-Signature-256` header against the raw request body.
 *
 * The webhook URL is public, so without this anyone could POST a fabricated
 * "customer message" and drive the assistant — or fill the CRM with junk leads.
 * `secret` is the app secret of the Meta app the webhook is configured in. The
 * comparison is timing-safe.
 */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret) return false;
  if (!header?.startsWith("sha256=")) return false;

  const received = header.slice("sha256=".length);
  // Anything but 64 hex characters cannot match, and must not reach
  // `timingSafeEqual`, which throws when the decoded lengths differ.
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

/** The header Meta would send for `rawBody` — used by the Setup page's self-test. */
export function signBody(rawBody: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

// ------------------------------------------------------------------ utils ---

/** Shorten without splitting an emoji — a half emoji renders as a broken glyph. */
function clamp(text: string, max: number): string {
  return clampText(text, max);
}

/** `923001234567` → `+923001234567`, the form the CRM stores. */
export function toDisplayPhone(waId: string): string {
  const digits = waId.replace(/\D/g, "");
  return digits ? `+${digits}` : waId;
}
