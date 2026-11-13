import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, isCryptoConfigured } from "../crypto";

/**
 * The mailbox outreach is sent from when it goes out over SMTP instead of
 * through Resend: a normal mailbox such as a Hostinger Business email
 * account. The same mailbox is read over IMAP to notice replies and bounces.
 *
 * Kept in SiteSetting under "outreach.mailbox.*" so it is set from the admin
 * (Lead Automation → Settings) without a redeploy. The password is stored
 * encrypted with AUTOMATION_SECRET / ADMIN_SECRET and never sent back to the
 * browser.
 */

export type Transport = "resend" | "smtp";

export interface MailboxConfig {
  /** Which service delivers outreach email. */
  transport: Transport;
  smtpHost: string;
  smtpPort: number;
  /** The mailbox address; also the SMTP and IMAP login. */
  user: string;
  /** True when a password is stored. The password itself is never exposed. */
  hasPassword: boolean;
  imapHost: string;
  imapPort: number;
  /** Read the inbox for replies and bounces. */
  watchInbox: boolean;
}

/** Hostinger's Business email servers, the mailbox this site uses. */
export const HOSTINGER_DEFAULTS = {
  smtpHost: "smtp.hostinger.com",
  smtpPort: 465,
  imapHost: "imap.hostinger.com",
  imapPort: 993,
} as const;

/** Hostinger Business Starter: 1,000 emails per mailbox in any 24 hours. */
export const HOSTINGER_DAILY_CAP = 1000;

const PREFIX = "outreach.mailbox.";
const PASSWORD_KEY = `${PREFIX}password`;

function port(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
}

async function readRows(): Promise<Map<string, string>> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { startsWith: PREFIX } } });
  return new Map(rows.map((row) => [row.key.slice(PREFIX.length), row.value]));
}

function toConfig(stored: Map<string, string>): MailboxConfig {
  return {
    transport: stored.get("transport") === "smtp" ? "smtp" : "resend",
    smtpHost: stored.get("smtpHost") || HOSTINGER_DEFAULTS.smtpHost,
    smtpPort: port(stored.get("smtpPort"), HOSTINGER_DEFAULTS.smtpPort),
    user: stored.get("user") ?? "",
    hasPassword: Boolean(stored.get("password")),
    imapHost: stored.get("imapHost") || HOSTINGER_DEFAULTS.imapHost,
    imapPort: port(stored.get("imapPort"), HOSTINGER_DEFAULTS.imapPort),
    watchInbox: stored.get("watchInbox") !== "0",
  };
}

export async function getMailboxConfig(): Promise<MailboxConfig> {
  return toConfig(await readRows());
}

/** Server only: the config plus the decrypted password, for connecting. */
export interface MailboxCredentials extends MailboxConfig {
  password: string;
}

export async function getMailboxCredentials(): Promise<MailboxCredentials | null> {
  const stored = await readRows();
  const config = toConfig(stored);
  const encrypted = stored.get("password");
  if (!config.user || !encrypted) return null;
  try {
    return { ...config, password: decryptSecret(encrypted) };
  } catch {
    // The secret changed since the password was saved: it has to be entered again.
    return null;
  }
}

export async function saveMailboxConfig(input: {
  transport: Transport;
  smtpHost: string;
  smtpPort: number;
  user: string;
  /** Empty keeps the stored password. */
  password: string;
  imapHost: string;
  imapPort: number;
  watchInbox: boolean;
}): Promise<void> {
  const entries: { key: string; value: string }[] = [
    { key: `${PREFIX}transport`, value: input.transport },
    { key: `${PREFIX}smtpHost`, value: input.smtpHost.trim() },
    { key: `${PREFIX}smtpPort`, value: String(input.smtpPort) },
    { key: `${PREFIX}user`, value: input.user.trim().toLowerCase() },
    { key: `${PREFIX}imapHost`, value: input.imapHost.trim() },
    { key: `${PREFIX}imapPort`, value: String(input.imapPort) },
    { key: `${PREFIX}watchInbox`, value: input.watchInbox ? "1" : "0" },
  ];
  if (input.password) entries.push({ key: PASSWORD_KEY, value: encryptSecret(input.password) });

  await prisma.$transaction(
    entries.map((entry) =>
      prisma.siteSetting.upsert({ where: { key: entry.key }, update: { value: entry.value }, create: entry })
    )
  );
}

/** What stops the mailbox from sending. Empty = ready. */
export function mailboxProblems(config: MailboxConfig, fromEmail: string): string[] {
  const problems: string[] = [];
  if (!isCryptoConfigured()) problems.push("Set AUTOMATION_SECRET (or ADMIN_SECRET) on the server; the mailbox password is stored encrypted with it.");
  if (!config.user) problems.push("Enter the mailbox address.");
  if (!config.hasPassword) problems.push("Enter the mailbox password.");
  if (!config.smtpHost) problems.push("Enter the SMTP server.");
  const mailboxDomain = config.user.split("@")[1] ?? "";
  const fromDomain = fromEmail.split("@")[1] ?? "";
  if (config.user && fromEmail && mailboxDomain.toLowerCase() !== fromDomain.toLowerCase()) {
    problems.push(`The sender address (${fromEmail}) is not on the mailbox's domain (${mailboxDomain}); the mail server will refuse it. Send as ${config.user}.`);
  }
  return problems;
}
