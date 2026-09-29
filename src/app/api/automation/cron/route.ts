import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/automation/crypto";
import { runDueJobs } from "@/lib/automation/worker";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * One pass over the automation job queue, for a cron job on the host:
 *
 *   curl -fsS -H "Authorization: Bearer $AUTOMATION_CRON_SECRET" \
 *        https://bitsolmarketing.com/api/automation/cron
 *
 * The in-process scheduler does the same work while the server is up; this
 * endpoint is what keeps imports, syncs and follow-ups moving if the host
 * stopped an idle app. Calling it more often than needed is harmless.
 *
 * Disabled (404) until AUTOMATION_CRON_SECRET is set.
 */

// A pass is cut off well before a reverse proxy would give up on the request.
const BUDGET_MS = 25_000;

function presentedKey(req: Request): string {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  return bearer ?? req.headers.get("x-cron-key") ?? "";
}

async function handle(req: Request) {
  const secret = process.env.AUTOMATION_CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!rateLimit(`cron:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const key = presentedKey(req);
  if (!key || !secretsMatch(key, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const report = await runDueJobs({ source: "cron", budgetMs: BUDGET_MS });
  return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
}

export const GET = handle;
export const POST = handle;
