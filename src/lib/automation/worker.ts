import { randomUUID } from "node:crypto";
import { failRun, processRun, type StepBudget } from "./engine";
import { runImport } from "./import-pipeline";
import { pruneQuietSyncs, queueDueSyncs } from "./imports";
import { RetryableError, claimDueJobs, completeJob, deferJob, failJob, pruneJobs, type ClaimedJob } from "./queue";
import { getOutreachSettings } from "./settings";

/**
 * One pass over the job queue. Two things call it, and either is enough:
 *
 *  - the in-process scheduler (src/instrumentation.ts), once a minute while
 *    the Node server is up;
 *  - GET/POST /api/automation/cron, for a host cron job, which keeps things
 *    moving even when the server was idle or restarted.
 *
 * Both can run at once: jobs are claimed atomically in the database, and a
 * second pass in the same process simply returns.
 */

export interface TickReport {
  source: string;
  ranAt: string;
  durationMs: number;
  skipped?: string;
  syncsQueued: number;
  claimed: number;
  done: number;
  deferred: number;
  retried: number;
  failed: number;
  emailsSent: number;
}

const state = globalThis as unknown as {
  __bitsolAutomationTick?: Promise<TickReport> | null;
  __bitsolAutomationLastTick?: TickReport;
  __bitsolAutomationLastPrune?: number;
};

export function lastTick(): TickReport | undefined {
  return state.__bitsolAutomationLastTick;
}

async function runJob(job: ClaimedJob, budget: StepBudget): Promise<{ note: string; sent: number; deferUntil?: Date }> {
  if (job.type === "RUN_STEP") return processRun(job.refId, budget);
  if (job.type === "IMPORT") return { note: await runImport(job.refId), sent: 0 };
  throw new Error(`Unknown job type "${job.type}"`);
}

async function tick(options: { source: string; budgetMs: number; limit: number }): Promise<TickReport> {
  const started = Date.now();
  const report: TickReport = {
    source: options.source,
    ranAt: new Date(started).toISOString(),
    durationMs: 0,
    syncsQueued: 0,
    claimed: 0,
    done: 0,
    deferred: 0,
    retried: 0,
    failed: 0,
    emailsSent: 0,
  };

  try {
    report.syncsQueued = await queueDueSyncs();
    const settings = await getOutreachSettings();
    const budget: StepBudget = { sendsLeft: settings.batchLimit };
    const workerId = `${options.source}:${randomUUID().slice(0, 8)}`;

    // Small claims, repeated: a job is only locked shortly before it runs.
    while (Date.now() - started < options.budgetMs && report.claimed < options.limit) {
      const jobs = await claimDueJobs(workerId, Math.min(5, options.limit - report.claimed));
      if (jobs.length === 0) break;
      report.claimed += jobs.length;

      for (const job of jobs) {
        try {
          const outcome = await runJob(job, budget);
          report.emailsSent += outcome.sent;
          if (outcome.deferUntil) {
            await deferJob(job.id, outcome.deferUntil, outcome.note);
            report.deferred++;
          } else {
            await completeJob(job.id, outcome.note);
            report.done++;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          const result = await failJob(job, message, { retry: err instanceof RetryableError });
          if (result === "RETRY") report.retried++;
          else {
            report.failed++;
            if (job.type === "RUN_STEP") await failRun(job.refId, message);
            console.warn(`[automation] job ${job.type} ${job.refId} failed: ${message}`);
          }
        }
      }
    }

    const dayAgo = Date.now() - 86_400_000;
    if ((state.__bitsolAutomationLastPrune ?? 0) < dayAgo) {
      state.__bitsolAutomationLastPrune = Date.now();
      await pruneJobs();
      await pruneQuietSyncs();
    }
  } catch (err) {
    // Usually the database being unreachable; the next pass tries again.
    report.skipped = err instanceof Error ? err.message.split("\n")[0] : "Unknown error";
  }

  report.durationMs = Date.now() - started;
  state.__bitsolAutomationLastTick = report;
  return report;
}

export function runDueJobs(options: { source: string; budgetMs?: number; limit?: number }): Promise<TickReport> {
  if (state.__bitsolAutomationTick) {
    return Promise.resolve({
      source: options.source,
      ranAt: new Date().toISOString(),
      durationMs: 0,
      skipped: "Another pass is already running in this process",
      syncsQueued: 0,
      claimed: 0,
      done: 0,
      deferred: 0,
      retried: 0,
      failed: 0,
      emailsSent: 0,
    });
  }
  const run = tick({ source: options.source, budgetMs: options.budgetMs ?? 45_000, limit: options.limit ?? 200 }).finally(() => {
    state.__bitsolAutomationTick = null;
  });
  state.__bitsolAutomationTick = run;
  return run;
}
