import { resolve4, resolveMx } from "node:dns/promises";
import type { DomainStatus } from "./validate";

/**
 * DNS side of email validation: does a domain accept mail at all? Server
 * only. Kept apart from validate.ts so the pure checks can be imported by
 * client components.
 */

const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

function errorCode(err: unknown): string {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Does the domain accept mail? Only a definite "this domain does not exist /
 * has no mail server" counts against an address; a timeout or a resolver
 * failure is UNKNOWN and changes nothing.
 */
export async function lookupDomain(domain: string, timeoutMs = 4000): Promise<DomainStatus> {
  try {
    const mx = await withTimeout(resolveMx(domain), timeoutMs);
    // A single "." exchange is the null MX of RFC 7505: "we take no mail".
    if (mx.some((record) => record.exchange && record.exchange !== ".")) return "ACCEPTS_MAIL";
    if (mx.length > 0) return "NO_MAIL_SERVER";
  } catch (err) {
    if (!NOT_FOUND.has(errorCode(err))) return "UNKNOWN";
  }
  // No MX: mail falls back to the A record, if there is one.
  try {
    const a = await withTimeout(resolve4(domain), timeoutMs);
    return a.length > 0 ? "ACCEPTS_MAIL" : "NO_MAIL_SERVER";
  } catch (err) {
    return NOT_FOUND.has(errorCode(err)) ? "NO_MAIL_SERVER" : "UNKNOWN";
  }
}

export type DomainLookup = (domain: string) => Promise<DomainStatus>;

/**
 * Checks many domains with bounded concurrency and one lookup per domain.
 * Returns a map of domain → status.
 */
export async function lookupDomains(
  domains: Iterable<string>,
  options: { concurrency?: number; lookup?: DomainLookup; deadlineMs?: number } = {}
): Promise<Map<string, DomainStatus>> {
  const { concurrency = 15, lookup = lookupDomain, deadlineMs = 60_000 } = options;
  const queue = [...new Set([...domains].filter(Boolean))];
  const result = new Map<string, DomainStatus>();
  const startedAt = Date.now();

  async function worker() {
    for (;;) {
      const domain = queue.shift();
      if (!domain) return;
      // Past the deadline the rest stay UNKNOWN rather than hold up an import.
      if (Date.now() - startedAt > deadlineMs) {
        result.set(domain, "UNKNOWN");
        continue;
      }
      try {
        result.set(domain, await lookup(domain));
      } catch {
        result.set(domain, "UNKNOWN");
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return result;
}
