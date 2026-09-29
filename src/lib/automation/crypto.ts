import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Secrets for the lead automation: Google OAuth tokens are encrypted before
 * they are stored, and unsubscribe links and the OAuth `state` are signed.
 *
 * Keys are derived from AUTOMATION_SECRET when it is set, otherwise from
 * ADMIN_SECRET (the same convention as src/lib/admin/social/crypto.ts), so
 * the feature works without another environment variable. Changing the
 * secret makes stored Google tokens unreadable (reconnect the account) and
 * invalidates unsubscribe links in emails that were already sent, which is
 * why a dedicated AUTOMATION_SECRET that never rotates is the better choice
 * in production.
 */

const TOKEN_PREFIX = "v1";

function secret(): string {
  const value = process.env.AUTOMATION_SECRET || process.env.ADMIN_SECRET;
  if (!value) throw new Error("Set AUTOMATION_SECRET (or ADMIN_SECRET) on the server");
  return value;
}

export function isCryptoConfigured(): boolean {
  return Boolean(process.env.AUTOMATION_SECRET || process.env.ADMIN_SECRET);
}

function deriveKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret(), "bitsol-automation", purpose, 32));
}

/** AES-256-GCM. Output: `v1.<iv>.<auth tag>.<ciphertext>`, each base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("token-encryption"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [TOKEN_PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Throws when the value was tampered with or the secret has changed. */
export function decryptSecret(stored: string): string {
  const [prefix, iv, tag, data] = stored.split(".");
  if (prefix !== TOKEN_PREFIX || !iv || !tag || data === undefined) throw new Error("Stored token has an unknown format");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("token-encryption"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sign(purpose: string, message: string): string {
  return createHmac("sha256", deriveKey(purpose)).update(message).digest("base64url");
}

export function verifySignature(purpose: string, message: string, signature: string): boolean {
  const expected = Buffer.from(sign(purpose, message));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}

/** Constant-time comparison for shared secrets such as the cron key. */
export function secretsMatch(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest();
  const right = createHash("sha256").update(b).digest();
  return timingSafeEqual(left, right);
}

// ─── Unsubscribe links ──────────────────────────────────────────────────────

const UNSUBSCRIBE_PURPOSE = "unsubscribe-link";

/**
 * The token in every email's unsubscribe link. It names the lead and the
 * address and is signed, so a link cannot be edited to unsubscribe someone
 * else. It does not expire: an opt-out must work whenever it is clicked.
 */
export function unsubscribeToken(leadId: string, email: string): string {
  const body = Buffer.from(JSON.stringify({ l: leadId, e: email.toLowerCase() }), "utf8").toString("base64url");
  return `${body}.${sign(UNSUBSCRIBE_PURPOSE, body)}`;
}

export function readUnsubscribeToken(token: string | null | undefined): { leadId: string; email: string } | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  try {
    if (!verifySignature(UNSUBSCRIBE_PURPOSE, body, signature)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { l?: unknown; e?: unknown };
    if (typeof payload.l !== "string" || typeof payload.e !== "string") return null;
    return { leadId: payload.l, email: payload.e };
  } catch {
    return null;
  }
}
