import { NextResponse, after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { actorLabel } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { adminApi, badRequest } from "@/lib/automation/api";
import { sanitizeMapping } from "@/lib/automation/columns";
import { parseSpreadsheetId, readWorksheet } from "@/lib/automation/google/client";
import { queueCsvImport, queueWorksheetSync } from "@/lib/automation/imports";
import { CSV_MAX_BYTES, parseCsv } from "@/lib/automation/sources/csv";
import { isSyncInterval, parseImportSettings } from "@/lib/automation/sources/types";
import { runDueJobs } from "@/lib/automation/worker";

/**
 * The wizard's last step: start an import. For Google Sheets this links the
 * worksheet (mapping, settings, sync schedule) and queues its first sync;
 * for CSV it stores the rows with the batch. Either way the rows are
 * processed by the job queue, started right after this response is sent,
 * and the wizard polls ./[id] for progress.
 */
export async function POST(req: Request) {
  return adminApi("outreach.write", async (session) => {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return badRequest("Expected a JSON body.");
    }
    const actor = actorLabel(session);
    const settings = parseImportSettings(body.settings);

    if (settings.autoStartAutomation && !settings.automationId) return badRequest("Choose the automation to start for new leads.");
    if (settings.assignmentMode === "USER" && !settings.assigneeId) return badRequest("Choose who the new leads are assigned to.");
    if (settings.assignmentMode === "TEAM" && !settings.assignmentTeam) return badRequest("Choose the team the new leads are shared between.");

    let importId: string | null;

    if (body.source === "csv") {
      const content = typeof body.content === "string" ? body.content : "";
      const filename = typeof body.filename === "string" ? body.filename : "upload.csv";
      if (!content.trim()) return badRequest("The file is empty.");
      if (Buffer.byteLength(content, "utf8") > CSV_MAX_BYTES) return badRequest("The file is larger than 8 MB.");
      const table = parseCsv(content);
      settings.mapping = sanitizeMapping(settings.mapping, table.headers);
      if (Object.keys(settings.mapping).length === 0) return badRequest("Map at least one column before importing.");
      importId = await queueCsvImport({ filename, table, settings, actor });
      void logActivity({ actor, action: "import.started", entity: "import", entityId: importId, detail: `CSV: ${filename} (${table.rows.length} rows)` });
    } else if (body.source === "google_sheets") {
      const connectionId = typeof body.connectionId === "string" ? body.connectionId : "";
      const spreadsheetId = parseSpreadsheetId(typeof body.spreadsheetId === "string" ? body.spreadsheetId : "");
      const gid = typeof body.worksheetId === "number" ? body.worksheetId : Number.parseInt(String(body.worksheetId), 10);
      const interval = typeof body.syncIntervalMinutes === "number" ? body.syncIntervalMinutes : Number.parseInt(String(body.syncIntervalMinutes ?? 0), 10);
      if (!connectionId || !spreadsheetId || !Number.isInteger(gid)) return badRequest("Choose a spreadsheet and a worksheet first.");
      if (!isSyncInterval(interval)) return badRequest("Choose one of the listed sync intervals.");

      // Read the header row again: the mapping must match the sheet as it is now.
      const { table, spreadsheetName, worksheetTitle } = await readWorksheet(connectionId, spreadsheetId, gid, { limit: 1 });
      settings.mapping = sanitizeMapping(settings.mapping, table.headers);
      if (Object.keys(settings.mapping).length === 0) return badRequest("Map at least one column before importing.");

      const data = {
        connectionId,
        spreadsheetName: spreadsheetName.slice(0, 300),
        worksheetTitle: worksheetTitle.slice(0, 300),
        mapping: settings.mapping,
        duplicateMode: settings.duplicateMode,
        autoStartAutomation: settings.autoStartAutomation,
        automationId: settings.automationId,
        assignmentMode: settings.assignmentMode,
        assigneeId: settings.assigneeId,
        assignmentTeam: settings.assignmentTeam,
        tags: settings.tags,
        syncIntervalMinutes: interval,
      };
      const worksheet = await prisma.googleSheetWorksheet.upsert({
        where: { spreadsheetId_worksheetId: { spreadsheetId, worksheetId: gid } },
        update: data,
        create: { ...data, spreadsheetId, worksheetId: gid, createdBy: actor.slice(0, 191) },
        select: { id: true },
      });
      importId = await queueWorksheetSync(worksheet.id, "MANUAL", actor);
      void logActivity({
        actor,
        action: "import.started",
        entity: "import",
        entityId: importId,
        detail: `Google Sheets: ${spreadsheetName} › ${worksheetTitle}`,
      });
    } else {
      return badRequest("Unknown import source.");
    }

    if (!importId) return NextResponse.json({ error: "The import could not be queued." }, { status: 500 });
    revalidatePath("/admin/automation", "layout");
    // Start on it now rather than at the scheduler's next minute.
    after(() => runDueJobs({ source: "import" }).then(() => undefined));
    return NextResponse.json({ importId }, { status: 202 });
  });
}
