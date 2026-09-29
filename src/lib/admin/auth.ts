import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, readSession, type AdminSession } from "./session";
import { hasPermission, type Permission } from "./rbac";

/**
 * Data-access-layer style session check, memoised per request so a page and
 * its layout share one cookie read.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const store = await cookies();
  return readSession(store.get(ADMIN_COOKIE)?.value);
});

export const verifyAdmin = async (): Promise<boolean> => (await getAdminSession()) !== null;

/**
 * For pages and layouts: anonymous visitors go to the login screen; signed-in
 * users missing the module's permission land on the 403 page.
 */
export async function requireAdminPage(permission?: Permission): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (permission && !hasPermission(session.role, permission)) redirect("/admin/forbidden");
  return session;
}

/**
 * For Server Actions and admin API routes: they are reachable by direct POST,
 * so every one of them verifies the session itself instead of trusting the
 * proxy, and re-checks the permission server-side.
 */
export async function requireAdminAction(permission?: Permission): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized");
  if (permission && !hasPermission(session.role, permission)) throw new Error("Forbidden");
  return session;
}

/** "Adnan (ADMIN)" — the actor string written to the activity log. */
export function actorLabel(session: AdminSession): string {
  return `${session.name || session.sub} (${session.role})`;
}
