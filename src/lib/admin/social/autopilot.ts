import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { services } from "@/lib/services";
import { logActivity } from "../activity";
import { publishToAccount, type PublishOutcome } from "./accounts";
import {
  DEFAULT_SETTINGS,
  EMPTY_STATE,
  FAILURES_BEFORE_PAUSE,
  SOURCE_LABEL,
  buildAutopilotPrompt,
  isDue,
  nextRunAfter,
  parseSettings,
  parseState,
  pickArticle,
  pickFormat,
  pickService,
  pickSource,
  pickTipTheme,
  readAutopilotAnswer,
  recentTips,
  remember,
  rescheduleOnSave,
  type AutopilotSettings,
  type AutopilotSource,
  type AutopilotState,
  type PostBrief,
  type PostFormat,
} from "./autopilot-plan";
import { CLOUDFLARE_WRITER_MODELS, cloudflareCredentials, drawImage } from "./cloudflare";
import { getSocialConfig, type SocialConfig } from "./config";
import { describePicture, writeText } from "./copy";
import { buildImagePrompt, toPostJpeg } from "./image";
import type { PostInput, SocialPlatform } from "./platforms";

/**
 * The social autopilot: on a fixed interval it writes a post, draws its
 * image and publishes it to every connected LinkedIn and Facebook account,
 * with nobody reviewing it first. Built at the owner's request on 19 Nov
 * 2026 ("every 2 hours", day and night, published automatically, subjects
 * rotating between blog articles, services and tips).
 *
 * It runs from the automation scheduler's once-a-minute pass
 * (lib/automation/worker.ts). Settings and progress are two SiteSetting rows,
 * so it needed no database change. A third row is a lock: creating it fails
 * while another pass (the cron endpoint, a second process, "Post one now")
 * is making a post, which is what stops the same slot being posted twice.
 */

const SETTINGS_KEY = "socialAutopilot.settings";
const STATE_KEY = "socialAutopilot.state";
const LOCK_KEY = "socialAutopilot.lock";
/** A post takes well under a minute; a lock this old was left by a crash. */
const LOCK_STALE_MS = 10 * 60_000;
export const AUTOPILOT_ACTOR = "Autopilot";
/** Per model. GPT-OSS usually answers in 9-12 s, but has taken a minute. */
const WRITER_TIMEOUT = 75_000;

const PLATFORM_LABEL: Record<SocialPlatform, string> = { LINKEDIN: "LinkedIn", FACEBOOK: "Facebook" };

// ─── Settings and state ─────────────────────────────────────────────────────

function parseJson(value: string | undefined): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getAutopilot(): Promise<{ settings: AutopilotSettings; state: AutopilotState }> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: [SETTINGS_KEY, STATE_KEY] } } });
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  return {
    settings: byKey.has(SETTINGS_KEY) ? parseSettings(parseJson(byKey.get(SETTINGS_KEY))) : DEFAULT_SETTINGS,
    state: byKey.has(STATE_KEY) ? parseState(parseJson(byKey.get(STATE_KEY))) : EMPTY_STATE,
  };
}

function upsertJson(key: string, data: unknown) {
  const value = JSON.stringify(data);
  return prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function saveAutopilotSettings(next: AutopilotSettings): Promise<void> {
  const { settings: before, state } = await getAutopilot();
  const nextRunAt = rescheduleOnSave(before, next, state, new Date());
  await prisma.$transaction([upsertJson(SETTINGS_KEY, next), upsertJson(STATE_KEY, { ...state, nextRunAt })]);
}

async function acquireLock(retry = true): Promise<boolean> {
  try {
    await prisma.siteSetting.create({ data: { key: LOCK_KEY, value: String(Date.now()) } });
    return true;
  } catch {
    const row = await prisma.siteSetting.findUnique({ where: { key: LOCK_KEY } });
    if (retry && row && Date.now() - Number(row.value) > LOCK_STALE_MS) {
      // Remove only the stale lock that was read, never one taken since.
      const removed = await prisma.siteSetting.deleteMany({ where: { key: LOCK_KEY, value: row.value } });
      if (removed.count === 1) return acquireLock(false);
    }
    return false;
  }
}

async function releaseLock(): Promise<void> {
  await prisma.siteSetting.deleteMany({ where: { key: LOCK_KEY } }).catch(() => undefined);
}

// ─── Preparing a post ───────────────────────────────────────────────────────

export interface PreparedPost {
  source: AutopilotSource;
  format: PostFormat;
  /** What it was about, for the history (and the next "do not repeat"). */
  key: string;
  /** What it was about, for people. */
  label: string;
  text: string;
  /** Which AI model wrote it. */
  writer: string;
  link?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
  image?: { jpeg: Buffer; alt: string };
  /** Why there is no image, when one was wanted. */
  imageNote?: string;
}

interface Plan {
  brief: PostBrief;
  key: (topic: string) => string;
  label: (topic: string) => string;
  link?: Pick<PreparedPost, "link" | "linkTitle" | "linkDescription" | "linkImage">;
}

async function planFor(source: AutopilotSource, format: PostFormat, state: AutopilotState): Promise<Plan | null> {
  if (source === "ARTICLE") {
    const articles = await prisma.blog.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { slug: true, title: true, excerpt: true, image: true },
    });
    const article = pickArticle(articles, state.history);
    if (!article) return null;
    return {
      brief: {
        source,
        format,
        subject: article.title,
        background: article.excerpt ?? undefined,
        instruction: "It promotes the blog article below: share its most useful idea so the reader wants the full article.",
        hasLink: true,
      },
      key: () => article.slug,
      label: () => `Article: ${article.title}`,
      link: {
        link: `${SITE_URL}/blog/${article.slug}`,
        linkTitle: article.title,
        linkDescription: article.excerpt ?? undefined,
        linkImage: article.image ?? undefined,
      },
    };
  }

  if (source === "SERVICE") {
    const picked = pickService(services, state.history);
    if (!picked) return null;
    const { service, angle } = picked;
    return {
      brief: {
        source,
        format,
        subject: `${service.title}: ${angle}`,
        // The description and features only: the service pages' benefit
        // figures are not something an automatic post should repeat as fact.
        background: `${service.desc} It covers: ${service.features.join(", ")}.`,
        instruction:
          "It is about the service below, from the angle given. Teach something useful first; only the line before the closing question may mention that BITSOL Marketing offers this service.",
        hasLink: true,
      },
      key: () => `${service.slug}:${angle}`,
      label: () => `Service: ${service.title}`,
      link: { link: `${SITE_URL}/services/${service.slug}`, linkTitle: service.metaTitle, linkDescription: service.metaDescription },
    };
  }

  const theme = pickTipTheme(state.history);
  return {
    brief: {
      source,
      format,
      subject: `one practical tip about ${theme} for small and medium businesses`,
      instruction: "Teach one practical tip, fresh and specific, that a business owner can apply this week.",
      avoid: recentTips(state.history),
      hasLink: false,
    },
    key: (topic) => `${theme}:${topic}`,
    label: (topic) => `Tip: ${topic || theme}`,
  };
}

/** Writes the next post and draws its image. Publishes nothing and changes no state. */
export async function prepareAutopost(settings: AutopilotSettings, state: AutopilotState, config: SocialConfig): Promise<PreparedPost> {
  const format = pickFormat(state.history);
  const first = pickSource(settings.sources, state.turn);
  // A kind of subject with nothing to offer (no articles yet) hands over to the next; a tip always works.
  const order = [first, ...settings.sources.filter((s) => s !== first), "TIP" as const];

  let plan: Plan | null = null;
  for (const source of order) {
    plan = await planFor(source, format, state);
    if (plan) break;
  }
  if (!plan) throw new Error("Nothing to write about.");
  const { brief } = plan;

  const { text, source: writer } = await writeText(
    buildAutopilotPrompt(brief),
    config,
    (answer) => {
      const read = readAutopilotAnswer(answer, brief.source);
      return read.ok ? null : read.problem;
    },
    { cloudflareModels: CLOUDFLARE_WRITER_MODELS, timeoutMs: WRITER_TIMEOUT }
  );
  const answer = readAutopilotAnswer(text, brief.source);
  if (!answer.ok) throw new Error(`The AI's post was unusable: ${answer.problem}`);

  const prepared: PreparedPost = {
    source: brief.source,
    format,
    key: plan.key(answer.topic),
    label: plan.label(answer.topic),
    text: answer.post,
    writer,
    ...plan.link,
  };

  if (settings.withImage) {
    const credentials = cloudflareCredentials(config);
    if (!credentials) {
      prepared.imageNote = "no Cloudflare token is set";
    } else {
      try {
        let description: string;
        try {
          description = await describePicture({ subject: brief.subject, text: answer.post }, config);
        } catch {
          description = `A business owner in a bright modern office working on ${brief.subject}`;
        }
        const jpeg = await toPostJpeg(await drawImage(credentials, buildImagePrompt(description)));
        prepared.image = { jpeg, alt: description };
      } catch (err) {
        // The post is still worth publishing; the reason is shown on the Social page.
        prepared.imageNote = `it could not be made: ${err instanceof Error ? err.message : err}`;
      }
    }
  }
  return prepared;
}

// ─── Running ────────────────────────────────────────────────────────────────

export interface AutopilotRun {
  ok: boolean;
  /** Nothing was attempted: not due, or another pass holds the lock. */
  skipped?: boolean;
  message: string;
  outcomes?: PublishOutcome[];
}

async function usableAccounts(now: Date) {
  const accounts = await prisma.socialAccount.findMany({
    select: { id: true, name: true, platform: true, expiresAt: true },
    orderBy: [{ platform: "asc" }, { name: "asc" }],
  });
  const usable = accounts.filter((a) => !a.expiresAt || a.expiresAt > now);
  const reason =
    accounts.length === 0
      ? "No LinkedIn or Facebook account is connected, so nothing was posted."
      : "Every connected account has expired. Reconnect on the Social page.";
  return { usable, reason };
}

/**
 * Makes and publishes one post. "schedule" only acts when a post is due and
 * the autopilot is on; "manual" ("Post one now") always does.
 */
export async function runAutopilot(trigger: "schedule" | "manual"): Promise<AutopilotRun> {
  if (!(await acquireLock())) return { ok: false, skipped: true, message: "Another post is being made right now. Try again in a minute." };

  try {
    const { settings, state } = await getAutopilot();
    const now = new Date();
    if (trigger === "schedule" && !isDue(settings, state, now)) return { ok: true, skipped: true, message: "Not due." };

    // Claim the slot before the slow part, so a crash halfway cannot post it twice.
    const claimed: AutopilotState = { ...state, nextRunAt: nextRunAfter(now, settings.intervalHours).toISOString() };
    await upsertJson(STATE_KEY, claimed);

    const finish = async (result: { ok: boolean; message: string; failed: boolean; entry?: PreparedPost }, outcomes?: PublishOutcome[]) => {
      const failuresInARow = result.failed ? claimed.failuresInARow + 1 : result.ok ? 0 : claimed.failuresInARow;
      const pause = settings.enabled && failuresInARow >= FAILURES_BEFORE_PAUSE;
      const message = pause
        ? `Paused after ${failuresInARow} failed posts in a row. Fix the problem, then switch it on again. Last error: ${result.message}`
        : result.message;
      const next: AutopilotState = {
        ...claimed,
        lastRunAt: now.toISOString(),
        lastResult: { at: now.toISOString(), ok: result.ok, message: message.slice(0, 1000) },
        failuresInARow,
        turn: result.entry || result.failed ? claimed.turn + 1 : claimed.turn,
        history: result.entry
          ? remember(claimed.history, { source: result.entry.source, key: result.entry.key, format: result.entry.format, at: now.toISOString() })
          : claimed.history,
      };
      await prisma.$transaction([
        upsertJson(STATE_KEY, next),
        ...(pause ? [upsertJson(SETTINGS_KEY, { ...settings, enabled: false })] : []),
      ]);
      void logActivity({
        actor: AUTOPILOT_ACTOR,
        action: pause ? "social.autopilot_paused" : result.ok ? "social.autopilot_published" : "social.autopilot_failed",
        entity: "social",
        detail: message.slice(0, 500),
      });
      return { ok: result.ok, message, outcomes };
    };

    const { usable, reason } = await usableAccounts(now);
    if (usable.length === 0) return finish({ ok: false, message: reason, failed: false });

    let prepared: PreparedPost;
    try {
      prepared = await prepareAutopost(settings, claimed, await getSocialConfig());
    } catch (err) {
      return finish({ ok: false, failed: true, message: err instanceof Error ? err.message : "The post could not be written." });
    }

    const post: PostInput = {
      text: prepared.text,
      link: prepared.link,
      linkTitle: prepared.linkTitle,
      linkDescription: prepared.linkDescription,
      linkImage: prepared.linkImage,
      image: prepared.image,
    };
    const outcomes: PublishOutcome[] = [];
    for (const account of usable) {
      outcomes.push(await publishToAccount(account.id, post, AUTOPILOT_ACTOR));
    }

    const published = outcomes.filter((o) => o.ok);
    const failed = outcomes.filter((o) => !o.ok);
    const where = (list: PublishOutcome[]) => list.map((o) => `${PLATFORM_LABEL[o.platform]} (${o.accountName})`).join(", ");
    if (published.length === 0) {
      return finish({ ok: false, failed: true, message: failed.map((o) => `${where([o])}: ${o.error}`).join(" · ") }, outcomes);
    }
    const message = [
      `Posted “${prepared.label}” to ${where(published)}`,
      prepared.imageNote ? `, without an image (${prepared.imageNote})` : "",
      failed.length > 0 ? `. Failed on ${failed.map((o) => `${where([o])}: ${o.error}`).join(" · ")}` : "",
      ".",
    ].join("");
    return finish({ ok: true, failed: false, message, entry: prepared }, outcomes);
  } finally {
    await releaseLock();
  }
}

/** Called from the automation scheduler's pass: posts when one is due. Returns what happened, or null. */
export async function runSocialAutopilotIfDue(): Promise<string | null> {
  const { settings, state } = await getAutopilot();
  if (!isDue(settings, state, new Date())) return null;
  const run = await runAutopilot("schedule");
  return run.skipped ? null : run.message;
}

export { SOURCE_LABEL };
