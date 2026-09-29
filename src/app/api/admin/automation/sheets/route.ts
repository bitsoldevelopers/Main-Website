import { NextResponse, type NextRequest } from "next/server";
import { adminApi, badRequest } from "@/lib/automation/api";
import { listSpreadsheets } from "@/lib/automation/google/client";

/** Step 2 of the wizard: the spreadsheets a connected Google account can see. */
export async function GET(req: NextRequest) {
  return adminApi("outreach.write", async () => {
    const connectionId = req.nextUrl.searchParams.get("connection") ?? "";
    if (!connectionId) return badRequest("Choose a Google account first.");
    const query = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
    return NextResponse.json({ spreadsheets: await listSpreadsheets(connectionId, query) });
  });
}
