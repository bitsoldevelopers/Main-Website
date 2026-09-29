import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApi, badRequest } from "@/lib/automation/api";
import { parseSpreadsheetId, readWorksheet } from "@/lib/automation/google/client";
import { worksheetSettings } from "@/lib/automation/imports";
import { buildPreview, isPreviewIssue } from "@/lib/automation/preview";

/**
 * Step 4 of the wizard: the first rows of a worksheet as Google has them,
 * the detected column mapping and a data-quality report. Nothing is written.
 */
export async function GET(req: NextRequest) {
  return adminApi("outreach.write", async () => {
    const params = req.nextUrl.searchParams;
    const connectionId = params.get("connection") ?? "";
    const spreadsheetId = parseSpreadsheetId(params.get("spreadsheet") ?? "");
    const gid = Number.parseInt(params.get("gid") ?? "", 10);
    if (!connectionId) return badRequest("Choose a Google account first.");
    if (!spreadsheetId || !Number.isInteger(gid)) return badRequest("Choose a spreadsheet and a worksheet first.");

    const { table, spreadsheetName, worksheetTitle } = await readWorksheet(connectionId, spreadsheetId, gid);
    if (table.headers.length === 0) {
      return NextResponse.json({ error: `"${worksheetTitle}" is empty: there is no header row to read.` }, { status: 422 });
    }

    // A worksheet that is already linked opens with the settings it was saved with.
    const linked = await prisma.googleSheetWorksheet.findUnique({
      where: { spreadsheetId_worksheetId: { spreadsheetId, worksheetId: gid } },
    });
    // The mapping being edited in the wizard wins over the saved one.
    let mapping: unknown = linked?.mapping;
    const edited = params.get("mapping");
    if (edited) {
      try {
        mapping = JSON.parse(edited);
      } catch {
        return badRequest("The column mapping could not be read.");
      }
    }
    const issue = params.get("issue");
    const preview = buildPreview(table, mapping, isPreviewIssue(issue) ? issue : null);
    return NextResponse.json({
      source: { type: "google_sheets", name: spreadsheetName, worksheet: worksheetTitle },
      preview,
      linked: linked
        ? { id: linked.id, settings: worksheetSettings(linked), syncIntervalMinutes: linked.syncIntervalMinutes }
        : null,
    });
  });
}
