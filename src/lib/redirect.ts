import { NextResponse } from "next/server";

/**
 * Redirects to a path on this site from a route handler.
 *
 * `NextResponse.redirect` needs an absolute URL, and the obvious way to build
 * one, `new URL(path, req.url)`, is wrong on the live server: behind
 * Hostinger's proxy a route handler's `req.url` is the internal address, so
 * visitors were sent to https://0.0.0.0:3000/…. A relative Location header is
 * resolved by the browser against the address it actually asked for.
 */
export function redirectToPath(path: string, status: 302 | 303 | 307 | 308 = 307): NextResponse {
  return new NextResponse(null, { status, headers: { Location: sitePath(path) } });
}

/** `path` if it stays on this site, otherwise "/". */
export function sitePath(path: string): string {
  // "//host" and "/\host" are read by browsers as another site.
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(path)) return "/";
  return path;
}

/** `path` with one more query parameter, keeping the ones it has. */
export function withQuery(path: string, key: string, value: string): string {
  const url = new URL(sitePath(path), "http://site.invalid");
  url.searchParams.set(key, value);
  return url.pathname + url.search;
}
