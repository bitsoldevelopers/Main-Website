import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { safeEqual } from "../session";

/**
 * Secrets for the social module: access tokens are encrypted before they are
 * stored, and the OAuth `state` value is signed. Both keys are derived from
 * ADMIN_SECRET, so no extra environment variable is needed; rotating
 * ADMIN_SECRET makes stored tokens unreadable and the accounts have to be
 * connected again.
 */

const TOKEN_PREFIX = "v1";

function secret(): string {
  const value = process.env.ADMIN_SECRET;
  if (!value) throw new Error("ADMIN_SECRET is not set");
  return value;
}

function deriveKey(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret(), "bitsol-social", purpose, 32));
}

/** AES-256-GCM. Output: `v1.<iv>.<auth tag>.<ciphertext>`, each base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("token-encryption"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [TOKEN_PREFIX, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

/** Throws when the value was tampered with or ADMIN_SECRET has changed. */
export function decryptSecret(stored: string): string {
  const [prefix, iv, tag, data] = stored.split(".");
  if (prefix !== TOKEN_PREFIX || !iv || !tag || !data) throw new Error("Stored token has an unknown format");
  const decipher = createDecipheriv("aes-256-gcm", deriveKey("token-encryption"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function sign(message: string): string {
  return createHmac("sha256", deriveKey("oauth-state")).update(message).digest("base64url");
}

export function verifySignature(message: string, signature: string): boolean {
  return safeEqual(sign(message), signature);
}
