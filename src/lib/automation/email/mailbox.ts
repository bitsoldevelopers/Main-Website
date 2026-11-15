import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, isCryptoConfigured } from "../crypto";

/**
 * The mailboxes outreach is sent from when it goes out over SMTP instead of
 * through Resend: normal mailboxes such as Hostinger Business email accounts.
 * Several can be connected; the engine spreads new leads across them and
 * keeps each lead on the mailbox that sent its first email (rotation.ts).
 * Each mailbox is also read over IMAP for replies and bounces (inbox.ts).
 *
 * Stored as one JSON list in SiteSetting "outreach.mailboxes", set from the
 * admin (Lead Automation → Settings) without a redeploy. Passwords are stored
 * encrypted with AUTOMATION_SECRET / ADMIN_SECRET and never sent back to the
 * browser. The single mailbox of the first version (keys "outreach.mailbox.*")
 * is read as the first entry until the list is saved.
 */

export type Transport = "resend" | "smtp";

export interface Mailbox {
  /** Stable id; "primary" for the mailbox carried over from the first version. */
  id: string;
  /** The mailbox address; also the SMTP and IMAP login and the From address. */
  user: string;
  /** True when a password is stored. The password itself is never exposed. */
  hasPassword: boolean;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  /** Read the inbox for replies and bounces. */
  watchInbox: boolean;
  /** Most emails this mailbox sends in any 24 hours. */
  dailyLimit: number;
  /** Off: keeps its settings but sends nothing (its leads move to another mailbox). */
  enabled: boolean;
  /** Sender name for this mailbox; empty uses Settings → Sender → Sender name. */
  fromName: string;
}

/** Server only: a mailbox plus its decrypted password, for connecting. */
export interface MailboxCredentials extends Mailbox {
  password: string;
}

export interface MailboxSettings {
  /** Which service delivers outreach email. */
  transport: Transport;
  mailboxes: Mailbox[];
}

/** Hostinger's Business email servers. */
export const HOSTINGER_DEFAULTS = {
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  imapHost: "imap.hostinger.com",
  imapPort: 993,
} as const;

/** Hostinger Business Starter: 1,000 emails per mailbox in any 24 hours. */
export const HOSTINGER_DAILY_CAP = 1000;
export const DEFAULT_MAILBOX_DAILY_LIMIT = 100;
export const MAX_MAILBOXES = 10;

const LIST_KEY = "outreach.mailboxes";
const TRANSPORT_KEY = "outreach.mailbox.transport";
const LEGACY = "outreach.mailbox.";

interface StoredMailbox extends Omit<Mailbox, "hasPassword"> {
  /** Encrypted. */
  password: string;
}

function port(value: unknown, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

function limit(value: unknown): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? Math.min(HOSTINGER_DAILY_CAP, Math.max(1, n)) : DEFAULT_MAILBOX_DAILY_LIMIT;
}

function normalize(raw: Partial<StoredMailbox>): StoredMailbox {
  return {
    id: String(raw.id || randomBytes(6).toString("hex")),
    user: String(raw.user ?? "").trim().toLowerCase(),
    password: String(raw.password ?? ""),
    smtpHost: String(raw.smtpHost || HOSTINGER_DEFAULTS.smtpHost).trim(),
    smtpPort: port(raw.smtpPort, HOSTINGER_DEFAULTS.smtpPort),
    imapHost: String(raw.imapHost || HOSTINGER_DEFAULTS.imapHost).trim(),
    imapPort: port(raw.imapPort, HOSTINGER_DEFAULTS.imapPort),
    watchInbox: raw.watchInbox !== false,
    dailyLimit: limit(raw.dailyLimit),
    enabled: raw.enabled !== false,
    fromName: String(raw.fromName ?? "").replace(/[<>"\r\n]/g, "").trim(),
  };
}

async function readStored(): Promise<{ transport: Transport; list: StoredMailbox[] }> {
  // "outreach.mailbox" also matches "outreach.mailboxes".
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: "outreach.mailbox" } } });
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const transport: Transport = map.get(TRANSPORT_KEY) === "smtp" ? "smtp" : "resend";

  const json = map.get(LIST_KEY);
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json);
      if (Array.isArray(parsed)) return { transport, list: parsed.map((m) => normalize(m as Partial<StoredMailbox>)).filter((m) => m.user) };
    } catch {
      // Unreadable list: fall back to the single mailbox below rather than to nothing.
    }
  }
  const user = map.get(`${LEGACY}user`) ?? "";
  if (!user) return { transport, list: [] };
  return {
    transport,
    list: [
      normalize({
        id: "primary",
        user,
        password: map.get(`${LEGACY}password`) ?? "",
        smtpHost: map.get(`${LEGACY}smtpHost`),
        smtpPort: port(map.get(`${LEGACY}smtpPort`), HOSTINGER_DEFAULTS.smtpPort),
        imapHost: map.get(`${LEGACY}imapHost`),
        imapPort: port(map.get(`${LEGACY}imapPort`), HOSTINGER_DEFAULTS.imapPort),
        watchInbox: map.get(`${LEGACY}watchInbox`) !== "0",
      }),
    ],
  };
}

async function writeList(list: StoredMailbox[]): Promise<void> {
  const value = JSON.stringify(list);
  await prisma.siteSetting.upsert({ where: { key: LIST_KEY }, update: { value }, create: { key: LIST_KEY, value } });
}

function publicView(m: StoredMailbox): Mailbox {
  const { password, ...rest } = m;
  return { ...rest, hasPassword: Boolean(password) };
}

export async function getMailboxSettings(): Promise<MailboxSettings> {
  const { transport, list } = await readStored();
  return { transport, mailboxes: list.map(publicView) };
}

function decrypt(m: StoredMailbox): MailboxCredentials | null {
  if (!m.password) return null;
  try {
    return { ...publicView(m), password: decryptSecret(m.password) };
  } catch {
    // The secret changed since the password was saved: it has to be entered again.
    return null;
  }
}

/** Every enabled mailbox that can log in (has a readable password). */
export async function getSendingMailboxes(): Promise<MailboxCredentials[]> {
  const { list } = await readStored();
  return list.filter((m) => m.enabled).map(decrypt).filter((m): m is MailboxCredentials => m !== null);
}

/**
 * Every mailbox whose inbox is read: turned off mailboxes too, since leads
 * they emailed before may still reply to them.
 */
export async function getWatchedMailboxes(): Promise<MailboxCredentials[]> {
  const { list } = await readStored();
  return list.filter((m) => m.watchInbox).map(decrypt).filter((m): m is MailboxCredentials => m !== null);
}

/** One mailbox by id, enabled or not, for testing it. */
export async function getMailboxCredentials(id: string): Promise<MailboxCredentials | null> {
  const { list } = await readStored();
  const found = list.find((m) => m.id === id);
  return found ? decrypt(found) : null;
}

export async function setTransport(transport: Transport): Promise<void> {
  await prisma.siteSetting.upsert({ where: { key: TRANSPORT_KEY }, update: { value: transport }, create: { key: TRANSPORT_KEY, value: transport } });
}

export interface MailboxInput {
  /** Empty: add a new mailbox. */
  id?: string;
  user: string;
  /** Empty keeps the stored password. */
  password: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  watchInbox: boolean;
  dailyLimit: number;
  enabled: boolean;
  fromName: string;
}

/** Adds or updates a mailbox. Throws a readable error for a duplicate address or a full list. */
export async function saveMailbox(input: MailboxInput): Promise<string> {
  const { list } = await readStored();
  const user = input.user.trim().toLowerCase();
  const existing = input.id ? list.find((m) => m.id === input.id) : undefined;
  if (input.id && !existing) throw new Error("That mailbox no longer exists.");
  if (list.some((m) => m.user === user && m.id !== existing?.id)) throw new Error(`${user} is already connected.`);
  if (!existing && list.length >= MAX_MAILBOXES) throw new Error(`At most ${MAX_MAILBOXES} mailboxes can be connected.`);
  if (!existing && !input.password) throw new Error("Enter the mailbox password.");

  const next = normalize({
    ...existing,
    ...input,
    id: existing?.id,
    user,
    password: input.password ? encryptSecret(input.password) : (existing?.password ?? ""),
  });
  await writeList(existing ? list.map((m) => (m.id === existing.id ? next : m)) : [...list, next]);
  return next.id;
}

export async function removeMailbox(id: string): Promise<void> {
  const { list } = await readStored();
  await writeList(list.filter((m) => m.id !== id));
}

/** What stops the mailboxes from sending. Empty = ready. */
export function mailboxProblems(settings: MailboxSettings): string[] {
  const problems: string[] = [];
  if (!isCryptoConfigured()) problems.push("Set AUTOMATION_SECRET (or ADMIN_SECRET) on the server; mailbox passwords are stored encrypted with it.");
  if (settings.mailboxes.length === 0) problems.push("Connect a mailbox under Lead Automation → Settings → Sending mailboxes.");
  else if (!settings.mailboxes.some((m) => m.enabled && m.hasPassword)) problems.push("Turn on at least one mailbox that has a password saved.");
  return problems;
}

/** The address in "Name <a@b>" or a bare "a@b", lower case. */
export function addressOf(value: string): string {
  const match = value.match(/<([^<>\s]+@[^<>\s]+)>/) ?? value.match(/([^\s<>"]+@[^\s<>"]+)/);
  return match ? match[1].toLowerCase() : "";
}
