import { prisma } from "@/lib/prisma";
import { safe, type Result } from "../queries";
import { decryptSecret, encryptSecret } from "./crypto";
import { postToFacebook } from "./facebook";
import { postToLinkedIn } from "./linkedin";
import type { ConnectedAccount, PostInput, PostResult, SocialPlatform } from "./platforms";

/** Database side of Admin → Social. Access tokens never leave this file decrypted. */

const DAY = 24 * 60 * 60 * 1000;

/** An account without its token: safe to pass to a page or a client component. */
export interface SocialAccountView {
  id: string;
  platform: SocialPlatform;
  externalId: string;
  name: string;
  expiresAt: Date | null;
  /** Whole days until the connection expires; negative once it has, null when it never does. */
  daysLeft: number | null;
  connectedBy: string;
  updatedAt: Date;
}

const viewFields = {
  id: true,
  platform: true,
  externalId: true,
  name: true,
  expiresAt: true,
  connectedBy: true,
  updatedAt: true,
} as const;

export function listSocialAccounts(): Promise<Result<SocialAccountView[]>> {
  return safe(async () => {
    const rows = await prisma.socialAccount.findMany({ select: viewFields, orderBy: [{ platform: "asc" }, { name: "asc" }] });
    const now = Date.now();
    return rows.map((row) => ({
      ...row,
      platform: row.platform as SocialPlatform,
      daysLeft: row.expiresAt ? Math.floor((row.expiresAt.getTime() - now) / DAY) : null,
    }));
  });
}

export function listSocialPosts(take = 25) {
  return safe(() => prisma.socialPost.findMany({ orderBy: { createdAt: "desc" }, take }));
}

export interface ArticleOption {
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
}

/** Recent published articles, offered as subjects for a post. */
export function listArticleOptions(take = 40): Promise<Result<ArticleOption[]>> {
  return safe(() =>
    prisma.blog.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take,
      select: { slug: true, title: true, excerpt: true, image: true },
    })
  );
}

/** Stores freshly connected accounts, replacing the token of any that were connected before. */
export async function saveConnectedAccounts(accounts: ConnectedAccount[], connectedBy: string): Promise<void> {
  for (const account of accounts) {
    const data = {
      name: account.name.slice(0, 191),
      accessToken: encryptSecret(account.accessToken),
      expiresAt: account.expiresAt,
      connectedBy: connectedBy.slice(0, 191),
    };
    await prisma.socialAccount.upsert({
      where: { platform_externalId: { platform: account.platform, externalId: account.externalId } },
      update: data,
      create: { platform: account.platform, externalId: account.externalId, ...data },
    });
  }
}

export interface PublishOutcome {
  accountId: string;
  accountName: string;
  platform: SocialPlatform;
  ok: boolean;
  permalink?: string;
  error?: string;
}

/** Publishes to one account and records the attempt, successful or not. */
export async function publishToAccount(accountId: string, post: PostInput, createdBy: string): Promise<PublishOutcome> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) {
    return { accountId, accountName: "Unknown account", platform: "LINKEDIN", ok: false, error: "This account is no longer connected." };
  }
  const platform = account.platform as SocialPlatform;

  let result: PostResult | null = null;
  let error: string | null = null;
  try {
    if (account.expiresAt && account.expiresAt.getTime() < Date.now()) {
      throw new Error("The connection has expired. Reconnect the account.");
    }
    const token = decryptSecret(account.accessToken);
    result =
      platform === "FACEBOOK"
        ? await postToFacebook(token, account.externalId, post)
        : await postToLinkedIn(token, account.externalId, post);
  } catch (err) {
    error = err instanceof Error ? err.message : "The post could not be published";
    if (/unable to authenticate|unsupported state/i.test(error)) {
      error = "The stored connection can no longer be read (ADMIN_SECRET changed). Reconnect the account.";
    }
  }

  await prisma.socialPost
    .create({
      data: {
        accountId: account.id,
        platform,
        accountName: account.name,
        text: post.text,
        link: post.link ?? null,
        status: result ? "PUBLISHED" : "FAILED",
        externalId: result?.externalId || null,
        permalink: result?.permalink || null,
        error,
        createdBy: createdBy.slice(0, 191),
      },
    })
    .catch((err) => console.warn("[admin] could not record social post:", err instanceof Error ? err.message : err));

  return {
    accountId: account.id,
    accountName: account.name,
    platform,
    ok: Boolean(result),
    permalink: result?.permalink || undefined,
    error: error ?? undefined,
  };
}
