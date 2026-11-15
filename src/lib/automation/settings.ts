import { prisma } from "@/lib/prisma";
import { checkEmailSyntax } from "./validate";
import { isEmailDesign, type EmailDesign } from "./email/render";

/**
 * Who outreach email is sent as, and how fast. Stored in the existing
 * SiteSetting table under "outreach.*" so it is edited from the admin;
 * credentials stay in environment variables.
 */

export interface OutreachSettings {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  companyName: string;
  /** Postal address shown in every email footer (required by CAN-SPAM). */
  companyAddress: string;
  signature: string;
  /** Most emails sent per day across all automations. */
  dailyLimit: number;
  /** Most emails sent per scheduler run, to space sends out. */
  batchLimit: number;
  /** Imported prospects started per day by the drip (drip.ts); 0 = off. */
  dripPerDay: number;
  /** The automation the drip starts prospects in. */
  dripAutomationId: string;
  /** How outreach email looks (email/render.ts). */
  emailDesign: EmailDesign;
  /** Show the four services (web, apps, marketing, chatbots) in every email. */
  showServices: boolean;
  /** Sending hours in Pakistan time: from this hour (0–23)… */
  sendWindowStart: number;
  /** …to this hour (1–24). End not after start: any time. */
  sendWindowEnd: number;
  /** Spread each mailbox's daily limit evenly over the sending hours. */
  spreadEvenly: boolean;
}

export const DEFAULT_OUTREACH_SETTINGS: OutreachSettings = {
  fromName: "BITSOL Marketing",
  fromEmail: "",
  replyTo: "",
  companyName: "BITSOL Marketing PVT LTD",
  // The registered office, as published on the site (app/layout.tsx).
  companyAddress: "83/3 C KB Commercial, Phase 1, DHA, Lahore 54792, Pakistan",
  signature: "",
  dailyLimit: 50,
  batchLimit: 5,
  dripPerDay: 0,
  dripAutomationId: "",
  // The owner chose the showcase design for outreach (14 Nov 2026).
  emailDesign: "showcase",
  showServices: true,
  // The owner asked for 10:00–22:00 Pakistan time (14 Nov 2026).
  sendWindowStart: 10,
  sendWindowEnd: 22,
  spreadEvenly: true,
};

const PREFIX = "outreach.";
const KEYS = Object.keys(DEFAULT_OUTREACH_SETTINGS) as (keyof OutreachSettings)[];

function envDefaults(): Partial<OutreachSettings> {
  return {
    ...(process.env.OUTREACH_FROM_EMAIL ? { fromEmail: process.env.OUTREACH_FROM_EMAIL } : {}),
    ...(process.env.OUTREACH_FROM_NAME ? { fromName: process.env.OUTREACH_FROM_NAME } : {}),
    ...(process.env.OUTREACH_REPLY_TO ? { replyTo: process.env.OUTREACH_REPLY_TO } : {}),
  };
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export async function getOutreachSettings(): Promise<OutreachSettings> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
  const stored = new Map(rows.map((row) => [row.key.slice(PREFIX.length), row.value]));
  const base = { ...DEFAULT_OUTREACH_SETTINGS, ...envDefaults() };
  return {
    fromName: stored.get("fromName") ?? base.fromName,
    fromEmail: stored.get("fromEmail") ?? base.fromEmail,
    replyTo: stored.get("replyTo") ?? base.replyTo,
    companyName: stored.get("companyName") ?? base.companyName,
    companyAddress: stored.get("companyAddress") ?? base.companyAddress,
    signature: stored.get("signature") ?? base.signature,
    dailyLimit: clampInt(stored.get("dailyLimit"), base.dailyLimit, 1, 2000),
    batchLimit: clampInt(stored.get("batchLimit"), base.batchLimit, 1, 100),
    dripPerDay: clampInt(stored.get("dripPerDay"), base.dripPerDay, 0, 1000),
    dripAutomationId: stored.get("dripAutomationId") ?? base.dripAutomationId,
    emailDesign: isEmailDesign(stored.get("emailDesign")) ? (stored.get("emailDesign") as EmailDesign) : base.emailDesign,
    showServices: stored.has("showServices") ? stored.get("showServices") === "1" : base.showServices,
    sendWindowStart: clampInt(stored.get("sendWindowStart"), base.sendWindowStart, 0, 23),
    sendWindowEnd: clampInt(stored.get("sendWindowEnd"), base.sendWindowEnd, 1, 24),
    spreadEvenly: stored.has("spreadEvenly") ? stored.get("spreadEvenly") === "1" : base.spreadEvenly,
  };
}

/** How one setting is stored: clamped, normalised, as text. */
function serialize(key: keyof OutreachSettings, raw: unknown): string {
  const d = DEFAULT_OUTREACH_SETTINGS;
  switch (key) {
    case "dailyLimit":
      return String(clampInt(raw, d.dailyLimit, 1, 2000));
    case "batchLimit":
      return String(clampInt(raw, d.batchLimit, 1, 100));
    case "dripPerDay":
      return String(clampInt(raw, d.dripPerDay, 0, 1000));
    case "sendWindowStart":
      return String(clampInt(raw, d.sendWindowStart, 0, 23));
    case "sendWindowEnd":
      return String(clampInt(raw, d.sendWindowEnd, 1, 24));
    case "showServices":
    case "spreadEvenly":
      return raw ? "1" : "0";
    case "emailDesign":
      return isEmailDesign(raw) ? raw : d.emailDesign;
    default:
      return String(raw).trim();
  }
}

export async function saveOutreachSettings(input: Partial<OutreachSettings>): Promise<void> {
  const entries = KEYS.filter((key) => input[key] !== undefined).map((key) => ({ key: `${PREFIX}${key}`, value: serialize(key, input[key]) }));
  await prisma.$transaction(
    entries.map((entry) =>
      prisma.siteSetting.upsert({ where: { key: entry.key }, update: { value: entry.value }, create: entry })
    )
  );
}

/** What still has to be filled in before any email may leave. Empty = ready. */
export function senderProblems(settings: OutreachSettings): string[] {
  const problems: string[] = [];
  if (!settings.fromEmail) problems.push("Set the address outreach email is sent from.");
  else if (checkEmailSyntax(settings.fromEmail).validity === "INVALID") problems.push("The sender address is not a valid email.");
  if (settings.replyTo && checkEmailSyntax(settings.replyTo).validity === "INVALID") problems.push("The reply-to address is not a valid email.");
  if (!settings.fromName.trim()) problems.push("Set the sender name.");
  if (!settings.companyAddress.trim()) {
    problems.push("Add the company's postal address; it is shown in the footer of every outreach email.");
  }
  return problems;
}

// ─── Round-robin cursor ─────────────────────────────────────────────────────

const CURSOR_KEY = "outreach.roundRobinCursor";

export async function readRoundRobinCursor(): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key: CURSOR_KEY } });
  return clampInt(row?.value, 0, 0, 1_000_000_000);
}

export async function writeRoundRobinCursor(value: number): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: CURSOR_KEY },
    update: { value: String(value) },
    create: { key: CURSOR_KEY, value: String(value) },
  });
}
