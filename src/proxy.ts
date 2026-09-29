import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, isValidSession } from "@/lib/admin/session";
import { normalizePath } from "@/lib/admin/redirects";
import { prisma } from "@/lib/prisma";

/**
 * Two jobs, both cheap per-request:
 *  - Optimistic gate for /admin. It only reads the cookie (no database);
 *    pages and Server Actions verify the session again themselves.
 *  - Redirect rules managed at /admin/redirects. The table is cached in
 *    process for a minute so public traffic costs one Map lookup, not a
 *    query; a database outage just means no custom redirects until it heals.
 */

interface RedirectRule {
  id: string;
  toPath: string;
  permanent: boolean;
}

const REDIRECT_TTL = 60_000;
let redirectCache: { rules: Map<string, RedirectRule>; loadedAt: number } = {
  rules: new Map(),
  loadedAt: 0,
};

async function redirectRules(): Promise<Map<string, RedirectRule>> {
  const now = Date.now();
  if (now - redirectCache.loadedAt < REDIRECT_TTL) return redirectCache.rules;
  redirectCache = { ...redirectCache, loadedAt: now }; // one refresh per TTL even on failure
  try {
    const rows = await prisma.redirect.findMany({
      where: { active: true },
      select: { id: true, fromPath: true, toPath: true, permanent: true },
    });
    const rules = new Map<string, RedirectRule>();
    for (const row of rows) {
      rules.set(normalizePath(row.fromPath), { id: row.id, toPath: row.toPath, permanent: row.permanent });
    }
    redirectCache = { rules, loadedAt: now };
  } catch {
    // Keep whatever rules we had; retry after the TTL.
  }
  return redirectCache.rules;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const onLoginPage = pathname.startsWith("/admin/login");
    const signedIn = await isValidSession(req.cookies.get(ADMIN_COOKIE)?.value);

    if (!onLoginPage && !signedIn) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
    if (onLoginPage && signedIn) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  const rule = (await redirectRules()).get(normalizePath(pathname));
  if (rule) {
    const target = new URL(rule.toPath, req.url);
    if (normalizePath(target.pathname) !== normalizePath(pathname) || target.origin !== req.nextUrl.origin) {
      void prisma.redirect.update({ where: { id: rule.id }, data: { hits: { increment: 1 } } }).catch(() => {});
      if (!target.search) target.search = req.nextUrl.search;
      return NextResponse.redirect(target, rule.permanent ? 308 : 307);
    }
  }

  return NextResponse.next();
}

export const config = {
  // /admin for the auth gate; extension-less public paths for redirect rules.
  // _next assets, API routes and files (anything with a dot) are skipped.
  matcher: ["/admin/:path*", "/((?!_next/|api/|admin|.*\\.).*)"],
};
