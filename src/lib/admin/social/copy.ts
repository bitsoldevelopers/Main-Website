import { CLOUDFLARE_TEXT_MODELS, chatCompletionsUrl, cloudflareCredentials } from "./cloudflare";

/**
 * Writes the short paragraph for a social post, and the description of the
 * picture that goes with it. This is all the AI is used for: articles are not
 * written by AI (owner's decision, 29 Sep 2026).
 *
 * Cloudflare Workers AI comes first: the owner asked for it (19 Nov 2026), and
 * the same token draws the image. Gemini, Groq and OpenRouter follow on their
 * free tiers. A refused request still counts against a free model's daily
 * allowance, so each model is tried once, in order, with no retries.
 */

const TARGET_WORDS = 100;
const REQUEST_TIMEOUT = 25_000;

/** Keys entered in the admin panel, by environment variable name. They win over the environment. */
export type CopyKeys = Partial<Record<string, string>>;

interface Provider {
  name: string;
  models: string[];
  /** Where to send the request and with which key, or null when this provider has not been set up. */
  endpoint(keys: CopyKeys): { url: string; key: string } | null;
}

function keyed(keyEnv: string, url: string) {
  return (keys: CopyKeys) => {
    const key = keys[keyEnv] || process.env[keyEnv] || "";
    return key ? { url, key } : null;
  };
}

const PROVIDERS: Provider[] = [
  {
    name: "Cloudflare",
    models: CLOUDFLARE_TEXT_MODELS,
    endpoint(keys) {
      const credentials = cloudflareCredentials(keys);
      return credentials ? { url: chatCompletionsUrl(credentials.accountId), key: credentials.token } : null;
    },
  },
  {
    name: "Gemini",
    models: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-flash-latest"],
    endpoint: keyed("GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"),
  },
  {
    name: "Groq",
    models: ["llama-3.3-70b-versatile"],
    endpoint: keyed("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions"),
  },
  {
    name: "OpenRouter",
    models: ["openrouter/free"],
    endpoint: keyed("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1/chat/completions"),
  },
];

export function isCopyWriterConfigured(keys: CopyKeys = {}): boolean {
  return PROVIDERS.some((p) => p.endpoint(keys));
}

export interface CopyRequest {
  /** "LinkedIn", "Facebook", or both joined for a post that goes to each. */
  audience: string;
  /** What the post is about: an article title or the admin's own topic. */
  subject: string;
  /** Extra material to draw on, e.g. the article's excerpt. */
  details?: string;
}

export function buildPrompt({ audience, subject, details }: CopyRequest): string {
  return `You write social media posts for BITSOL Marketing, a digital marketing and AI automation agency in Pakistan (bitsolmarketing.com).

Write one ${audience} post about the subject below.

Rules:
- One paragraph of ${TARGET_WORDS - 10} to ${TARGET_WORDS + 10} words
- Plain text only: no markdown, no bullet points, no emojis in the paragraph
- The first sentence must make a business owner want to read the rest
- Practical and specific to the subject
- Do not invent statistics, client names, results or quotes
- Do not include a link: it is attached to the post separately
- After the paragraph leave one blank line, then 3 to 5 relevant hashtags on a single line
- Reply with the post only, nothing before or after it

Subject: ${subject}${details ? `\nBackground: ${details}` : ""}`;
}

/** Removes the wrapping models add around an answer that should be plain text. */
export function cleanCopy(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^["“]([\s\S]*)["”]$/, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Words in the paragraph, not counting the hashtag line. */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((word) => word && !word.startsWith("#")).length;
}

/** "@cf/meta/llama-3.3-70b-instruct-fp8-fast" reads better as "llama-3.3-70b-instruct-fp8-fast". */
function modelLabel(model: string): string {
  return model.replace(/^@cf\/[^/]+\//, "");
}

/**
 * Sends the prompt to each configured model in turn and returns the first
 * answer that `accept` takes (it returns why an answer is unusable, or null).
 */
async function complete(
  prompt: string,
  keys: CopyKeys,
  accept: (text: string) => string | null
): Promise<{ text: string; source: string }> {
  const failures: string[] = [];

  for (const provider of PROVIDERS) {
    const endpoint = provider.endpoint(keys);
    if (!endpoint) continue;

    for (const model of provider.models) {
      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.key}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 1024 }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = cleanCopy(data.choices?.[0]?.message?.content ?? "");
        const problem = accept(text);
        if (problem) throw new Error(problem);
        return { text, source: `${provider.name} (${modelLabel(model)})` };
      } catch (err) {
        failures.push(`${provider.name} ${modelLabel(model)}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  throw new Error(
    failures.length === 0
      ? "No AI key has been entered. An admin can add one under AI writer on this page."
      : `The AI writer is unavailable right now (${failures.join("; ")}). Try again in a minute, or write it yourself.`
  );
}

export function writeSocialCopy(request: CopyRequest, keys: CopyKeys = {}): Promise<{ text: string; source: string }> {
  return complete(buildPrompt(request), keys, (text) => (countWords(text) < 30 ? "answer too short" : null));
}

// ─── The picture ────────────────────────────────────────────────────────────

const MAX_PICTURE_WORDS = 70;

export interface PictureRequest {
  subject: string;
  /** The post as written so far, if any. */
  text?: string;
  details?: string;
}

export function buildPicturePrompt({ subject, text, details }: PictureRequest): string {
  return `Describe one photograph to go with a LinkedIn post by BITSOL Marketing, a digital marketing and AI automation agency in Pakistan.

Rules:
- One or two sentences, at most 60 words
- A concrete scene a camera could take: who is in it, where, what they are doing, the light
- Show the idea of the post through people and objects, not through words
- Nothing written anywhere in the picture: no text, letters, numbers, signs, logos, brand names or readable screens
- Reply with the description only

Subject: ${subject}${details ? `\nBackground: ${details}` : ""}${text ? `\nThe post: ${text.slice(0, 1500)}` : ""}`;
}

/** A scene description for the image model, written from the post. */
export async function describePicture(request: PictureRequest, keys: CopyKeys = {}): Promise<string> {
  const { text } = await complete(buildPicturePrompt(request), keys, (answer) => {
    const words = countWords(answer);
    if (words < 6) return "answer too short";
    if (words > MAX_PICTURE_WORDS * 2) return "answer too long";
    return null;
  });
  return text.replace(/\s+/g, " ");
}
