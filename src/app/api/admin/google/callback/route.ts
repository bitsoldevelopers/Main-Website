import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { exchangeCode, googleRedirectUri, saveConnection } from "@/lib/automation/google/client";
import { GOOGLE_STATE_COOKIE, readState, safeReturnTo, siteOrigin, stateCookieOptions } from "@/lib/automation/google/oauth-state";

/**
 * Where Google sends the admin back after they approve (or refuse) access.
 * Trades the one-time code for tokens and stores them encrypted.
 *
 * The answer is a small page that forwards to the admin, not an HTTP
 * redirect: this request arrived from another site, so the browser withheld
 * the SameSite=Strict session cookie and would withhold it from a redirect
 * too, which would land a signed-in admin on the login screen.
 */
function backToAdmin(returnTo: string, query: Record<string, string>): NextResponse {
  const separator = returnTo.includes("?") ? "&" : "?";
  const target = `${returnTo}${separator}${new URLSearchParams(query)}`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const res = new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">` +
      `<meta http-equiv="refresh" content="0;url=${target}"><title>Returning to the admin</title></head>` +
      `<body style="font-family:system-ui,sans-serif;padding:3rem;color:#334155">` +
      `<p>Returning to the admin… <a href="${target}">Continue</a></p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
  res.cookies.set(GOOGLE_STATE_COOKIE, "", { ...stateCookieOptions, maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams;
  const state = readState(req.cookies.get(GOOGLE_STATE_COOKIE)?.value, query.get("state"));
  if (!state) {
    return backToAdmin(safeReturnTo(null), { error: "The Google connection expired or was started in another browser. Try again." });
  }

  const denied = query.get("error");
  const code = query.get("code");
  if (denied || !code) {
    const reason = denied === "access_denied" ? "access was not granted" : (denied ?? "no authorization code was returned");
    return backToAdmin(state.returnTo, { error: `Google did not connect: ${reason.slice(0, 200)}.` });
  }

  try {
    const { tokens, identity } = await exchangeCode(code, googleRedirectUri(siteOrigin(req)));
    const granted = (tokens.scope ?? "").split(" ");
    if (!granted.some((scope) => scope.endsWith("/auth/spreadsheets.readonly"))) {
      return backToAdmin(state.returnTo, {
        error: "Google connected, but without permission to read spreadsheets. Connect again and leave that box ticked.",
      });
    }
    await saveConnection({ tokens, identity, actor: state.actor });
    void logActivity({ actor: state.actor, action: "google.connected", entity: "automation", detail: identity.email });
    revalidatePath("/admin/automation", "layout");
    return backToAdmin(state.returnTo, { connected: identity.email });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The connection failed";
    console.warn(`[automation] Google connection failed: ${message}`);
    return backToAdmin(state.returnTo, { error: message.slice(0, 300) });
  }
}
