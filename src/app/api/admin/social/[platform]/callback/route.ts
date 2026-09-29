import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/admin/activity";
import { saveConnectedAccounts } from "@/lib/admin/social/accounts";
import { connectFacebook } from "@/lib/admin/social/facebook";
import { connectLinkedIn } from "@/lib/admin/social/linkedin";
import { STATE_COOKIE, readState, stateCookieOptions } from "@/lib/admin/social/oauth-state";
import { PLATFORM_INFO, callbackUrl, platformFromSlug, siteOrigin } from "@/lib/admin/social/platforms";

/**
 * Where LinkedIn and Facebook send the admin back after they approve (or
 * refuse) access. Trades the one-time code for tokens and stores them.
 *
 * The answer is a small page that forwards to /admin/social, not an HTTP
 * redirect: this request arrived from another site, so the browser withheld
 * the SameSite=Strict session cookie and would withhold it from a redirect
 * too, which would land a signed-in admin on the login screen.
 */
function backToAdmin(query: Record<string, string>): NextResponse {
  const target = `/admin/social?${new URLSearchParams(query)}`.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  const res = new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">` +
      `<meta http-equiv="refresh" content="0;url=${target}"><title>Returning to the admin</title></head>` +
      `<body style="font-family:system-ui,sans-serif;padding:3rem;color:#334155">` +
      `<p>Returning to the admin… <a href="${target}">Continue</a></p></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  );
  res.cookies.set(STATE_COOKIE, "", { ...stateCookieOptions, maxAge: 0 });
  return res;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const platform = platformFromSlug((await params).platform);
  if (!platform) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const label = PLATFORM_INFO[platform].label;

  const query = req.nextUrl.searchParams;
  const state = readState(req.cookies.get(STATE_COOKIE)?.value, query.get("state"), platform);
  if (!state) {
    return backToAdmin({ error: `The ${label} connection expired or was started in another browser. Try again.` });
  }

  const denied = query.get("error");
  const code = query.get("code");
  if (denied || !code) {
    const reason = query.get("error_description") ?? denied ?? "no authorization code was returned";
    return backToAdmin({ error: `${label} did not grant access: ${reason.slice(0, 200)}` });
  }

  try {
    const redirectUri = callbackUrl(siteOrigin(req), platform);
    const accounts = platform === "FACEBOOK" ? await connectFacebook(code, redirectUri) : await connectLinkedIn(code, redirectUri);
    await saveConnectedAccounts(accounts, state.actor);
    void logActivity({
      actor: state.actor,
      action: "social.connected",
      entity: "social",
      detail: `${label}: ${accounts.map((a) => a.name).join(", ")}`,
    });
    revalidatePath("/admin/social");
    return backToAdmin({ connected: accounts.map((a) => a.name).join(", ").slice(0, 200), platform: label });
  } catch (err) {
    const message = err instanceof Error ? err.message : "The connection failed";
    console.warn(`[admin] ${label} connection failed: ${message}`);
    return backToAdmin({ error: message.slice(0, 300) });
  }
}
