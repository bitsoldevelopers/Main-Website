import type { GoogleSheetWorksheet } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueJob, hasOpenJob } from "./queue";
import { CSV_MAX_ROWS } from "./sources/csv";
import { cleanTags, parseImportSettings, type ImportSettings, type SourceTable } from "./sources/types";

/**
 * Starting imports. An import is a LeadImport row plus a job; the rows are
 * processed by the queue, so a thousand-row sheet never holds a web request
 * open and an import survives a restart.
 */

export function worksheetSettings(worksheet: GoogleSheetWorksheet): ImportSettings {
  return parseImportSettings({
    mapping: worksheet.mapping,
    duplicateMode: worksheet.duplicateMode,
    autoStartAutomation: worksheet.autoStartAutomation,
    automationId: worksheet.automationId ?? "",
    assignmentMode: worksheet.assignmentMode,
    assigneeId: worksheet.assigneeId ?? "",
    assignmentTeam: worksheet.assignmentTeam ?? "",
    tags: cleanTags(worksheet.tags),
    checkDomains: true,
  });
}

function asJson(settings: ImportSettings) {
  return JSON.parse(JSON.stringify(settings)) as Record<string, never>;
}

/** Queues a sync of a linked worksheet. Returns the running import if one is already open. */
export async function queueWorksheetSync(worksheetId: string, trigger: "MANUAL" | "SCHEDULED", actor: string): Promise<string | null> {
  const worksheet = await prisma.googleSheetWorksheet.findUnique({ where: { id: worksheetId } });
  if (!worksheet) return null;

  const open = await prisma.leadImport.findFirst({
    where: { worksheetId, status: { in: ["QUEUED", "RUNNING"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (open && (await hasOpenJob("IMPORT", open.id))) return open.id;

  const batch = await prisma.leadImport.create({
    data: {
      sourceType: "google_sheets",
      worksheetId,
      leadSourceId: worksheet.leadSourceId,
      label: `${worksheet.spreadsheetName} › ${worksheet.worksheetTitle}`.slice(0, 300),
      trigger,
      settings: asJson(worksheetSettings(worksheet)),
      startedBy: actor.slice(0, 191),
    },
    select: { id: true },
  });
  await prisma.googleSheetWorksheet.update({ where: { id: worksheetId }, data: { syncStatus: "QUEUED" } });
  await enqueueJob({ type: "IMPORT", refId: batch.id, maxAttempts: 3 });
  return batch.id;
}

export async function queueCsvImport(input: { filename: string; table: SourceTable; settings: ImportSettings; actor: string }): Promise<string> {
  if (input.table.rows.length > CSV_MAX_ROWS) {
    throw new Error(`This file has ${input.table.rows.length.toLocaleString()} rows; the limit is ${CSV_MAX_ROWS.toLocaleString()} per upload.`);
  }
  const batch = await prisma.leadImport.create({
    data: {
      sourceType: "csv",
      label: input.filename.slice(0, 300) || "CSV upload",
      trigger: "MANUAL",
      settings: asJson(input.settings),
      payload: JSON.stringify(input.table),
      startedBy: input.actor.slice(0, 191),
    },
    select: { id: true },
  });
  await enqueueJob({ type: "IMPORT", refId: batch.id, maxAttempts: 3 });
  return batch.id;
}

/** Linked worksheets whose next automatic sync is due. */
export async function queueDueSyncs(now = new Date()): Promise<number> {
  const due = await prisma.googleSheetWorksheet.findMany({
    where: {
      syncIntervalMinutes: { gt: 0 },
      nextSyncAt: { lte: now },
      syncStatus: { notIn: ["QUEUED", "RUNNING"] },
      connection: { status: "ACTIVE" },
    },
    select: { id: true },
    take: 20,
  });
  let queued = 0;
  for (const worksheet of due) {
    if (await queueWorksheetSync(worksheet.id, "SCHEDULED", "Scheduler")) queued++;
  }
  return queued;
}

/**
 * Automatic syncs that found nothing to do are noise after a week. Imports
 * that changed the CRM, and every manual import, are kept.
 */
export async function pruneQuietSyncs(olderThanDays = 7): Promise<number> {
  const before = new Date(Date.now() - olderThanDays * 86_400_000);
  const result = await prisma.leadImport.deleteMany({
    where: { trigger: "SCHEDULED", status: "COMPLETED", createdCount: 0, updatedCount: 0, failedCount: 0, createdAt: { lt: before } },
  });
  return result.count;
}
