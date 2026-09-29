import { prisma } from "@/lib/prisma";
import { checkEmailSyntax } from "./validate";

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
  };
}

export async function saveOutreachSettings(input: Partial<OutreachSettings>): Promise<void> {
  const entries = KEYS.filter((key) => input[key] !== undefined).map((key) => {
    const raw = input[key];
    const value =
      key === "dailyLimit"
        ? String(clampInt(raw, DEFAULT_OUTREACH_SETTINGS.dailyLimit, 1, 2000))
        : key === "batchLimit"
          ? String(clampInt(raw, DEFAULT_OUTREACH_SETTINGS.batchLimit, 1, 100))
          : String(raw).trim();
    return { key: `${PREFIX}${key}`, value };
  });
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
