import { randomToken, secretsMatch, sign, verifySignature } from "../crypto";

/**
 * The OAuth `state` round trip for Google, the same design as the social
 * module's: the connect route issues a state to a signed-in admin and stores
 * it in a cookie; the callback accepts a code only when the state in the URL
 * matches that cookie.
 *
 * The admin session cookie is SameSite=Strict, so the browser does not send
 * it when Google redirects back. This cookie is SameSite=Lax for that reason,
 * and because only the connect route can issue it, a valid one proves an
 * admin with the right permission started the flow.
 */

export const GOOGLE_STATE_COOKIE = "google_oauth_state";
export const STATE_MAX_AGE = 10 * 60; // seconds

const PURPOSE = "google-oauth-state";

export interface GoogleOAuthState {
  /** actorLabel of the admin who started the flow. */
  actor: string;
  /** Where to return to in the admin. */
  returnTo: string;
  nonce: string;
  /** Unix seconds. */
  exp: number;
}

const RETURN_PATHS = ["/admin/automation/sources/google-sheets"];

export function safeReturnTo(value: string | null | undefined): string {
  return value && RETURN_PATHS.some((path) => value === path || value.startsWith(`${path}?`)) ? value : RETURN_PATHS[0];
}

export function issueState(actor: string, returnTo: string): { cookie: string; state: string } {
  const payload: GoogleOAuthState = {
    actor,
    returnTo: safeReturnTo(returnTo),
    nonce: randomToken(),
    exp: Math.floor(Date.now() / 1000) + STATE_MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return { cookie: `${body}.${sign(PURPOSE, body)}`, state: payload.nonce };
}

/** The state the cookie carries, or null when it is forged, expired or does not match. */
export function readState(cookie: string | undefined, stateParam: string | null): GoogleOAuthState | null {
  if (!cookie || !stateParam) return null;
  const [body, signature] = cookie.split(".");
  if (!body || !signature) return null;
  try {
    if (!verifySignature(PURPOSE, body, signature)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as GoogleOAuthState;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.nonce !== "string" || !secretsMatch(payload.nonce, stateParam)) return null;
    return { ...payload, returnTo: safeReturnTo(payload.returnTo) };
  } catch {
    return null;
  }
}

export const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: STATE_MAX_AGE,
  path: "/api/admin/google",
};

/** The public origin, behind Hostinger's proxy as well as on localhost. */
export function siteOrigin(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  // On a local machine the configured production URL would send Google's
  // redirect to the live site.
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  if (configured) return configured.replace(/\/+$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
