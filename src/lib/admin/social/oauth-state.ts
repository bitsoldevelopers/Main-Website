import { randomBytes } from "node:crypto";
import { safeEqual } from "../session";
import { sign, verifySignature } from "./crypto";
import type { SocialPlatform } from "./platforms";

/**
 * The OAuth `state` round trip. The connect route issues a state to a
 * signed-in admin and stores it in a cookie; the callback accepts a code only
 * when the state in the URL matches that cookie.
 *
 * The admin session cookie is SameSite=Strict, so the browser does not send
 * it when LinkedIn or Facebook redirects back to the callback. This cookie is
 * SameSite=Lax for that reason, and because only the connect route can issue
 * it, a valid one proves an admin with the right permission started the flow.
 */

export const STATE_COOKIE = "social_oauth_state";
export const STATE_MAX_AGE = 10 * 60; // seconds

export interface OAuthState {
  platform: SocialPlatform;
  /** actorLabel of the admin who started the flow. */
  actor: string;
  nonce: string;
  /** Unix seconds. */
  exp: number;
}

export function issueState(platform: SocialPlatform, actor: string): { cookie: string; state: string } {
  const payload: OAuthState = {
    platform,
    actor,
    nonce: randomBytes(16).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { cookie: `${body}.${sign(body)}`, state: payload.nonce };
}

/** The state the cookie carries, or null when it is forged, expired or for another flow. */
export function readState(
  cookie: string | undefined,
  stateParam: string | null,
  platform: SocialPlatform
): OAuthState | null {
  if (!cookie || !stateParam) return null;
  const [body, signature] = cookie.split(".");
  if (!body || !signature || !verifySignature(body, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (payload.platform !== platform) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.nonce !== "string" || !safeEqual(payload.nonce, stateParam)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: STATE_MAX_AGE,
  path: "/api/admin/social",
};
