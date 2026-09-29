/**
 * Writes the short paragraph for a social post. This is the only thing the
 * AI key is used for: articles are not written by AI (owner's decision,
 * 29 Sep 2026).
 *
 * Runs on free tiers. The light Gemini models come first: a 100-word
 * paragraph does not need a bigger one, they answer in a few seconds, and the
 * bigger free models are often overloaded. A refused request still counts
 * against a model's daily allowance, so each model is tried once, in order,
 * with no retries.
 */

const TARGET_WORDS = 100;
const REQUEST_TIMEOUT = 25_000;

interface Provider {
  name: string;
  keyEnv: string;
  url: string;
  models: string[];
}

const PROVIDERS: Provider[] = [
  {
    name: "Gemini",
    keyEnv: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-flash-latest"],
  },
  {
    name: "Groq",
    keyEnv: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile"],
  },
  {
    name: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: ["openrouter/free"],
  },
];

export function isCopyWriterConfigured(): boolean {
  return PROVIDERS.some((p) => process.env[p.keyEnv]);
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

export async function writeSocialCopy(request: CopyRequest): Promise<{ text: string; source: string }> {
  const prompt = buildPrompt(request);
  const failures: string[] = [];

  for (const provider of PROVIDERS) {
    const key = process.env[provider.keyEnv];
    if (!key) continue;

    for (const model of provider.models) {
      try {
        const res = await fetch(provider.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 1024 }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = cleanCopy(data.choices?.[0]?.message?.content ?? "");
        if (countWords(text) < 30) throw new Error("answer too short");
        return { text, source: `${provider.name} (${model})` };
      } catch (err) {
        failures.push(`${provider.name} ${model}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  throw new Error(
    failures.length === 0
      ? "No AI key is set on the server. Add GEMINI_API_KEY to the environment variables."
      : `The AI writer is unavailable right now (${failures.join("; ")}). Try again in a minute, or write the post yourself.`
  );
}
