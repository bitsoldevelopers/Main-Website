"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { rateLimit } from "@/lib/rate-limit";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { publishToAccount, type PublishOutcome } from "@/lib/admin/social/accounts";
import {
  SETUP_FIELDS,
  getSocialConfig,
  isSetupGroup,
  missingSetup,
  readSetupInput,
  saveSocialConfig,
  verifySetup,
  type SocialConfig,
} from "@/lib/admin/social/config";
import { cloudflareCredentials, drawImage } from "@/lib/admin/social/cloudflare";
import { countWords, describePicture, writeSocialCopy } from "@/lib/admin/social/copy";
import { buildImagePrompt, jpegFromDataUrl, toDataUrl, toPostJpeg } from "@/lib/admin/social/image";
import { PLATFORM_INFO, type PostInput, type SocialPlatform } from "@/lib/admin/social/platforms";
import { getAutopilot, prepareAutopost, runAutopilot, saveAutopilotSettings } from "@/lib/admin/social/autopilot";
import { SOURCE_LABEL, parseSettings } from "@/lib/admin/social/autopilot-plan";

/** Writes from Admin → Social: app details, drafting a post and its image, publishing it, the autopilot, disconnecting an account. */

// LinkedIn's limit for post text; Facebook allows far more.
const MAX_POST_CHARS = 3000;
const DRAFTS_PER_MINUTE = 6;
const IMAGES_PER_MINUTE = 4;
const MAX_IDEA_CHARS = 500;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function articleFor(slug: string) {
  if (!slug) return null;
  return prisma.blog.findFirst({
    where: { slug, published: true },
    select: { slug: true, title: true, excerpt: true, image: true },
  });
}

// ─── App details ────────────────────────────────────────────────────────────

export type SetupState = { ok: boolean; error?: string; message?: string } | null;

const SERVICE: Record<string, string> = { LINKEDIN: "LinkedIn", FACEBOOK: "Facebook", AI: "Google", CLOUDFLARE: "Cloudflare" };

/**
 * Saves the ids and secrets of one app. Fields left empty keep the value they
 * have, so a secret does not have to be typed again to change something else.
 */
export async function saveSocialSetup(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const session = await requireAdminAction("social.manage");

  const group = str(formData, "group");
  if (!isSetupGroup(group)) return { ok: false, error: "Unknown settings group." };

  let changed: Partial<SocialConfig>;
  try {
    const current = await getSocialConfig();
    const input = readSetupInput(group, (key) => str(formData, key), current);
    if ("error" in input) return { ok: false, error: input.error };
    changed = input.changed;

    const next = { ...current, ...changed };
    const missing = missingSetup(group, next);
    if (missing.length > 0) return { ok: false, error: `Still needed: ${missing.map((f) => f.label).join(", ")}.` };
    const problem = await verifySetup(group, next);
    if (problem) return { ok: false, error: problem };

    await saveSocialConfig(changed);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The details could not be saved" };
  }

  void logActivity({
    actor: actorLabel(session),
    action: "social.setup_saved",
    entity: "social",
    // Which fields changed, never their values.
    detail: `${SERVICE[group]}: ${SETUP_FIELDS[group].filter((f) => changed[f.key]).map((f) => f.label).join(", ")}`,
  });
  revalidatePath("/admin/social");
  return { ok: true, message: `Saved. ${SERVICE[group]} recognises these details.` };
}

// ─── Draft with AI ──────────────────────────────────────────────────────────

export type DraftResult = { ok: true; text: string; words: number; source: string } | { ok: false; error: string };

export async function draftSocialCopy(input: {
  articleSlug?: string;
  topic?: string;
  platforms?: SocialPlatform[];
}): Promise<DraftResult> {
  const session = await requireAdminAction("social.post");

  // Free AI tiers allow few requests a day; keep a stuck button from spending them.
  if (!rateLimit(`social-draft:${session.sub}`, DRAFTS_PER_MINUTE, 60_000)) {
    return { ok: false, error: "That is a lot of drafts in a minute. Wait a moment and try again." };
  }

  try {
    const article = await articleFor(input.articleSlug ?? "");
    const topic = (input.topic ?? "").trim().slice(0, 500);
    if (!article && !topic) return { ok: false, error: "Choose an article or type a topic first." };

    const labels = [...new Set(input.platforms ?? [])].map((p) => PLATFORM_INFO[p]?.label).filter(Boolean);
    const { text, source } = await writeSocialCopy(
      {
        audience: labels.length > 0 ? labels.join(" and ") : "LinkedIn",
        subject: article ? article.title : topic,
        details: article ? [article.excerpt, topic].filter(Boolean).join(" ") : undefined,
      },
      await getSocialConfig()
    );
    return { ok: true, text, words: countWords(text), source };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The draft could not be written" };
  }
}

// ─── Image ──────────────────────────────────────────────────────────────────

export type ImageResult = { ok: true; image: string; description: string } | { ok: false; error: string };

/**
 * Draws the post's picture with Cloudflare FLUX. The scene comes from the
 * admin's own idea when one is typed, otherwise the AI writes one from the
 * post. The image is returned for the preview and not stored anywhere.
 */
export async function generateSocialImage(input: {
  articleSlug?: string;
  topic?: string;
  text?: string;
  idea?: string;
}): Promise<ImageResult> {
  const session = await requireAdminAction("social.post");

  if (!rateLimit(`social-image:${session.sub}`, IMAGES_PER_MINUTE, 60_000)) {
    return { ok: false, error: "That is a lot of images in a minute. Wait a moment and try again." };
  }

  try {
    const config = await getSocialConfig();
    const credentials = cloudflareCredentials(config);
    if (!credentials) return { ok: false, error: "Images need the Cloudflare token. An admin can add it under AI writer on this page." };

    const idea = (input.idea ?? "").trim().slice(0, MAX_IDEA_CHARS);
    const text = (input.text ?? "").trim().slice(0, MAX_POST_CHARS);
    const article = await articleFor(input.articleSlug ?? "");
    const subject = article ? article.title : (input.topic ?? "").trim().slice(0, 500);
    if (!idea && !subject && !text) return { ok: false, error: "Choose an article, type a topic or describe the picture first." };

    let description = idea;
    if (!description) {
      try {
        description = await describePicture(
          { subject: subject || "the post below", text, details: article?.excerpt ?? undefined },
          config
        );
      } catch {
        // The picture can still be drawn from the subject alone.
        description = `A business owner in a bright modern office, thinking about ${subject || "growing their business"}`;
      }
    }

    const jpeg = await toPostJpeg(await drawImage(credentials, buildImagePrompt(description)));
    return { ok: true, image: toDataUrl(jpeg), description };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The image could not be made" };
  }
}

// ─── Publish ────────────────────────────────────────────────────────────────

export type PublishState = {
  ok: boolean;
  error?: string;
  outcomes?: PublishOutcome[];
} | null;

export async function publishSocialPost(_prev: PublishState, formData: FormData): Promise<PublishState> {
  const session = await requireAdminAction("social.post");

  const text = str(formData, "text");
  const accountIds = [...new Set(formData.getAll("accounts").filter((v): v is string => typeof v === "string" && v !== ""))];
  let link = str(formData, "link");

  if (!text) return { ok: false, error: "Write the post before publishing it." };
  if (text.length > MAX_POST_CHARS) {
    return { ok: false, error: `The post is ${text.length.toLocaleString()} characters; the limit is ${MAX_POST_CHARS.toLocaleString()}.` };
  }
  if (accountIds.length === 0) return { ok: false, error: "Choose at least one account to publish to." };
  if (link && !/^https?:\/\/[^\s]+$/i.test(link)) {
    return { ok: false, error: "The link must be a full address starting with https://" };
  }

  const post: PostInput = { text };

  const image = str(formData, "image");
  if (image) {
    try {
      post.image = { jpeg: await jpegFromDataUrl(image), alt: str(formData, "imageAlt").slice(0, 1000) || "Image for the post" };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "The attached image could not be read." };
    }
  }

  try {
    const article = await articleFor(str(formData, "articleSlug"));
    const articleUrl = article ? `${SITE_URL}/blog/${article.slug}` : "";
    if (article && !link) link = articleUrl;
    if (link) post.link = link;
    // The card details belong to the article; a different link gets a plain share.
    if (article && link === articleUrl) {
      post.linkTitle = article.title;
      post.linkDescription = article.excerpt ?? undefined;
      post.linkImage = article.image ?? undefined;
    }
  } catch {
    // Database trouble looking up the article: publish without the card details.
    if (link) post.link = link;
  }

  const actor = actorLabel(session);
  const outcomes: PublishOutcome[] = [];
  for (const accountId of accountIds) {
    try {
      outcomes.push(await publishToAccount(accountId, post, actor));
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "The post could not be published", outcomes };
    }
  }

  for (const outcome of outcomes) {
    void logActivity({
      actor,
      action: outcome.ok ? "social.published" : "social.publish_failed",
      entity: "social",
      entityId: outcome.accountId,
      detail: `${PLATFORM_INFO[outcome.platform].label} · ${outcome.accountName}${outcome.error ? ` · ${outcome.error}` : ""}`,
    });
  }
  revalidatePath("/admin/social");

  const failed = outcomes.filter((o) => !o.ok).length;
  return {
    ok: failed === 0,
    outcomes,
    ...(failed > 0 && {
      error: failed === outcomes.length ? "The post was not published." : "The post was published to some accounts only.",
    }),
  };
}

// ─── Autopilot ──────────────────────────────────────────────────────────────

export type AutopilotSaveState = { ok: boolean; error?: string; message?: string } | null;

export async function saveAutopilot(_prev: AutopilotSaveState, formData: FormData): Promise<AutopilotSaveState> {
  const session = await requireAdminAction("social.manage");

  const settings = parseSettings({
    enabled: formData.get("enabled") === "on",
    intervalHours: Number(str(formData, "intervalHours")),
    sources: formData.getAll("sources"),
    withImage: formData.get("withImage") === "on",
  });
  if (formData.getAll("sources").length === 0) return { ok: false, error: "Choose at least one kind of subject." };

  try {
    const { settings: before } = await getAutopilot();
    await saveAutopilotSettings(settings);
    void logActivity({
      actor: actorLabel(session),
      action: settings.enabled === before.enabled ? "social.autopilot_saved" : settings.enabled ? "social.autopilot_on" : "social.autopilot_off",
      entity: "social",
      detail: `${settings.enabled ? "On" : "Off"}, every ${settings.intervalHours} h, ${settings.sources.map((s) => SOURCE_LABEL[s]).join(" + ")}, ${settings.withImage ? "with" : "without"} image`,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The settings could not be saved" };
  }
  revalidatePath("/admin/social");
  return {
    ok: true,
    message: settings.enabled
      ? `Saved. The autopilot posts every ${settings.intervalHours} hour${settings.intervalHours === 1 ? "" : "s"}; the first one goes out within a minute or two.`
      : "Saved. The autopilot is off.",
  };
}

export type AutopilotPreview =
  | { ok: true; label: string; text: string; link?: string; image?: string; writer: string; imageNote?: string }
  | { ok: false; error: string };

/** Writes the kind of post the autopilot would publish next, and publishes nothing. */
export async function previewAutopost(): Promise<AutopilotPreview> {
  const session = await requireAdminAction("social.manage");
  if (!rateLimit(`social-autopilot-preview:${session.sub}`, IMAGES_PER_MINUTE, 60_000)) {
    return { ok: false, error: "That is a lot of previews in a minute. Wait a moment and try again." };
  }
  try {
    const { settings, state } = await getAutopilot();
    const prepared = await prepareAutopost(settings, state, await getSocialConfig());
    return {
      ok: true,
      label: prepared.label,
      text: prepared.text,
      link: prepared.link,
      image: prepared.image ? toDataUrl(prepared.image.jpeg) : undefined,
      writer: prepared.writer,
      imageNote: prepared.imageNote,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The preview could not be made" };
  }
}

export type AutopilotRunResult = { ok: boolean; message: string };

/** Makes and publishes one autopilot post now, whether or not the autopilot is on. */
export async function postAutopostNow(): Promise<AutopilotRunResult> {
  const session = await requireAdminAction("social.manage");
  if (!rateLimit(`social-autopilot-now:${session.sub}`, 2, 60_000)) {
    return { ok: false, message: "A post was just made. Wait a minute before the next one." };
  }
  try {
    const run = await runAutopilot("manual");
    revalidatePath("/admin/social");
    return { ok: run.ok, message: run.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "The post could not be made" };
  }
}

// ─── Disconnect ─────────────────────────────────────────────────────────────

export async function disconnectSocialAccount(formData: FormData) {
  const session = await requireAdminAction("social.manage");
  const id = str(formData, "id");
  const account = await prisma.socialAccount.delete({ where: { id }, select: { platform: true, name: true } });
  void logActivity({
    actor: actorLabel(session),
    action: "social.disconnected",
    entity: "social",
    entityId: id,
    detail: `${PLATFORM_INFO[account.platform as SocialPlatform]?.label ?? account.platform}: ${account.name}`,
  });
  revalidatePath("/admin/social");
}
