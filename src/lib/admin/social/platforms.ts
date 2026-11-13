import { SITE_URL } from "@/lib/seo";

/** The platforms Admin → Social can connect, and what each needs to be set up. */

export const SOCIAL_PLATFORMS = ["LINKEDIN", "FACEBOOK"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export function platformFromSlug(slug: string): SocialPlatform | null {
  const upper = slug.toUpperCase();
  return (SOCIAL_PLATFORMS as readonly string[]).includes(upper) ? (upper as SocialPlatform) : null;
}

export interface PlatformInfo {
  label: string;
  /** What gets connected, in the owner's words. */
  target: string;
  /** Where the app that owns those credentials is managed. */
  consoleUrl: string;
  consoleLabel: string;
  /** Where in that console the callback URL has to be added. */
  callbackSetting: string;
  /**
   * What the app needs in that console before connecting can work. These are
   * refused on the platform's own screen, where this site cannot explain them.
   */
  requirements: string[];
  /** The platform's wording when a requirement is missing, and what it means. */
  refusal: string;
}

export const PLATFORM_INFO: Record<SocialPlatform, PlatformInfo> = {
  LINKEDIN: {
    label: "LinkedIn",
    target: "company page",
    consoleUrl: "https://www.linkedin.com/developers/apps",
    consoleLabel: "LinkedIn Developers",
    callbackSetting: "your app → Auth → Authorized redirect URLs",
    requirements: [
      "Under Products, the app has Community Management API. It provides the permission to post as a page (w_organization_social).",
      "The person who connects is an admin of the company page.",
    ],
    refusal: "“Bummer, something went wrong” means the address above is not in the list, or the product is missing.",
  },
  FACEBOOK: {
    label: "Facebook",
    target: "Page",
    consoleUrl: "https://developers.facebook.com/apps",
    consoleLabel: "Meta for Developers",
    callbackSetting: "your app → Facebook Login → Settings → Valid OAuth Redirect URIs",
    requirements: [
      "Under Use cases, the app has “Manage everything on your Page”. Open it, choose Customize, and press Add next to each of: pages_show_list, pages_read_engagement, pages_manage_posts.",
      "The person who connects is an admin of the app and of the Page. Anyone else needs Meta's App Review first.",
    ],
    refusal: "“Invalid Scopes: …” names a permission from that list that has not been added to the app yet.",
  },
};

/**
 * The public origin OAuth callbacks come back to. Behind Hostinger's proxy
 * the request URL can carry an internal host, so production uses the known
 * site URL; development uses whatever the dev server is running on.
 */
export function siteOrigin(req: Request): string {
  return process.env.NODE_ENV === "production" ? SITE_URL : new URL(req.url).origin;
}

export function callbackUrl(origin: string, platform: SocialPlatform): string {
  return `${origin}/api/admin/social/${platform.toLowerCase()}/callback`;
}

/** An account as the connection flow hands it to the database layer. */
export interface ConnectedAccount {
  platform: SocialPlatform;
  externalId: string;
  name: string;
  accessToken: string;
  expiresAt: Date | null;
}

/** What a post needs, whatever the platform. */
export interface PostInput {
  text: string;
  /** Optional link shared with the post. */
  link?: string;
  /** Title, summary and image for the link card, known when the link is a blog article. */
  linkTitle?: string;
  linkDescription?: string;
  linkImage?: string;
}

export interface PostResult {
  externalId: string;
  permalink: string;
}

/** Error text from a provider response, without surrounding JSON. */
export function providerError(status: number, body: unknown): string {
  const data = body as Record<string, unknown> | null;
  const nested = data?.error as Record<string, unknown> | string | undefined;
  const message =
    (typeof nested === "object" && nested ? (nested.message as string | undefined) : undefined) ??
    (data?.error_description as string | undefined) ??
    (data?.message as string | undefined) ??
    (typeof nested === "string" ? nested : undefined);
  return `HTTP ${status}${message ? ` — ${String(message).replace(/\s+/g, " ").slice(0, 300)}` : ""}`;
}
