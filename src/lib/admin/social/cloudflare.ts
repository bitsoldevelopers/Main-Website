/**
 * Cloudflare Workers AI for Admin → Social: writes the post text (through the
 * OpenAI-compatible endpoint, see copy.ts) and draws the post image.
 *
 * It runs on the account's free daily allowance of 10,000 neurons, reset at
 * 00:00 UTC. A 100-word draft costs roughly 50 neurons and a FLUX.1 [schnell]
 * image roughly 100, so the allowance covers dozens of posts a day.
 *
 * The API token needs Account → Workers AI → Edit (which includes Read) on
 * the account. Without it Cloudflare answers every call with code 10000,
 * "Authentication error". Even with it, GET /accounts lists nothing (that
 * needs Account Settings), so the Account ID has to be entered.
 */

const API = "https://api.cloudflare.com/client/v4";
const CHECK_TIMEOUT = 20_000;
const IMAGE_TIMEOUT = 90_000;

export interface TextModel {
  id: string;
  maxTokens?: number;
  /** Extra request fields this model understands. */
  extra?: Record<string, unknown>;
}

/**
 * For the "Write with AI" button, where speed matters: Llama 3.3 answers in
 * 2-4 s. The second is a different model in case the first is busy.
 */
export const CLOUDFLARE_TEXT_MODELS: TextModel[] = [
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct" },
];

/**
 * For the autopilot, which publishes unreviewed, so quality comes first.
 * Compared on 19 Nov 2026: GPT-OSS 120B wrote clearly the most specific,
 * natural posts; with reasoning_effort "low" it took 9-12 s and ~30-40
 * neurons. At the default effort it took 30-60 s and once spent the whole
 * token budget thinking and returned no text, which is why the budget is
 * large and the Llama models follow.
 */
export const CLOUDFLARE_WRITER_MODELS: TextModel[] = [
  { id: "@cf/openai/gpt-oss-120b", maxTokens: 4096, extra: { reasoning_effort: "low" } },
  ...CLOUDFLARE_TEXT_MODELS,
];
export const CLOUDFLARE_IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
/** The most FLUX.1 [schnell] allows; better detail than the default 4 for about 40 more neurons. */
const IMAGE_STEPS = 8;
const MAX_IMAGE_PROMPT = 2048;

export const WORKERS_AI_PERMISSION = "Account → Workers AI → Edit";

export interface CloudflareCredentials {
  token: string;
  accountId: string;
}

/** The token and account from the panel, or the environment variables of the same names. */
export function cloudflareCredentials(keys: Partial<Record<string, string>>): CloudflareCredentials | null {
  const token = keys.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "";
  const accountId = keys.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "";
  return token && accountId ? { token, accountId } : null;
}

export function chatCompletionsUrl(accountId: string): string {
  return `${API}/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
}

export function isAccountId(value: string): boolean {
  return /^[0-9a-f]{32}$/i.test(value);
}

interface Envelope<T> {
  success?: boolean;
  result?: T;
  errors?: { code?: number; message?: string }[];
}

async function call<T>(path: string, token: string, init: RequestInit = {}, timeout = CHECK_TIMEOUT) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(timeout),
  });
  const body = (await res.json().catch(() => null)) as Envelope<T> | null;
  return { status: res.status, body };
}

/** Cloudflare's own explanation, in the owner's terms where the code is known. */
export function cloudflareProblem(status: number, body: Envelope<unknown> | null): string {
  const first = body?.errors?.[0];
  if (first?.code === 9106 || first?.code === 6003 || (status === 400 && /authentication failed/i.test(first?.message ?? ""))) {
    return "Cloudflare does not recognise this API token. Copy it again from Cloudflare → My Profile → API Tokens.";
  }
  if (first?.code === 10000 || status === 401 || status === 403) {
    return `Cloudflare accepted the token but not for Workers AI on this account. Check the Account ID, and that the token (Cloudflare → My Profile → API Tokens) has ${WORKERS_AI_PERMISSION} with this account under Account Resources.`;
  }
  if (status === 429 || first?.code === 3036) {
    return "Today's free Workers AI allowance is used up. It resets at 00:00 UTC (5 AM in Pakistan).";
  }
  return `Cloudflare answered HTTP ${status}${first?.message ? ` — ${first.message.slice(0, 200)}` : ""}.`;
}

/** Whether the token may run Workers AI on the account: what is wrong, or null when it may. */
export async function checkWorkersAi({ token, accountId }: CloudflareCredentials): Promise<string | null> {
  if (!isAccountId(accountId)) {
    return "The Account ID is 32 letters and digits: the part after dash.cloudflare.com/ in the address bar once you are signed in.";
  }
  // Listing models is free; it needs the same permission as running one.
  const { status, body } = await call(`/accounts/${accountId}/ai/models/search?per_page=1`, token);
  return status === 200 && body?.success ? null : cloudflareProblem(status, body);
}

/** Draws one square image with FLUX.1 [schnell]. Returns the JPEG it produces. */
export async function drawImage({ token, accountId }: CloudflareCredentials, prompt: string): Promise<Buffer> {
  const { status, body } = await call<{ image?: string }>(
    `/accounts/${encodeURIComponent(accountId)}/ai/run/${CLOUDFLARE_IMAGE_MODEL}`,
    token,
    { method: "POST", body: JSON.stringify({ prompt: prompt.slice(0, MAX_IMAGE_PROMPT), steps: IMAGE_STEPS }) },
    IMAGE_TIMEOUT
  );
  const base64 = body?.result?.image;
  if (status !== 200 || !base64) throw new Error(cloudflareProblem(status, body));
  return Buffer.from(base64, "base64");
}
