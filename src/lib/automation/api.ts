import { NextResponse } from "next/server";
import { requireAdminAction } from "@/lib/admin/auth";
import type { Permission } from "@/lib/admin/rbac";
import type { AdminSession } from "@/lib/admin/session";
import { GoogleError } from "./google/client";
import { RetryableError } from "./queue";

/**
 * Wrapper for the admin JSON endpoints of the automation area. Route
 * handlers are reachable by direct request, so each one checks the session
 * and the permission itself; errors come back as { error } with a status the
 * wizard can show.
 */
export async function adminApi(
  permission: Permission,
  handler: (session: AdminSession) => Promise<NextResponse>
): Promise<NextResponse> {
  let session: AdminSession;
  try {
    session = await requireAdminAction(permission);
  } catch (err) {
    const forbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json({ error: forbidden ? "You do not have access to this." : "Sign in again." }, { status: forbidden ? 403 : 401 });
  }

  try {
    return await handler(session);
  } catch (err) {
    if (err instanceof GoogleError) {
      return NextResponse.json({ error: err.message, reconnect: err.needsReconnect }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    if (err instanceof RetryableError) {
      return NextResponse.json({ error: `${err.message}. Try again in a moment.` }, { status: 503 });
    }
    const message = err instanceof Error ? err.message.split("\n")[0] : "Something went wrong";
    console.warn(`[automation] admin API failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}
