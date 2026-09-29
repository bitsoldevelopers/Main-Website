"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/seo";
import { rateLimit } from "@/lib/rate-limit";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { publishToAccount, type PublishOutcome } from "@/lib/admin/social/accounts";
import { countWords, writeSocialCopy } from "@/lib/admin/social/copy";
import { PLATFORM_INFO, type PostInput, type SocialPlatform } from "@/lib/admin/social/platforms";

/** Writes from Admin → Social: drafting a post, publishing it, disconnecting an account. */

// LinkedIn's limit for post text; Facebook allows far more.
const MAX_POST_CHARS = 3000;
const DRAFTS_PER_MINUTE = 6;

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
    const { text, source } = await writeSocialCopy({
      audience: labels.length > 0 ? labels.join(" and ") : "LinkedIn",
      subject: article ? article.title : topic,
      details: article ? [article.excerpt, topic].filter(Boolean).join(" ") : undefined,
    });
    return { ok: true, text, words: countWords(text), source };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "The draft could not be written" };
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
