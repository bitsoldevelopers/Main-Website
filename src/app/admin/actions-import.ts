"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { revokeConnection } from "@/lib/automation/google/client";
import { resolveReviewRow, type ReviewDecision } from "@/lib/automation/import-pipeline";
import { queueWorksheetSync } from "@/lib/automation/imports";
import { isSyncInterval } from "@/lib/automation/sources/types";
import { runDueJobs } from "@/lib/automation/worker";

/** Writes of the lead sources: linked worksheets, syncs, and held duplicates. */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

const SHEETS = "/admin/automation/sources/google-sheets";

export async function syncWorksheetNow(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const importId = await queueWorksheetSync(id, "MANUAL", actorLabel(session));
  if (!importId) redirect(`${SHEETS}?error=${encodeURIComponent("That worksheet is no longer linked.")}`);
  void logActivity({ actor: actorLabel(session), action: "import.sync_requested", entity: "import", entityId: importId });
  revalidatePath("/admin/automation", "layout");
  after(() => runDueJobs({ source: "sync" }).then(() => undefined));
  redirect(`/admin/automation/imports/${importId}`);
}

export async function setWorksheetInterval(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const minutes = Number.parseInt(str(formData, "minutes"), 10);
  if (!isSyncInterval(minutes)) throw new Error("Choose one of the listed intervals");
  const worksheet = await prisma.googleSheetWorksheet.update({
    where: { id },
    data: { syncIntervalMinutes: minutes, nextSyncAt: minutes > 0 ? new Date(Date.now() + minutes * 60_000) : null },
    select: { spreadsheetName: true, worksheetTitle: true },
  });
  void logActivity({
    actor: actorLabel(session),
    action: "import.schedule_changed",
    entity: "import",
    detail: `${worksheet.spreadsheetName} › ${worksheet.worksheetTitle}: ${minutes > 0 ? `every ${minutes} min` : "manual"}`,
  });
  revalidatePath("/admin/automation", "layout");
}

/** Stops syncing a worksheet. The leads it brought in stay in the CRM. */
export async function unlinkWorksheet(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const id = str(formData, "id");
  const worksheet = await prisma.googleSheetWorksheet.delete({ where: { id }, select: { spreadsheetName: true, worksheetTitle: true } });
  void logActivity({
    actor: actorLabel(session),
    action: "import.worksheet_unlinked",
    entity: "import",
    detail: `${worksheet.spreadsheetName} › ${worksheet.worksheetTitle}`,
  });
  revalidatePath("/admin/automation", "layout");
}

/** Forgets a Google account: revokes the grant and deletes the stored tokens. */
export async function disconnectGoogle(formData: FormData) {
  const session = await requireAdminAction("outreach.manage");
  const id = str(formData, "id");
  const connection = await prisma.googleSheetConnection.findUnique({ where: { id }, select: { googleEmail: true } });
  if (!connection) return;
  await revokeConnection(id);
  await prisma.googleSheetConnection.delete({ where: { id } });
  void logActivity({ actor: actorLabel(session), action: "google.disconnected", entity: "automation", detail: connection.googleEmail });
  revalidatePath("/admin/automation", "layout");
}

export async function resolveReview(formData: FormData) {
  const session = await requireAdminAction("outreach.write");
  const rowId = str(formData, "rowId");
  const decision = str(formData, "decision");
  if (!["UPDATE", "CREATE", "DISMISS"].includes(decision)) throw new Error("Invalid decision");
  const outcome = await resolveReviewRow(rowId, decision as ReviewDecision);
  if (outcome) {
    void logActivity({ actor: actorLabel(session), action: "import.review_resolved", entity: "import", entityId: rowId, detail: `${decision} → ${outcome}` });
  }
  revalidatePath("/admin/automation", "layout");
  revalidatePath("/admin/leads");
}
