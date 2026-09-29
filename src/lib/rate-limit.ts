/**
 * Small in-memory rate limiter. The site deploys as a single Node process
 * (Hostinger runs one server.js), so per-process counters are sufficient.
 * If the app ever runs multi-instance, swap this for a shared store.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Returns true when the caller is within `limit` hits per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Clear a key after a successful, non-abusive interaction (e.g. login). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Best-effort client IP for keying; falls back to a shared bucket. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Stop the map growing forever on long-lived processes.
const SWEEP_EVERY = 10 * 60 * 1000;
let lastSweep = Date.now();
export function sweepExpired(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_EVERY) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}
