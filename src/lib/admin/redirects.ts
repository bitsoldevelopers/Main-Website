/** Path helpers shared by the proxy's redirect lookup and the admin CRUD. */

export function normalizePath(pathname: string): string {
  let p = pathname.trim();
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.toLowerCase();
}

/** Validate a redirect pair; returns an error message or null when fine. */
export function redirectError(fromPath: string, toPath: string): string | null {
  if (!fromPath.startsWith("/")) return "The old URL must be a path starting with /.";
  if (fromPath === "/" ) return "The homepage cannot be redirected away.";
  if (normalizePath(fromPath).startsWith("/admin")) return "Admin paths cannot be redirected.";
  const isPath = toPath.startsWith("/");
  const isUrl = /^https?:\/\//.test(toPath);
  if (!isPath && !isUrl) return "The new URL must be a path starting with / or a full https:// URL.";
  if (isPath && normalizePath(toPath) === normalizePath(fromPath)) return "A redirect cannot point at itself.";
  return null;
}
