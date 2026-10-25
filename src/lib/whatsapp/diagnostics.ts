import { prisma } from "@/lib/prisma";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { checkConnection, signBody, unreachable } from "./client";
import { SELF_TEST_HEADER, SELF_TEST_VALUE } from "./self-test";
import type { WhatsAppSettings } from "./settings";

/**
 * =============================================================================
 *  WhatsApp setup checks — Admin → Chatbot → Setup
 * =============================================================================
 *
 *  Each check asks the party that decides: Meta for the app, the token, the
 *  number and the webhook subscription; the callback URL itself for the
 *  verify token and the app secret (called exactly the way Meta calls it);
 *  the activity log for what Meta has done so far. Every result says what is
 *  wrong and what to do about it. Nothing here returns a secret.
 * =============================================================================
 */

export type CheckStatus = "ok" | "warn" | "fail" | "skip";

export interface SetupCheck {
  id: "app" | "token" | "phone" | "callback" | "signature" | "verified" | "subscription" | "inbound" | "replies";
  label: string;
  status: CheckStatus;
  detail: string;
  /** What to do about it, when something is wrong. */
  fix?: string;
  /** The "Subscribe this app" button applies to this result. */
  canSubscribe?: boolean;
}

const GRAPH = "https://graph.facebook.com";
const TIMEOUT_MS = 15_000;
const WEEK_MS = 7 * 24 * 3_600_000;

interface GraphError {
  message?: string;
  code?: number;
}

interface GraphResult<T> {
  ok: boolean;
  /** 0 when Meta could not be reached at all. */
  status: number;
  data: T | null;
  error?: GraphError;
}

/** One Graph API call. The token travels in the header, never in a URL. */
async function graph<T>(
  settings: WhatsAppSettings,
  path: string,
  options: { token: string; method?: "GET" | "POST"; query?: Record<string, string> }
): Promise<GraphResult<T>> {
  const url = new URL(`${GRAPH}/${settings.apiVersion}/${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  try {
    const res = await fetch(url, {
      method: options.method ?? "GET",
      headers: { Authorization: `Bearer ${options.token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as (T & { error?: GraphError }) | null;
    if (!res.ok || body?.error) return { ok: false, status: res.status, data: null, error: body?.error ?? { message: `HTTP ${res.status}` } };
    return { ok: true, status: res.status, data: body };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: { message: unreachable(error, TIMEOUT_MS / 1000) } };
  }
}

/** Meta's error message without a trailing full stop, to sit inside a sentence. */
function said(error?: GraphError): string {
  return (error?.message ?? "no details").replace(/\.\s*$/, "");
}

const RANK: Record<CheckStatus, number> = { ok: 0, skip: 1, warn: 2, fail: 3 };

function worst(statuses: CheckStatus[]): CheckStatus {
  return statuses.reduce<CheckStatus>((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
}

interface Finding {
  status: CheckStatus;
  text: string;
  fix?: string;
}

/** The fix that belongs to the most serious finding. */
function fixFor(findings: Finding[], status: CheckStatus): string | undefined {
  return findings.find((finding) => finding.status === status && finding.fix)?.fix;
}

function when(date: Date): string {
  const hours = (date.getTime() - Date.now()) / 3_600_000;
  if (hours <= 0) return `on ${formatDate(date, { time: true })}, so it has run out`;
  if (hours < 48) return `in ${Math.max(1, Math.round(hours))} hours`;
  return `on ${formatDate(date)}`;
}

// ─── App ID and secret ──────────────────────────────────────────────────────

export async function checkApp(settings: WhatsAppSettings): Promise<SetupCheck> {
  const label = "App ID and secret";
  if (!settings.appSecret) {
    return {
      id: "app",
      label,
      status: "fail",
      detail: "No app secret is saved. Meta signs every delivery with it, so every message would be refused.",
      fix: "Paste the app secret under WhatsApp details.",
    };
  }
  if (!settings.appId) {
    return {
      id: "app",
      label,
      status: "warn",
      detail: "The app secret is saved, but it cannot be checked with Meta without the App ID.",
      fix: "Paste the App ID under WhatsApp details.",
    };
  }

  // An app token is "<app id>|<app secret>": Meta answers only when they belong together.
  const result = await graph<{ id?: string; name?: string }>(settings, settings.appId, {
    token: `${settings.appId}|${settings.appSecret}`,
    query: { fields: "id,name" },
  });
  if (result.ok) {
    return { id: "app", label, status: "ok", detail: `Meta confirms the secret belongs to ${result.data?.name ?? "the app"} (${settings.appId}).` };
  }
  if (result.status === 0) {
    return { id: "app", label, status: "warn", detail: `Could not be checked. ${said(result.error)}.` };
  }
  return {
    id: "app",
    label,
    status: "fail",
    detail: `Meta does not accept this App ID and secret together: ${said(result.error)}.`,
    fix: "Copy both again from App settings → Basic of the app that has the WhatsApp product.",
  };
}

// ─── Access token ───────────────────────────────────────────────────────────

interface DebugToken {
  data?: {
    app_id?: string;
    application?: string;
    type?: string;
    is_valid?: boolean;
    expires_at?: number;
    scopes?: string[];
    granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
    error?: { code?: number; message?: string };
  };
}

export interface TokenFacts {
  /** WhatsApp Business Accounts the token was granted, from its granular scopes. */
  wabaIds: string[];
  appId?: string;
}

export async function checkToken(settings: WhatsAppSettings): Promise<{ check: SetupCheck; facts: TokenFacts }> {
  const label = "Access token";
  const none: TokenFacts = { wabaIds: [] };
  if (!settings.token) {
    return {
      check: { id: "token", label, status: "fail", detail: "No access token is saved.", fix: "Paste a permanent System User token under WhatsApp details." },
      facts: none,
    };
  }

  // Meta describes a token to the app it belongs to. The app token is the
  // reliable way in; the token itself is accepted for some token types.
  const viaApp = Boolean(settings.appId && settings.appSecret);
  const result = await graph<DebugToken>(settings, "debug_token", {
    token: viaApp ? `${settings.appId}|${settings.appSecret}` : settings.token,
    query: { input_token: settings.token },
  });
  const info = result.data?.data;
  if (!result.ok || !info) {
    return {
      check: {
        id: "token",
        label,
        status: "warn",
        detail: viaApp ? `Meta did not describe the token: ${said(result.error)}.` : "Meta only describes a token to the app it was made in.",
        fix: viaApp
          ? "Check the App ID and app secret: they must be those of the app the token was made in."
          : "Add the App ID and app secret to see when the token expires and what it may do.",
      },
      facts: none,
    };
  }

  const scopes = info.scopes ?? [];
  const wabaIds = Array.from(
    new Set((info.granular_scopes ?? []).filter((grant) => grant.scope?.startsWith("whatsapp_business")).flatMap((grant) => grant.target_ids ?? []))
  );
  const facts: TokenFacts = { wabaIds, appId: info.app_id };

  if (!info.is_valid) {
    return {
      check: {
        id: "token",
        label,
        status: "fail",
        detail: `Meta says this token no longer works${info.error?.message ? `: ${said(info.error)}` : ""}.`,
        fix: "Generate a new System User token and paste it under WhatsApp details.",
      },
      facts,
    };
  }

  const kind = info.type === "SYSTEM_USER" ? "System User token" : info.type === "USER" ? "personal user token" : `${(info.type ?? "unknown").toLowerCase()} token`;
  const expires = info.expires_at && info.expires_at > 0 ? new Date(info.expires_at * 1000) : null;
  const findings: Finding[] = [];

  if (!scopes.includes("whatsapp_business_messaging")) {
    findings.push({
      status: "fail",
      text: "It cannot send WhatsApp messages, because whatsapp_business_messaging was not granted.",
      fix: "Generate the token again with whatsapp_business_messaging ticked.",
    });
  }
  if (expires) {
    findings.push({
      status: "warn",
      text: `It expires ${when(expires)}.`,
      fix: "Use a System User token with expiry set to Never, or the assistant goes silent when this one runs out.",
    });
  }
  if (!scopes.includes("whatsapp_business_management")) {
    findings.push({
      status: "warn",
      text: "It cannot manage the account (whatsapp_business_management), so the webhook subscription cannot be checked or fixed from here.",
      fix: "Generate the token again with whatsapp_business_management ticked.",
    });
  }
  if (settings.appId && info.app_id && info.app_id !== settings.appId) {
    findings.push({
      status: "warn",
      text: `It was made in another Meta app (${info.application ?? info.app_id}).`,
      fix: "Generate the token in the app whose App ID and secret are saved here.",
    });
  }

  const status = worst(findings.map((finding) => finding.status));
  const intro = `A ${kind} of ${info.application ?? "the app"}${expires ? "" : " that never expires"}.`;
  return {
    check: {
      id: "token",
      label,
      status,
      detail: [intro, ...findings.map((finding) => finding.text), status === "ok" ? "It can send messages and manage the account." : ""].filter(Boolean).join(" "),
      fix: fixFor(findings, status),
    },
    facts,
  };
}

// ─── Phone number ───────────────────────────────────────────────────────────

export async function checkPhone(settings: WhatsAppSettings): Promise<SetupCheck> {
  const label = "Phone number";
  if (!settings.phoneId) {
    return { id: "phone", label, status: "fail", detail: "No phone number ID is saved.", fix: "Paste the phone number ID from WhatsApp → API Setup." };
  }
  if (!settings.token) return { id: "phone", label, status: "skip", detail: "Needs the access token." };

  const connection = await checkConnection(settings);
  if (!connection.ok) {
    return {
      id: "phone",
      label,
      status: "fail",
      detail: connection.detail,
      fix: /appsecret_proof/i.test(connection.detail)
        ? "The app demands an app secret proof on every call. Switch off Require App Secret under App settings → Advanced."
        : "Check the phone number ID, and that the token was granted this WhatsApp account.",
    };
  }

  const findings: Finding[] = [];
  if (connection.platformType === "ON_PREMISE") {
    findings.push({ status: "fail", text: "Meta lists the number on the On-Premises API, not the Cloud API.", fix: "Move the number to the Cloud API in WhatsApp Manager." });
  } else if (connection.platformType === "NOT_APPLICABLE") {
    findings.push({
      status: "warn",
      text: "The number is not registered for the Cloud API yet, so it cannot send.",
      fix: "Register it under WhatsApp → API Setup, with a 6-digit PIN you choose.",
    });
  }
  if (connection.status && connection.status !== "CONNECTED") {
    findings.push({
      status: "warn",
      text: `Meta reports the number as ${connection.status.toLowerCase()}.`,
      fix: "Open WhatsApp Manager → Phone numbers to see why. A new number must be registered for the Cloud API before it can send.",
    });
  }
  if (connection.qualityRating === "RED") {
    findings.push({ status: "warn", text: "Its quality rating is red, so Meta may limit how many people it can message." });
  }

  const status = worst(findings.map((finding) => finding.status));
  return {
    id: "phone",
    label,
    status,
    detail: [
      `${connection.number ?? "The number"} · ${connection.verifiedName ?? "no display name"}${connection.qualityRating ? ` · quality ${connection.qualityRating.toLowerCase()}` : ""}.`,
      ...findings.map((finding) => finding.text),
    ].join(" "),
    fix: fixFor(findings, status),
  };
}

// ─── The callback URL, called the way Meta calls it ──────────────────────────

export interface HandshakeProbe {
  status: number;
  echoed: boolean;
  /** The start of the answer, to tell this webhook's refusals from a firewall's. */
  body: string;
  location?: string | null;
  error?: string;
}

export async function probeHandshake(url: string, verifyToken: string): Promise<HandshakeProbe> {
  const challenge = String(1_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
  const target = new URL(url);
  target.searchParams.set("hub.mode", "subscribe");
  target.searchParams.set("hub.verify_token", verifyToken);
  target.searchParams.set("hub.challenge", challenge);
  try {
    // Meta does not follow redirects, so neither does the test.
    const res = await fetch(target, {
      headers: { [SELF_TEST_HEADER]: SELF_TEST_VALUE },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.text().catch(() => "")).trim().slice(0, 300);
    return { status: res.status, echoed: res.status === 200 && body === challenge, body, location: res.headers.get("location") };
  } catch (error) {
    return { status: 0, echoed: false, body: "", error: error instanceof Error ? error.message : String(error) };
  }
}

export interface SignatureProbe {
  signed: number;
  unsigned: number;
  error?: string;
}

/** A delivery with nothing in it, signed the way Meta signs, and the same with a wrong signature. */
export async function probeSignature(url: string, secret: string): Promise<SignatureProbe> {
  const payload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "self-test", changes: [{ field: "messages", value: { messaging_product: "whatsapp", statuses: [] } }] }],
  });
  const send = (signature: string) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature, [SELF_TEST_HEADER]: SELF_TEST_VALUE },
      body: payload,
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  try {
    const [signed, unsigned] = await Promise.all([send(signBody(payload, secret)), send(`sha256=${"0".repeat(64)}`)]);
    return { signed: signed.status, unsigned: unsigned.status };
  } catch (error) {
    return { signed: 0, unsigned: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function isPublicHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !/^(localhost|127\.|0\.0\.0\.0|\[::1\]|10\.|192\.168\.)/.test(parsed.hostname);
  } catch {
    return false;
  }
}

export async function checkCallback(settings: WhatsAppSettings): Promise<SetupCheck> {
  const label = "Callback URL";
  const url = settings.webhookUrl;
  if (!settings.verifyToken) {
    return { id: "callback", label, status: "fail", detail: "There is no verify token yet.", fix: "Press Generate a verify token." };
  }

  const probe = await probeHandshake(url, settings.verifyToken);
  if (probe.error) {
    return {
      id: "callback",
      label,
      status: "fail",
      detail: `${url} could not be reached from this server: ${probe.error}.`,
      fix: "Open the address in a browser. If it answers there, only this server cannot reach it, and Meta's own check is what counts.",
    };
  }
  if (probe.status >= 300 && probe.status < 400) {
    return {
      id: "callback",
      label,
      status: "fail",
      detail: `${url} redirects${probe.location ? ` to ${probe.location}` : ""}, and Meta does not follow redirects.`,
      fix: "Give Meta the address it redirects to, or remove the redirect.",
    };
  }
  if (probe.status === 404) {
    return {
      id: "callback",
      label,
      status: "fail",
      detail: `There is no webhook at ${url} yet.`,
      fix: "Deploy this version of the website, then run the checks again.",
    };
  }
  if (probe.status === 500 && probe.body === "Webhook not configured") {
    return {
      id: "callback",
      label,
      status: "fail",
      detail: `The site at ${url} has no verify token yet.`,
      fix: "Generate a verify token on the Setup page of the site Meta calls.",
    };
  }
  if (probe.status === 403 && probe.body === "Forbidden") {
    return {
      id: "callback",
      label,
      status: "fail",
      detail: `${url} answered, but it holds a different verify token from this page.`,
      fix: "Run these checks on the Setup page of the site at that address, and give Meta the verify token shown there.",
    };
  }
  if (!probe.echoed) {
    return {
      id: "callback",
      label,
      status: "fail",
      detail: `${url} gave an unexpected answer (HTTP ${probe.status}). Something in front of the site may be answering instead of the webhook.`,
      fix: "Open the address in a browser to see what answers there.",
    };
  }
  if (!isPublicHttps(url)) {
    return { id: "callback", label, status: "warn", detail: `${url} answers the verification, but Meta only calls public HTTPS addresses.` };
  }
  return { id: "callback", label, status: "ok", detail: `${url} answers Meta's verification request with this verify token.` };
}

export async function checkSignature(settings: WhatsAppSettings, callbackAnswers: boolean): Promise<SetupCheck> {
  const label = "Signature check";
  if (!settings.appSecret) {
    return { id: "signature", label, status: "fail", detail: "Needs the app secret: without it every delivery is refused.", fix: "Paste the app secret under WhatsApp details." };
  }
  // Only a site that holds this page's verify token is sent signed test deliveries.
  if (!callbackAnswers) return { id: "signature", label, status: "skip", detail: "Runs once the callback URL check passes." };

  const probe = await probeSignature(settings.webhookUrl, settings.appSecret);
  if (probe.error) {
    return { id: "signature", label, status: "fail", detail: `${settings.webhookUrl} could not be reached from this server: ${probe.error}.` };
  }
  if (probe.signed === 200 && probe.unsigned === 401) {
    return { id: "signature", label, status: "ok", detail: "A delivery signed with this app secret is accepted, and one with a wrong signature is refused." };
  }
  if (probe.signed === 401) {
    return {
      id: "signature",
      label,
      status: "fail",
      detail: "The site refused a delivery signed with this app secret, so it holds a different one.",
      fix: "Run these checks on the Setup page of the site Meta calls.",
    };
  }
  if (probe.unsigned === 200) {
    return { id: "signature", label, status: "fail", detail: "The site accepted a delivery with a wrong signature." };
  }
  return { id: "signature", label, status: "fail", detail: `Unexpected answers: HTTP ${probe.signed} for the signed delivery, HTTP ${probe.unsigned} for the other.` };
}

// ─── What Meta has done so far ──────────────────────────────────────────────

export interface WebhookHistory {
  verifiedAt: Date | null;
  failedAt: Date | null;
  lastInboundAt: Date | null;
  /** Deliveries refused for a bad signature in the last 7 days (logging is capped, so at least this many). */
  rejected: number;
}

export async function webhookHistory(): Promise<WebhookHistory | null> {
  const latest = (action: string) =>
    prisma.activityLog.findFirst({ where: { entity: "whatsapp", action }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  try {
    const [verified, failed, contact, rejected] = await Promise.all([
      latest("whatsapp.webhook.verified"),
      latest("whatsapp.webhook.verify_failed"),
      prisma.whatsappContact.findFirst({ where: { lastInboundAt: { not: null } }, orderBy: { lastInboundAt: "desc" }, select: { lastInboundAt: true } }),
      prisma.activityLog.count({
        where: { entity: "whatsapp", action: "whatsapp.webhook.rejected", createdAt: { gte: new Date(Date.now() - WEEK_MS) } },
      }),
    ]);
    return { verifiedAt: verified?.createdAt ?? null, failedAt: failed?.createdAt ?? null, lastInboundAt: contact?.lastInboundAt ?? null, rejected };
  } catch {
    return null;
  }
}

export function checkVerified(history: WebhookHistory | null): SetupCheck {
  const label = "Verified by Meta";
  if (!history) return { id: "verified", label, status: "skip", detail: "The activity log could not be read." };
  const { verifiedAt, failedAt } = history;
  if (verifiedAt && (!failedAt || failedAt < verifiedAt)) {
    return { id: "verified", label, status: "ok", detail: `Meta verified the callback URL ${timeAgo(verifiedAt)}.` };
  }
  if (failedAt) {
    return {
      id: "verified",
      label,
      status: "fail",
      detail: `A verification request arrived ${timeAgo(failedAt)} with a different verify token from this page.`,
      fix: "Copy the verify token from this page into Meta's webhook form again, then press Verify and save.",
    };
  }
  return {
    id: "verified",
    label,
    status: "warn",
    detail: "This site has no record of Meta verifying the callback URL.",
    fix: "In Meta: WhatsApp → Configuration → Webhook → Edit. Paste the callback URL and the verify token, press Verify and save, then subscribe to the messages field.",
  };
}

export function checkInbound(history: WebhookHistory | null): SetupCheck {
  const label = "Messages arriving";
  if (!history) return { id: "inbound", label, status: "skip", detail: "The database could not be read." };
  const last = history.lastInboundAt ? `The last WhatsApp message arrived ${timeAgo(history.lastInboundAt)}.` : "";
  if (history.rejected > 0) {
    return {
      id: "inbound",
      label,
      status: "fail",
      detail: `${history.rejected} ${history.rejected === 1 ? "delivery was" : "deliveries were"} refused for a bad signature in the last 7 days. ${last}`.trim(),
      fix: "The app secret must be the secret of the Meta app whose webhook points here.",
    };
  }
  if (history.lastInboundAt) return { id: "inbound", label, status: "ok", detail: last };
  return {
    id: "inbound",
    label,
    status: "warn",
    detail: "No WhatsApp message has arrived yet.",
    fix: "Send a WhatsApp message to the business number from your own phone, then run the checks again.",
  };
}

// ─── Webhook subscription ───────────────────────────────────────────────────

interface SubscribedApps {
  data?: Array<{ whatsapp_business_api_data?: { id?: string; name?: string } }>;
}

export async function checkSubscription(settings: WhatsAppSettings, facts: TokenFacts): Promise<SetupCheck> {
  const label = "Webhook subscription";
  if (!settings.token) return { id: "subscription", label, status: "skip", detail: "Needs the access token." };
  const waba = settings.wabaId || facts.wabaIds[0];
  if (!waba) {
    return {
      id: "subscription",
      label,
      status: "warn",
      detail: "The WhatsApp Business Account is unknown, so the subscription could not be checked.",
      fix: "Paste the WhatsApp Business Account ID under WhatsApp details.",
    };
  }

  const result = await graph<SubscribedApps>(settings, `${waba}/subscribed_apps`, { token: settings.token });
  if (!result.ok) {
    return {
      id: "subscription",
      label,
      status: "warn",
      detail: `Meta did not list the apps subscribed to account ${waba}: ${said(result.error)}.`,
      fix: "The token needs whatsapp_business_management for this account.",
    };
  }

  const apps = (result.data?.data ?? []).flatMap((entry) => (entry.whatsapp_business_api_data ? [entry.whatsapp_business_api_data] : []));
  const names = apps.map((app) => app.name ?? app.id ?? "an app").join(", ");
  if (!apps.length) {
    return {
      id: "subscription",
      label,
      status: "fail",
      detail: `No app is subscribed to WhatsApp account ${waba}, so Meta sends its messages nowhere.`,
      fix: "Press Subscribe this app.",
      canSubscribe: true,
    };
  }
  if (settings.appId && !apps.some((app) => app.id === settings.appId)) {
    return {
      id: "subscription",
      label,
      status: "fail",
      detail: `Meta sends account ${waba}'s messages to ${names}, not to the app saved here.`,
      fix: "Press Subscribe this app.",
      canSubscribe: true,
    };
  }
  return { id: "subscription", label, status: "ok", detail: `Meta sends account ${waba}'s messages to ${names}.` };
}

/** Subscribe the token's app to the WhatsApp Business Account's webhooks. */
export async function subscribeApp(settings: WhatsAppSettings): Promise<{ ok: boolean; message: string }> {
  if (!settings.token) return { ok: false, message: "Save the access token first." };
  const waba = settings.wabaId || (await checkToken(settings)).facts.wabaIds[0];
  if (!waba) return { ok: false, message: "Save the WhatsApp Business Account ID first." };
  const result = await graph<{ success?: boolean }>(settings, `${waba}/subscribed_apps`, { token: settings.token, method: "POST" });
  if (result.ok && result.data?.success) {
    return { ok: true, message: `Subscribed. Meta now sends account ${waba}'s messages to the app the token belongs to.` };
  }
  return { ok: false, message: `Meta refused: ${said(result.error)}.` };
}

// ─── Replies ────────────────────────────────────────────────────────────────

export function checkReplies(settings: WhatsAppSettings): SetupCheck {
  const label = "Assistant replies";
  if (!settings.enabled) {
    return { id: "replies", label, status: "fail", detail: "The assistant cannot reply until the phone number ID and the access token are saved." };
  }
  if (!settings.autoReply) {
    return {
      id: "replies",
      label,
      status: "warn",
      detail: "Replies are switched off, so messages wait in Conversations for a person.",
      fix: "Tick The assistant replies on WhatsApp under WhatsApp details.",
    };
  }
  return { id: "replies", label, status: "ok", detail: "The assistant answers WhatsApp messages." };
}

/** Every check, in the order the setup happens. */
export async function runWhatsAppChecks(settings: WhatsAppSettings): Promise<SetupCheck[]> {
  const [app, token, phone, callback, history] = await Promise.all([
    checkApp(settings),
    checkToken(settings),
    checkPhone(settings),
    checkCallback(settings),
    webhookHistory(),
  ]);
  const [signature, subscription] = await Promise.all([
    checkSignature(settings, callback.status === "ok" || callback.status === "warn"),
    checkSubscription(settings, token.facts),
  ]);
  return [app, token.check, phone, callback, signature, checkVerified(history), subscription, checkInbound(history), checkReplies(settings)];
}
