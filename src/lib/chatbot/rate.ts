import { clientIp, rateLimit as hit, sweepExpired } from "@/lib/rate-limit";

/**
 * Rate limiting for the chat endpoints, on top of the site's in-memory
 * limiter (one Node process on Hostinger, so per-process counters are
 * enough). Same shape as the Redis limiter the chatbot was written against,
 * so the engine code did not have to change.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  sweepExpired();
  const allowed = hit(`chatbot:${key}`, limit, windowSeconds * 1000);
  return { allowed, remaining: allowed ? 1 : 0 };
}

export { clientIp };
