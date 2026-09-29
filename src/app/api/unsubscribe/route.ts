import { NextResponse, type NextRequest } from "next/server";
import { readUnsubscribeToken } from "@/lib/automation/crypto";
import { markUnsubscribed } from "@/lib/automation/engine";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * One-click unsubscribe (RFC 8058). Mail clients POST here when the reader
 * presses "Unsubscribe" next to the sender's name; the link in the email
 * footer opens /unsubscribe, which posts here too.
 *
 * The token is signed, so only an address we actually emailed can be
 * unsubscribed, and only through a link from that email. GET never changes
 * anything: link scanners follow links, and a scanner must not opt anyone out.
 */
export async function POST(req: NextRequest) {
  if (!rateLimit(`unsubscribe:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let token = req.nextUrl.searchParams.get("token");
  if (!token) {
    const type = req.headers.get("content-type") ?? "";
    try {
      if (type.includes("application/json")) {
        const body = (await req.json()) as { token?: unknown };
        token = typeof body.token === "string" ? body.token : null;
      } else if (type.includes("form")) {
        const value = (await req.formData()).get("token");
        token = typeof value === "string" ? value : null;
      }
    } catch {
      token = null;
    }
  }

  const subject = readUnsubscribeToken(token);
  if (!subject) return NextResponse.json({ error: "This unsubscribe link is not valid." }, { status: 400 });

  try {
    await markUnsubscribed({ leadId: subject.leadId, email: subject.email, source: "Unsubscribe link" });
  } catch (err) {
    console.error("[automation] unsubscribe failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We could not process that right now. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export function GET(req: NextRequest) {
  const target = new URL("/unsubscribe", req.url);
  const token = req.nextUrl.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target);
}
