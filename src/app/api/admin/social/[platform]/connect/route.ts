import { NextResponse } from "next/server";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { facebookAuthUrl } from "@/lib/admin/social/facebook";
import { linkedInAuthUrl } from "@/lib/admin/social/linkedin";
import { redirectToPath, withQuery } from "@/lib/redirect";
import { STATE_COOKIE, issueState, stateCookieOptions } from "@/lib/admin/social/oauth-state";
import { callbackUrl, missingEnv, platformFromSlug, siteOrigin } from "@/lib/admin/social/platforms";

/**
 * Starts the OAuth flow: sends a signed-in admin to LinkedIn or Facebook to
 * approve access, and comes back through ../callback.
 */
export async function GET(req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const platform = platformFromSlug((await params).platform);
  if (!platform) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });

  let session;
  try {
    session = await requireAdminAction("social.manage");
  } catch (err) {
    const forbidden = err instanceof Error && err.message === "Forbidden";
    return redirectToPath(forbidden ? "/admin/forbidden" : "/admin/login");
  }

  const missing = missingEnv(platform);
  if (missing.length > 0) {
    return redirectToPath(withQuery("/admin/social", "error", `Set ${missing.join(", ")} on the server before connecting.`));
  }

  const { cookie, state } = issueState(platform, actorLabel(session));
  const redirectUri = callbackUrl(siteOrigin(req), platform);
  const res = NextResponse.redirect(
    platform === "FACEBOOK" ? facebookAuthUrl(state, redirectUri) : linkedInAuthUrl(state, redirectUri)
  );
  res.cookies.set(STATE_COOKIE, cookie, stateCookieOptions);
  return res;
}
