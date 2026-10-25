import { requireAdminAction } from "@/lib/admin/auth";
import type { Permission } from "@/lib/admin/rbac";
import type { AdminSession } from "@/lib/admin/session";

/**
 * Session check for the chatbot's admin API routes. They are reachable by
 * direct request, so each verifies the cookie and the permission itself and
 * answers with a JSON error instead of a redirect.
 */
export async function guardApi(permission: Permission): Promise<{ session: AdminSession } | { response: Response }> {
  try {
    return { session: await requireAdminAction(permission) };
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "Forbidden";
    return {
      response: Response.json(
        { error: forbidden ? "You do not have permission to do that." : "Not authorised." },
        { status: forbidden ? 403 : 401 }
      ),
    };
  }
}
