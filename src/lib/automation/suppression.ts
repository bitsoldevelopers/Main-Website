import { prisma } from "@/lib/prisma";
import { emailDomain, normalizeEmail } from "./normalize";
import type { SuppressionReason } from "./outreach-email";

/**
 * The suppression list: addresses (and whole domains, stored as "@domain")
 * that automations must never email. Checked when a lead is enrolled and
 * again immediately before every send.
 */

export const SUPPRESSION_REASONS = ["UNSUBSCRIBED", "BOUNCED", "COMPLAINED", "MANUAL"] as const;

export const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  UNSUBSCRIBED: "Unsubscribed",
  BOUNCED: "Bounced",
  COMPLAINED: "Marked as spam",
  MANUAL: "Added by hand",
};

function asReason(value: string): SuppressionReason {
  return (SUPPRESSION_REASONS as readonly string[]).includes(value) ? (value as SuppressionReason) : "MANUAL";
}

/** "@domain.com" for a domain rule, the normalised address otherwise; "" if neither. */
export function suppressionKey(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw.startsWith("@")) return /^@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(raw) ? raw : "";
  const email = normalizeEmail(raw);
  return email.includes("@") ? email.slice(0, 191) : "";
}

export type SuppressionLookup = (emailKey: string) => SuppressionReason | null;

/** Loads the entries that could affect the given addresses, in one query. */
export async function loadSuppression(emailKeys: string[]): Promise<SuppressionLookup> {
  const keys = [...new Set(emailKeys.filter(Boolean))];
  if (keys.length === 0) return () => null;
  const domains = [...new Set(keys.map((key) => `@${emailDomain(key)}`).filter((d) => d.length > 1))];

  const found = new Map<string, SuppressionReason>();
  const values = [...keys, ...domains];
  for (let i = 0; i < values.length; i += 500) {
    const rows = await prisma.suppressionEntry.findMany({
      where: { value: { in: values.slice(i, i + 500) } },
      select: { value: true, reason: true },
    });
    for (const entry of rows) found.set(entry.value, asReason(entry.reason));
  }
  return (emailKey) => found.get(emailKey) ?? found.get(`@${emailDomain(emailKey)}`) ?? null;
}

export async function isSuppressed(email: string): Promise<SuppressionReason | null> {
  const key = normalizeEmail(email);
  return (await loadSuppression([key]))(key);
}

/**
 * Adds an address or domain. An existing entry keeps its original reason
 * unless the new one is stronger evidence (an unsubscribe beats a manual add).
 */
export async function suppress(input: { value: string; reason: SuppressionReason; source?: string; note?: string }): Promise<boolean> {
  const value = suppressionKey(input.value);
  if (!value) return false;
  const existing = await prisma.suppressionEntry.findUnique({ where: { value } });
  if (existing) {
    if (existing.reason === "MANUAL" && input.reason !== "MANUAL") {
      await prisma.suppressionEntry.update({ where: { value }, data: { reason: input.reason, source: input.source ?? existing.source } });
    }
    return true;
  }
  await prisma.suppressionEntry.create({
    data: { value, reason: input.reason, source: input.source?.slice(0, 191) ?? null, note: input.note ?? null },
  });
  return true;
}
