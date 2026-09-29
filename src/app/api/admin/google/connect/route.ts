import { NextResponse, type NextRequest } from "next/server";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { isCryptoConfigured } from "@/lib/automation/crypto";
import { googleAuthUrl, googleRedirectUri, missingGoogleEnv } from "@/lib/automation/google/client";
import { redirectToPath, withQuery } from "@/lib/redirect";
import { GOOGLE_STATE_COOKIE, issueState, safeReturnTo, siteOrigin, stateCookieOptions } from "@/lib/automation/google/oauth-state";

/**
 * Starts the Google OAuth flow: sends a signed-in admin to Google to approve
 * read-only access to their spreadsheets, and comes back through ../callback.
 */
export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAdminAction("outreach.manage");
  } catch (err) {
    const forbidden = err instanceof Error && err.message === "Forbidden";
    return redirectToPath(forbidden ? "/admin/forbidden" : "/admin/login");
  }

  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"));
  const back = (error: string) => redirectToPath(withQuery(returnTo, "error", error));

  const missing = missingGoogleEnv();
  if (missing.length > 0) return back(`Set ${missing.join(" and ")} on the server before connecting Google.`);
  if (!isCryptoConfigured()) return back("Set AUTOMATION_SECRET (or ADMIN_SECRET) on the server: it encrypts the stored Google tokens.");

  const { cookie, state } = issueState(actorLabel(session), returnTo);
  const res = NextResponse.redirect(googleAuthUrl(state, googleRedirectUri(siteOrigin(req))));
  res.cookies.set(GOOGLE_STATE_COOKIE, cookie, stateCookieOptions);
  return res;
}
