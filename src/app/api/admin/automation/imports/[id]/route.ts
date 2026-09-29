import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminApi } from "@/lib/automation/api";

/** Progress of one import, polled by the wizard while the queue works on it. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return adminApi("outreach.read", async () => {
    const { id } = await params;
    const batch = await prisma.leadImport.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        label: true,
        totalRows: true,
        createdCount: true,
        updatedCount: true,
        duplicateCount: true,
        invalidCount: true,
        skippedCount: true,
        failedCount: true,
        automationStarted: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!batch) return NextResponse.json({ error: "This import no longer exists." }, { status: 404 });
    return NextResponse.json({ import: batch }, { headers: { "Cache-Control": "no-store" } });
  });
}
