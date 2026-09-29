import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/admin/activity";
import { verifyPassword } from "@/lib/admin/password";
import { isAdminRole } from "@/lib/admin/rbac";
import {
  ADMIN_COOKIE,
  isAdminConfigured,
  issueSessionToken,
  sessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/admin/session";
import { clientIp, rateLimit, resetRateLimit, sweepExpired } from "@/lib/rate-limit";

const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW = 15 * 60 * 1000;

/**
 * Two ways in: the owner password (ADMIN_SECRET, no email) or a User-table
 * account with an admin-capable role. Both produce the same signed session
 * cookie; the role inside it drives every later permission check.
 */
export async function POST(req: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Admin login is not configured (ADMIN_SECRET is missing)." },
      { status: 500 }
    );
  }

  sweepExpired();
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}`, ATTEMPT_LIMIT, ATTEMPT_WINDOW)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json({ error: "A password is required." }, { status: 400 });
  }

  let identity: { sub: string; name: string; role: "ADMIN" | "EDITOR" | "MANAGER" } | null = null;

  if (typeof email === "string" && email.trim()) {
    const normalized = email.trim().toLowerCase();
    try {
      const user = await prisma.user.findUnique({ where: { email: normalized } });
      if (user && isAdminRole(user.role) && verifyPassword(password, user.password)) {
        identity = { sub: user.id, name: user.name || user.email, role: user.role };
      }
    } catch (err) {
      console.error("Login user lookup failed:", err);
      return NextResponse.json({ error: "Login is temporarily unavailable (database unreachable)." }, { status: 503 });
    }
  } else if (verifyAdminPassword(password)) {
    identity = { sub: "owner", name: "Owner", role: "ADMIN" };
  }

  if (!identity) {
    void logActivity({ actor: ip, action: "auth.login_failed", entity: "auth", detail: typeof email === "string" ? email : "owner password" });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  resetRateLimit(`login:${ip}`);
  const token = await issueSessionToken(identity);
  void logActivity({ actor: `${identity.name} (${identity.role})`, action: "auth.login", entity: "auth", entityId: identity.sub });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token as string, sessionCookieOptions);
  return res;
}

export async function DELETE(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url));
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
