/**
 * Admin session primitives shared by proxy.ts, the login route handler and
 * the server-side auth helpers. This file deliberately has no imports from
 * next/headers so it can run inside the proxy as well as in Server Components.
 *
 * Two token formats are accepted:
 *  - v2: `v2.<base64url payload>.<hmac>` carrying { sub, name, role, exp },
 *    issued per user by /api/admin/login. This is what new logins get.
 *  - legacy: a bare HMAC derived from ADMIN_SECRET. Sessions created before
 *    the RBAC upgrade keep working as the owner until their cookie expires.
 */

import type { AdminRole } from "./rbac";
import { isAdminRole } from "./rbac";

export const ADMIN_COOKIE = "admin_token";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const SESSION_LABEL = "bitsol-admin-session-v1";

export interface AdminSession {
  /** User id, or "owner" for the ADMIN_SECRET password login. */
  sub: string;
  name: string;
  role: AdminRole;
  /** Unix seconds. */
  exp: number;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

/** Constant-time comparison so a token cannot be guessed one byte at a time. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}

/** The pre-RBAC cookie value; still accepted so existing sessions survive. */
async function legacyToken(secret: string): Promise<string> {
  return hmacHex(secret, SESSION_LABEL);
}

const b64url = {
  encode: (s: string) => Buffer.from(s, "utf8").toString("base64url"),
  decode: (s: string) => Buffer.from(s, "base64url").toString("utf8"),
};

/** Issue a signed v2 session token for a logged-in admin user. */
export async function issueSessionToken(user: { sub: string; name: string; role: AdminRole }): Promise<string | null> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  const payload = b64url.encode(
    JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE } satisfies AdminSession)
  );
  const sig = await hmacHex(secret, `v2.${payload}`);
  return `v2.${payload}.${sig}`;
}

/** Parse and verify a cookie value; null when missing, forged or expired. */
export async function readSession(token: string | undefined | null): Promise<AdminSession | null> {
  const secret = process.env.ADMIN_SECRET;
  if (!token || !secret) return null;

  if (token.startsWith("v2.")) {
    const [, payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = await hmacHex(secret, `v2.${payload}`);
    if (!safeEqual(sig, expected)) return null;
    try {
      const session = JSON.parse(b64url.decode(payload)) as AdminSession;
      if (typeof session.sub !== "string" || !isAdminRole(session.role)) return null;
      if (typeof session.exp !== "number" || session.exp * 1000 < Date.now()) return null;
      return session;
    } catch {
      return null;
    }
  }

  // Legacy static token: treated as the owner with full access.
  if (safeEqual(token, await legacyToken(secret))) {
    return { sub: "owner", name: "Owner", role: "ADMIN", exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
  }
  return null;
}

export async function isValidSession(token: string | undefined | null): Promise<boolean> {
  return (await readSession(token)) !== null;
}

export function verifyAdminPassword(candidate: string): boolean {
  const secret = process.env.ADMIN_SECRET;
  return Boolean(secret) && safeEqual(candidate, secret as string);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: SESSION_MAX_AGE,
  path: "/",
};
