/**
 * Runs once when the Next.js server starts. The only thing it does is start
 * the lead-automation scheduler, which works through the job queue (imports,
 * sheet syncs, outreach emails) once a minute.
 *
 * The import is inside the runtime check because the scheduler uses Prisma
 * and node:crypto, which do not exist in the Edge runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // `next build` loads this file too; there is nothing to schedule then.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startScheduler } = await import("./lib/automation/scheduler");
  startScheduler();
}
