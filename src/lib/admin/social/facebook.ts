import type { SocialConfig } from "./config";
import { providerError, textWithLink, type ConnectedAccount, type PostInput, type PostResult } from "./platforms";

/**
 * Facebook: OAuth for the Pages the signing-in person manages, and publishing
 * to a Page's feed through the Graph API.
 *
 * The flow trades the short-lived user token for a long-lived one, then reads
 * the Page tokens it grants. Page tokens obtained that way do not expire, so
 * a Page stays connected until it is disconnected here or the person removes
 * the app or changes their Facebook password.
 */

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v26.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const SCOPES = "pages_show_list,pages_manage_posts,pages_read_engagement";
const REQUEST_TIMEOUT = 30_000;

export function facebookAuthUrl(config: SocialConfig, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: config.FACEBOOK_APP_ID,
    redirect_uri: redirectUri,
    state,
    scope: process.env.FACEBOOK_SCOPES || SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params}`;
}

async function graph<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T> {
  const query = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${GRAPH}${path}?${query}` : `${GRAPH}${path}`, {
    method,
    ...(method === "POST" && { body: query }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(providerError(res.status, body));
  return body as T;
}

export async function connectFacebook(config: SocialConfig, code: string, redirectUri: string): Promise<ConnectedAccount[]> {
  const app = {
    client_id: config.FACEBOOK_APP_ID,
    client_secret: config.FACEBOOK_APP_SECRET,
  };

  let userToken: string;
  try {
    const short = await graph<{ access_token: string }>("/oauth/access_token", { ...app, redirect_uri: redirectUri, code });
    const long = await graph<{ access_token: string }>("/oauth/access_token", {
      ...app,
      grant_type: "fb_exchange_token",
      fb_exchange_token: short.access_token,
    });
    userToken = long.access_token;
  } catch (err) {
    throw new Error(`Facebook did not issue a token: ${err instanceof Error ? err.message : err}`);
  }

  const pages = await graph<{ data?: { id: string; name: string; access_token?: string }[] }>("/me/accounts", {
    fields: "id,name,access_token",
    limit: "100",
    access_token: userToken,
  });

  const only = process.env.FACEBOOK_PAGE_ID;
  const accounts = (pages.data ?? [])
    .filter((page) => page.access_token && (!only || page.id === only))
    .map((page) => ({
      platform: "FACEBOOK" as const,
      externalId: page.id,
      name: page.name,
      accessToken: page.access_token as string,
      expiresAt: null,
    }));

  if (accounts.length === 0) {
    throw new Error(
      only
        ? `Facebook did not grant access to Page ${only}. Select that Page when Facebook asks which Pages to allow.`
        : "Facebook granted access to no Pages. Select at least one Page when Facebook asks which Pages to allow."
    );
  }
  return accounts;
}

/**
 * Posts a photo with the text as its caption. The image is uploaded with the
 * request rather than fetched by Facebook from a URL, so it works from a
 * development machine too.
 */
async function postPhoto(token: string, pageId: string, post: PostInput & { image: NonNullable<PostInput["image"]> }) {
  const form = new FormData();
  form.set("message", textWithLink(post));
  form.set("access_token", token);
  form.set("source", new Blob([new Uint8Array(post.image.jpeg)], { type: "image/jpeg" }), "post.jpg");
  const res = await fetch(`${GRAPH}/${encodeURIComponent(pageId)}/photos`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  const body = (await res.json().catch(() => null)) as { id?: string; post_id?: string } | null;
  if (!res.ok || !body?.id) throw new Error(providerError(res.status, body));
  // post_id is the feed post the photo appears in; id is the photo itself.
  return { id: body.post_id || body.id };
}

export async function postToFacebook(token: string, pageId: string, post: PostInput): Promise<PostResult> {
  let result: { id: string };
  try {
    result = post.image
      ? await postPhoto(token, pageId, { ...post, image: post.image })
      : await graph<{ id: string }>(
          `/${encodeURIComponent(pageId)}/feed`,
          { message: post.text, ...(post.link && { link: post.link }), access_token: token },
          "POST"
        );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      /HTTP 401|OAuthException|access token/i.test(message)
        ? `Facebook rejected the access token (${message}). Reconnect the account.`
        : `Facebook refused the post: ${message}`
    );
  }
  return { externalId: result.id, permalink: `https://www.facebook.com/${result.id}` };
}
