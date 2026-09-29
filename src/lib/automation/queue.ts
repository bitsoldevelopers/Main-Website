import { prisma } from "@/lib/prisma";

/**
 * The job queue: rows in AutomationJob. It lives in the database the site
 * already has, so it needs no Redis or worker host and survives restarts and
 * deploys. Workers claim a job with a conditional update, which makes the
 * claim atomic even if two processes (the in-process scheduler and a cron
 * request, say) look at the same row at once.
 */

export const JOB_TYPES = ["RUN_STEP", "IMPORT"] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  RUN_STEP: "Automation step",
  IMPORT: "Lead import",
};

/** A worker that died mid-job loses its claim after this long. */
export const LOCK_TIMEOUT_MS = 15 * 60_000;

/** Wait before retry number n (1-based): 1 min, 5 min, 15 min, 1 h, 3 h. */
const BACKOFF_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 3 * 60 * 60_000];

export function backoffMs(attempt: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempt, 1), BACKOFF_MS.length) - 1];
}

export async function enqueueJob(input: { type: JobType; refId: string; runAt?: Date; maxAttempts?: number }): Promise<string> {
  const job = await prisma.automationJob.create({
    data: { type: input.type, refId: input.refId, runAt: input.runAt ?? new Date(), maxAttempts: input.maxAttempts ?? 5 },
    select: { id: true },
  });
  return job.id;
}

/** Cancels the jobs of one subject that have not started. Returns how many. */
export async function cancelJobs(type: JobType, refId: string): Promise<number> {
  const result = await prisma.automationJob.updateMany({
    where: { type, refId, status: "PENDING" },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });
  return result.count;
}

export async function hasOpenJob(type: JobType, refId: string): Promise<boolean> {
  const count = await prisma.automationJob.count({ where: { type, refId, status: { in: ["PENDING", "RUNNING"] } } });
  return count > 0;
}

export interface ClaimedJob {
  id: string;
  type: string;
  refId: string;
  attempts: number;
  maxAttempts: number;
}

/**
 * Claims up to `limit` due jobs for this worker: pending ones whose time has
 * come, and running ones whose worker evidently died.
 */
export async function claimDueJobs(workerId: string, limit: number, now = new Date()): Promise<ClaimedJob[]> {
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  const candidates = await prisma.automationJob.findMany({
    where: {
      OR: [
        { status: "PENDING", runAt: { lte: now } },
        { status: "RUNNING", lockedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { runAt: "asc" },
    take: limit,
    select: { id: true, type: true, refId: true, status: true, lockedAt: true, attempts: true, maxAttempts: true },
  });

  const claimed: ClaimedJob[] = [];
  for (const job of candidates) {
    const result = await prisma.automationJob.updateMany({
      // Only succeeds if nobody changed the row since it was read.
      where: { id: job.id, status: job.status, lockedAt: job.lockedAt },
      data: { status: "RUNNING", lockedAt: now, lockedBy: workerId, attempts: { increment: 1 } },
    });
    if (result.count === 1) {
      claimed.push({ id: job.id, type: job.type, refId: job.refId, attempts: job.attempts + 1, maxAttempts: job.maxAttempts });
    }
  }
  return claimed;
}

export async function completeJob(id: string, result: string): Promise<void> {
  await prisma.automationJob.update({
    where: { id },
    data: { status: "DONE", result: result.slice(0, 2000), lastError: null, lockedAt: null, lockedBy: null, finishedAt: new Date() },
  });
}

/** Could not act yet (sender not configured, daily limit…). Not a failure. */
export async function deferJob(id: string, until: Date, reason: string): Promise<void> {
  await prisma.automationJob.update({
    where: { id },
    data: { status: "PENDING", runAt: until, lastError: reason.slice(0, 2000), lockedAt: null, lockedBy: null, attempts: { decrement: 1 } },
  });
}

/** Retries with backoff until the attempts run out, then fails for good. */
export async function failJob(job: ClaimedJob, error: string, options: { retry: boolean }): Promise<"RETRY" | "FAILED"> {
  const retry = options.retry && job.attempts < job.maxAttempts;
  await prisma.automationJob.update({
    where: { id: job.id },
    data: retry
      ? { status: "PENDING", runAt: new Date(Date.now() + backoffMs(job.attempts)), lastError: error.slice(0, 2000), lockedAt: null, lockedBy: null }
      : { status: "FAILED", lastError: error.slice(0, 2000), lockedAt: null, lockedBy: null, finishedAt: new Date() },
  });
  return retry ? "RETRY" : "FAILED";
}

/** Thrown by a job handler for a failure that is worth another attempt. */
export class RetryableError extends Error {
  readonly retryable = true;
}

/** Finished jobs are a log, not a record; keep a month of them. */
export async function pruneJobs(olderThanDays = 30): Promise<number> {
  const before = new Date(Date.now() - olderThanDays * 86_400_000);
  const result = await prisma.automationJob.deleteMany({
    where: { status: { in: ["DONE", "CANCELLED"] }, finishedAt: { lt: before } },
  });
  return result.count;
}
