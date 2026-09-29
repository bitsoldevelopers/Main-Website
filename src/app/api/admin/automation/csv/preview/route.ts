import { NextResponse } from "next/server";
import { adminApi, badRequest } from "@/lib/automation/api";
import { buildPreview, isPreviewIssue } from "@/lib/automation/preview";
import { CSV_MAX_BYTES, CSV_MAX_ROWS, parseCsv } from "@/lib/automation/sources/csv";

/**
 * Preview of an uploaded CSV, the same shape the Google Sheets preview has.
 * The file is parsed and thrown away; nothing is stored until the import is
 * started.
 */
export async function POST(req: Request) {
  return adminApi("outreach.write", async () => {
    let body: { filename?: unknown; content?: unknown; mapping?: unknown; issue?: unknown };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return badRequest("Expected a JSON body with the file's content.");
    }
    const content = typeof body.content === "string" ? body.content : "";
    const filename = typeof body.filename === "string" ? body.filename.slice(0, 200) : "upload.csv";
    if (!content.trim()) return badRequest("The file is empty.");
    if (Buffer.byteLength(content, "utf8") > CSV_MAX_BYTES) return badRequest("The file is larger than 8 MB. Split it and upload the parts.");

    const table = parseCsv(content);
    if (table.headers.length === 0) return badRequest("No header row was found in the file.");
    if (table.rows.length > CSV_MAX_ROWS) {
      return badRequest(`The file has ${table.rows.length.toLocaleString()} rows; the limit is ${CSV_MAX_ROWS.toLocaleString()} per upload.`);
    }
    return NextResponse.json({
      source: { type: "csv", name: filename, worksheet: null },
      preview: buildPreview(table, body.mapping, isPreviewIssue(body.issue) ? body.issue : null),
      linked: null,
    });
  });
}
