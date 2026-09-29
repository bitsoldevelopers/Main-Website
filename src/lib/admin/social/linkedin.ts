import sharp from "sharp";
import { providerError, type ConnectedAccount, type PostInput, type PostResult } from "./platforms";

/**
 * LinkedIn: OAuth for the company page named by LINKEDIN_COMPANY_ID, and
 * publishing through the versioned Posts API (which replaced ugcPosts).
 *
 * Access tokens last about 60 days and LinkedIn issues refresh tokens only to
 * approved partners, so the account has to be reconnected when one expires.
 */

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API = "https://api.linkedin.com/rest";
const DEFAULT_SCOPES = "w_organization_social r_organization_social";
const REQUEST_TIMEOUT = 30_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function linkedInAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    state,
    scope: process.env.LINKEDIN_SCOPES || DEFAULT_SCOPES,
  });
  return `${AUTH_URL}?${params}`;
}

// ─── API versions ───────────────────────────────────────────────────────────

/**
 * Every call needs a `Linkedin-Version: YYYYMM` header, and each version is
 * retired after about a year. Rather than pin one that will expire, the last
 * few months are tried newest first (LinkedIn skips some months) and the one
 * that works is remembered for the life of the process.
 */
export function versionCandidates(now: Date = new Date()): string[] {
  if (process.env.LINKEDIN_API_VERSION) return [process.env.LINKEDIN_API_VERSION];
  const versions: string[] = [];
  // Start a month back: the current month's version is not always out yet.
  for (let back = 1; back <= 6; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    versions.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return versions;
}

let workingVersion: string | null = null;

function isVersionError(status: number, body: unknown): boolean {
  if (status === 426) return true;
  const code = (body as Record<string, unknown> | null)?.code;
  return status === 400 && typeof code === "string" && /VERSION/i.test(code);
}

async function api(token: string, path: string, init: { method: string; body?: unknown }): Promise<Response> {
  const versions = workingVersion ? [workingVersion] : versionCandidates();
  let last: Response | null = null;
  for (const version of versions) {
    const res = await fetch(`${API}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Linkedin-Version": version,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    if (res.ok || !isVersionError(res.status, await res.clone().json().catch(() => null))) {
      if (res.ok) workingVersion = version;
      return res;
    }
    last = res;
  }
  workingVersion = null;
  return last as Response;
}

// ─── Connecting ─────────────────────────────────────────────────────────────

async function organizationName(token: string, id: string): Promise<string> {
  try {
    const res = await api(token, `/organizations/${encodeURIComponent(id)}`, { method: "GET" });
    const body = (await res.json().catch(() => null)) as { localizedName?: string } | null;
    if (res.ok && body?.localizedName) return body.localizedName;
  } catch {
    // The name is cosmetic; the id is enough to post.
  }
  return `Company page ${id}`;
}

export async function connectLinkedIn(code: string, redirectUri: string): Promise<ConnectedAccount[]> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: process.env.LINKEDIN_CLIENT_ID ?? "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? "",
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
  });
  const body = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !body?.access_token) {
    throw new Error(`LinkedIn did not issue a token: ${providerError(res.status, body)}`);
  }

  const companyId = process.env.LINKEDIN_COMPANY_ID ?? "";
  return [
    {
      platform: "LINKEDIN",
      externalId: companyId,
      name: await organizationName(body.access_token, companyId),
      accessToken: body.access_token,
      expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000) : null,
    },
  ];
}

// ─── Publishing ─────────────────────────────────────────────────────────────

/**
 * Post text is "little text format": these characters are markup and have to
 * be escaped, or LinkedIn cuts the post off at the first one. A `#` that
 * starts a word stays as it is, which is how a hashtag is written.
 */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>*_~]|#(?![\p{L}\p{N}_])/gu, (char) => `\\${char}`);
}

/** Uploads the link's image as the card thumbnail. LinkedIn takes JPG, PNG and GIF only. */
async function uploadThumbnail(token: string, owner: string, imageUrl: string): Promise<string | null> {
  try {
    const download = await fetch(imageUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
    if (!download.ok) return null;
    const original = Buffer.from(await download.arrayBuffer());
    if (original.length === 0 || original.length > MAX_IMAGE_BYTES) return null;
    const jpeg = await sharp(original).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();

    const init = await api(token, "/images?action=initializeUpload", {
      method: "POST",
      body: { initializeUploadRequest: { owner } },
    });
    const body = (await init.json().catch(() => null)) as { value?: { uploadUrl?: string; image?: string } } | null;
    if (!init.ok || !body?.value?.uploadUrl || !body.value.image) return null;

    const upload = await fetch(body.value.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
      body: new Uint8Array(jpeg),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    });
    return upload.ok ? body.value.image : null;
  } catch {
    // A post without a thumbnail is better than no post.
    return null;
  }
}

export async function postToLinkedIn(token: string, organizationId: string, post: PostInput): Promise<PostResult> {
  const author = `urn:li:organization:${organizationId}`;

  // A link card needs a title. Without one the link goes into the text.
  const asCard = Boolean(post.link && post.linkTitle);
  const text = post.link && !asCard ? `${post.text}\n\n${post.link}` : post.text;
  const thumbnail = asCard && post.linkImage ? await uploadThumbnail(token, author, post.linkImage) : null;

  const res = await api(token, "/posts", {
    method: "POST",
    body: {
      author,
      commentary: escapeLittleText(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(asCard && {
        content: {
          article: {
            source: post.link,
            title: post.linkTitle,
            ...(post.linkDescription && { description: post.linkDescription.slice(0, 250) }),
            ...(thumbnail && { thumbnail }),
          },
        },
      }),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    },
  });

  if (res.status !== 201) {
    const body = await res.json().catch(() => null);
    throw new Error(
      res.status === 401
        ? "LinkedIn rejected the access token. Reconnect the account."
        : `LinkedIn refused the post: ${providerError(res.status, body)}`
    );
  }
  const urn = res.headers.get("x-restli-id") ?? "";
  return { externalId: urn, permalink: urn ? `https://www.linkedin.com/feed/update/${urn}/` : "" };
}
