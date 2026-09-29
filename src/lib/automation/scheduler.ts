import { runDueJobs } from "./worker";

/**
 * The in-process scheduler: one pass over the job queue a minute, for as
 * long as the Node server runs. Started once from src/instrumentation.ts.
 *
 * The site is a single long-lived Node process on Hostinger, which is what
 * makes this enough on its own. It is still only half of the design: the
 * host may stop an idle app, so production also calls /api/automation/cron
 * from a cron job. Set AUTOMATION_SCHEDULER=off to rely on cron alone.
 */

const INTERVAL_MS = 60_000;
const FIRST_RUN_MS = 20_000;

const state = globalThis as unknown as { __bitsolAutomationScheduler?: NodeJS.Timeout };

export function startScheduler(): void {
  if (state.__bitsolAutomationScheduler) return;
  if (process.env.AUTOMATION_SCHEDULER === "off") return;
  if (!process.env.DATABASE_URL) return;

  const pass = () => {
    void runDueJobs({ source: "scheduler" }).catch((err) => {
      console.warn("[automation] scheduler pass failed:", err instanceof Error ? err.message : err);
    });
  };
  const timer = setInterval(pass, INTERVAL_MS);
  // Never keep the process alive just for the scheduler.
  timer.unref();
  setTimeout(pass, FIRST_RUN_MS).unref();
  state.__bitsolAutomationScheduler = timer;
}

export function isSchedulerRunning(): boolean {
  return Boolean(state.__bitsolAutomationScheduler);
}
