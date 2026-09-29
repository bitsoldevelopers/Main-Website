import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApi, badRequest } from "@/lib/automation/api";
import { getSpreadsheet, parseSpreadsheetId } from "@/lib/automation/google/client";

/**
 * Step 3 of the wizard: the tabs of one spreadsheet. Accepts the id from the
 * list or a pasted spreadsheet link, and says which tabs are linked already.
 */
export async function GET(req: NextRequest) {
  return adminApi("outreach.write", async () => {
    const connectionId = req.nextUrl.searchParams.get("connection") ?? "";
    const spreadsheetId = parseSpreadsheetId(req.nextUrl.searchParams.get("spreadsheet") ?? "");
    if (!connectionId) return badRequest("Choose a Google account first.");
    if (!spreadsheetId) return badRequest("That is not a Google Sheets link or id.");

    const spreadsheet = await getSpreadsheet(connectionId, spreadsheetId);
    const linked = await prisma.googleSheetWorksheet.findMany({
      where: { spreadsheetId: spreadsheet.id },
      select: { id: true, worksheetId: true },
    });
    const linkedByGid = new Map(linked.map((row) => [row.worksheetId, row.id]));
    return NextResponse.json({
      spreadsheet: { id: spreadsheet.id, name: spreadsheet.name },
      worksheets: spreadsheet.worksheets.map((sheet) => ({ ...sheet, linkedId: linkedByGid.get(sheet.id) ?? null })),
    });
  });
}
