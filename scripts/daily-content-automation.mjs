/**
 * BITSOL Daily Content Automation
 * Runs daily at 8:00 PM PKT via Windows Task Scheduler.
 *
 * SWITCHED OFF. The owner decided on 29 Sep 2026 that AI does not write
 * articles for the site; the AI key is for short social posts only, which are
 * written and published from Admin → Social. The script exits without making
 * any AI request unless AI_ARTICLE_WRITING=on is set in .env.
 *
 * Pipeline, when switched on:
 *  1. Ask an AI model to pick 3 fresh trending topics (avoids already-published slugs)
 *  2. The model writes a full SEO HTML article + LinkedIn commentary per topic
 *  3. Generate a hero image for the article and upload it to the website
 *  4. Publish each article to https://bitsolmarketing.com/blog via REST API
 *  5. Post each article as a LinkedIn article card (thumbnail + commentary)
 *
 * Everything runs on free tiers. Providers are tried in the order listed in
 * TEXT_PROVIDERS / generateHeroImage and the first one that works is used, so
 * a provider that is down, rate limited or has no key in .env is skipped.
 * Text needs at least one free key in .env (see .env.example). Images need
 * none: without an image key the hero is a title card drawn locally.
 *
 * Flags:
 *   --dry-run    write articles and images to scripts/logs/dry-run/, publish nothing
 *   --count=N    number of articles (default 3)
 *
 * Logs are written to scripts/logs/daily-YYYY-MM-DD.log
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import "dotenv/config";

// ── Config ────────────────────────────────────────────────────────────────────
const BLOG_API_KEY = process.env.BLOG_API_KEY;
const BLOG_API_URL = "https://bitsolmarketing.com/api/blog";
const IMAGE_API_URL = "https://bitsolmarketing.com/api/blog-images";
const SITE_URL = "https://bitsolmarketing.com/blog";
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_COMPANY_ID = process.env.LINKEDIN_COMPANY_ID;

const AI_ARTICLE_WRITING = (process.env.AI_ARTICLE_WRITING ?? "").toLowerCase() === "on";
const DRY_RUN = process.argv.includes("--dry-run");
const countArg = process.argv.find((a) => a.startsWith("--count="));
const ARTICLES_PER_DAY = countArg ? Math.max(1, parseInt(countArg.split("=")[1], 10) || 3) : 3;

const HERO_WIDTH = 1200;
const HERO_HEIGHT = 630;
const MIN_ARTICLE_WORDS = 900;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "logs");
const DRY_RUN_DIR = path.join(LOG_DIR, "dry-run");
const TODAY = new Date().toISOString().slice(0, 10);
const LOG_FILE = path.join(LOG_DIR, `daily-${TODAY}.log`);

/** A model list from .env ("a,b,c") or the default. */
function modelList(envName, defaults) {
  const raw = process.env[envName];
  return raw ? raw.split(",").map((m) => m.trim()).filter(Boolean) : defaults;
}

// Free text providers, best writing quality first. All speak the OpenAI chat
// completions format. Model names change often on free tiers, so each provider
// lists several and the next is tried when one is gone or over its limit.
const TEXT_PROVIDERS = [
  {
    name: "Gemini",
    keyEnv: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    // Each model has its own daily allowance, so a longer list means more
    // headroom. gemini-flash-latest keeps working when numbered models retire.
    models: modelList("GEMINI_MODEL", [
      "gemini-3.8-flash",
      "gemini-3.7-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-flash-latest",
    ]),
    // Lighter models write shorter, plainer articles. They are used only
    // when every model above is still failing after the retries.
    lastResort: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest"],
    maxTokens: 12000,
  },
  {
    // Groq counts max_tokens against a small per-minute token limit on the
    // free tier, so the cap is lower here.
    name: "Groq",
    keyEnv: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: modelList("GROQ_MODEL", ["llama-3.3-70b-versatile", "openai/gpt-oss-120b"]),
    maxTokens: 6000,
  },
  {
    name: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: modelList("OPENROUTER_MODEL", [
      "nvidia/nemotron-3-super-120b-a12b:free",
      "google/gemma-4-31b-it:free",
      "openrouter/free",
    ]),
    maxTokens: 12000,
  },
];

// ── Logger ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wordCount(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");
  return text.split(/\s+/).filter(Boolean).length;
}

// ── Text generation ───────────────────────────────────────────────────────────
function availableTextProviders() {
  return TEXT_PROVIDERS.filter((p) => process.env[p.keyEnv]);
}

/** A failure that waiting can fix: the provider is busy, rate limited or unreachable. */
class TransientError extends Error {}

const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
// Waits before each further round when every model failed and some were only busy.
// One retry only: on free tiers a refused request still counts against the
// model's daily allowance, so every extra round spends it.
const RETRY_WAITS_MS = [60_000];

/** The provider's own error message, without the JSON around it. */
function errorMessage(body) {
  try {
    const parsed = JSON.parse(body);
    const error = (Array.isArray(parsed) ? parsed[0] : parsed)?.error;
    const message = typeof error === "string" ? error : error?.message;
    if (message) return String(message).replace(/\s+/g, " ").slice(0, 160);
  } catch {
    // not JSON — fall through to the raw text
  }
  return body.replace(/\s+/g, " ").slice(0, 160);
}

async function chatOnce(provider, model, prompt, maxTokens) {
  let res;
  try {
    res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env[provider.keyEnv]}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: Math.min(maxTokens, provider.maxTokens),
      }),
      signal: AbortSignal.timeout(150_000),
    });
  } catch (err) {
    throw new TransientError(`no response (${err.message})`);
  }

  if (!res.ok) {
    const message = `HTTP ${res.status} ${errorMessage(await res.text().catch(() => ""))}`;
    throw TRANSIENT_STATUS.has(res.status) ? new TransientError(message) : new Error(message);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new Error("empty response");
  if (choice.finish_reason === "length") throw new Error("response was cut off at the token limit");
  return text.trim();
}

/**
 * Runs the prompt on the first provider/model that returns text `parse`
 * accepts. `parse` throws when the text is unusable (bad JSON, article too
 * short), which moves on to the next model instead of publishing it.
 *
 * When every model fails and some were only busy, the busy ones are tried
 * again after a wait. Models that failed for good (retired, bad output) are
 * not, so the daily allowance is not spent on them twice.
 */
async function generate(prompt, maxTokens, parse) {
  const providers = availableTextProviders();
  const failures = [];
  const dead = new Set();
  let busy = false;

  // Returns the result, or null after recording why the model failed.
  async function tryModel(provider, model) {
    const id = `${provider.name} ${model}`;
    if (dead.has(id)) return null;
    try {
      const text = await chatOnce(provider, model, prompt, maxTokens);
      return { value: parse(text), source: `${provider.name} (${model})` };
    } catch (err) {
      if (err instanceof TransientError) busy = true;
      else dead.add(id);
      failures.push(`${id}: ${err.message}`);
      log(`    ${id} failed — ${err.message}`);
      return null;
    }
  }

  for (let round = 0; ; round++) {
    busy = false;
    for (const provider of providers) {
      for (const model of provider.models) {
        const result = await tryModel(provider, model);
        if (result) return result;
      }
    }
    if (!busy || round >= RETRY_WAITS_MS.length) break;
    log(`    Providers are busy — trying again in ${RETRY_WAITS_MS[round] / 1000}s`);
    await sleep(RETRY_WAITS_MS[round]);
  }

  for (const provider of providers) {
    for (const model of provider.lastResort ?? []) {
      const result = await tryModel(provider, model);
      if (result) return result;
    }
  }
  throw new Error(`every text provider failed — ${failures.slice(-4).join(" | ")}`);
}

// ── Preflight: verify credentials before doing any work ───────────────────────
async function verifyBlogApi() {
  const res = await fetch(`${BLOG_API_URL}?limit=1`, {
    headers: { "x-api-key": BLOG_API_KEY },
  });
  if (!res.ok) throw new Error(`Blog API check failed: HTTP ${res.status} — check BLOG_API_KEY in .env`);
}

// Returns true when the LinkedIn token is usable; logs the reason when not.
async function verifyLinkedInToken() {
  try {
    const params = new URLSearchParams({
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      token: LINKEDIN_TOKEN ?? "",
    });
    const res = await fetch("https://www.linkedin.com/oauth/v2/introspectToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.active) return true;
    log(
      `WARNING: LinkedIn token is ${body.status ?? "invalid"} — articles will still publish to the website, ` +
        "but LinkedIn posting is OFF. Fix: node scripts/linkedin-auth.mjs, then paste the new token into .env"
    );
    return false;
  } catch (err) {
    log(`WARNING: LinkedIn token check failed (${err.message}) — will attempt posting anyway.`);
    return true;
  }
}

// ── Fetch published slugs to avoid duplicates ─────────────────────────────────
async function getPublishedSlugs() {
  try {
    const res = await fetch(`${BLOG_API_URL}?limit=2000`, {
      headers: { "x-api-key": BLOG_API_KEY },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = Array.isArray(data) ? data : data.posts ?? data.data ?? [];
    return posts.map((p) => p.slug);
  } catch {
    return [];
  }
}

// ── Step 1: Generate topic ideas ──────────────────────────────────────────────
const NICHES = [
  "digital-marketing",
  "seo",
  "ecommerce",
  "social-media",
  "ai-automation",
  "web-dev",
  "entrepreneurship",
  "pakistan-business",
];

// More topics are requested than needed, so that dropping the ones already
// on the blog still leaves enough.
const SPARE_TOPICS = 3;
const RECENT_SLUGS_IN_PROMPT = 300;
const TOO_SIMILAR = 0.6;
const SLUG_FILLER = new Set([
  "the", "and", "for", "with", "your", "how", "why", "what", "guide", "best", "top",
  "tips", "complete", "ultimate", "pakistan", "pakistani", "business", "businesses",
]);

function slugWords(slug) {
  return new Set(slug.split("-").filter((w) => w.length > 2 && !/^\d+$/.test(w) && !SLUG_FILLER.has(w)));
}

/** Share of meaningful words two slugs have in common, 0 to 1. */
function slugSimilarity(a, b) {
  const wordsA = slugWords(a);
  const wordsB = slugWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return a === b ? 1 : 0;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared++;
  return shared / (wordsA.size + wordsB.size - shared);
}

function parseTopics(text, existingSlugs) {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("no JSON array in the topics response");
  const topics = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(topics) || topics.length === 0) throw new Error("topics response is empty");

  const fresh = [];
  for (const t of topics) {
    if (!t?.title || !t?.primaryKeyword) continue;
    const topic = {
      title: String(t.title).trim(),
      slug: slugify(String(t.slug || t.title)),
      primaryKeyword: String(t.primaryKeyword).trim(),
      tags: Array.isArray(t.tags) ? t.tags.map(String).slice(0, 6) : [],
      excerpt: String(t.excerpt || "").trim(),
      imagePrompt: String(t.imagePrompt || t.primaryKeyword).trim(),
      niche: NICHES.includes(t.niche) ? t.niche : "digital-marketing",
    };
    const taken = [...existingSlugs, ...fresh.map((f) => f.slug)];
    const clash = taken.find((slug) => slug === topic.slug || slugSimilarity(slug, topic.slug) >= TOO_SIMILAR);
    if (clash) {
      log(`    Dropped "${topic.title}" — too close to existing article ${clash}`);
      continue;
    }
    fresh.push(topic);
  }

  if (fresh.length === 0) throw new Error("every proposed topic is already on the blog");
  return fresh.slice(0, ARTICLES_PER_DAY);
}

async function generateTopics(existingSlugs) {
  log("Step 1 — Asking for trending topic ideas...");

  const prompt = `You are an SEO content strategist for BITSOL Marketing (https://bitsolmarketing.com), a Pakistani digital marketing agency offering:
- SEO, paid ads, social media marketing
- Web & app development
- AI automation and WhatsApp chatbots
- Content marketing and branding

Today is ${TODAY}. Pick exactly ${ARTICLES_PER_DAY + SPARE_TOPICS} trending blog article topics, best first, each on a different subject, that:
1. Are highly relevant to Pakistani businesses, entrepreneurs, or digital marketing in ${TODAY.slice(0, 4)}
2. Have strong Google search volume (think long-tail SEO keywords)
3. Would naturally promote or relate to BITSOL Marketing's services
4. Cover a subject that none of these existing articles covers, even under a different title: ${existingSlugs.slice(0, RECENT_SLUGS_IN_PROMPT).join(", ")}

Return ONLY valid JSON — an array of ${ARTICLES_PER_DAY + SPARE_TOPICS} objects, no extra text:
[
  {
    "title": "Full SEO article title here (under 60 characters)",
    "slug": "url-friendly-slug-here",
    "primaryKeyword": "main keyword",
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "excerpt": "2-sentence meta description / excerpt (150-160 chars)",
    "imagePrompt": "One sentence describing a realistic photo that illustrates the article: the people, objects and setting. No text or logos in the image.",
    "niche": "one of: ${NICHES.join(" | ")}"
  }
]`;

  return generate(prompt, 4096, (text) => parseTopics(text, existingSlugs));
}

// ── Step 2: Write full article + LinkedIn post ─────────────────────────────────
// The reply uses marker lines instead of JSON: smaller models often break
// JSON when the value is a long HTML string full of quotes.
const ARTICLE_MARK = "===ARTICLE_HTML===";
const LINKEDIN_MARK = "===LINKEDIN_POST===";
const END_MARK = "===END===";

/** Strips anything that could run code; the HTML is published as written. */
function sanitizeHtml(html) {
  return html
    .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
}

function parseArticle(text, topic) {
  const start = text.indexOf(ARTICLE_MARK);
  const middle = text.indexOf(LINKEDIN_MARK);
  if (start === -1 || middle === -1 || middle < start) throw new Error("reply is missing the section markers");

  const end = text.indexOf(END_MARK, middle);
  let htmlContent = text.slice(start + ARTICLE_MARK.length, middle).trim();
  const linkedinCommentary = text
    .slice(middle + LINKEDIN_MARK.length, end === -1 ? undefined : end)
    .trim();

  // Models sometimes wrap the HTML in a markdown code fence.
  htmlContent = htmlContent.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim();
  htmlContent = sanitizeHtml(htmlContent);

  const words = wordCount(htmlContent);
  if (words < MIN_ARTICLE_WORDS) throw new Error(`article is too short (${words} words)`);
  if ((htmlContent.match(/<h2\b/gi) ?? []).length < 3) throw new Error("article has fewer than 3 H2 sections");
  if (!/<p\b/i.test(htmlContent)) throw new Error("article is not HTML");
  if (/```|\*\*[^*]+\*\*|^#{1,3}\s/m.test(htmlContent)) throw new Error("article contains markdown");
  if (!/bitsolmarketing\.com/i.test(htmlContent)) throw new Error("article has no link to bitsolmarketing.com");

  return {
    htmlContent,
    linkedinCommentary:
      linkedinCommentary || `${topic.excerpt}\n\nRead more: ${SITE_URL}/${topic.slug}\n\n#DigitalMarketing #Pakistan`,
  };
}

async function writeArticle(topic) {
  log(`  Writing article: "${topic.title}"`);

  const prompt = `You are a senior SEO content writer for BITSOL Marketing, a Pakistani digital marketing agency (https://bitsolmarketing.com).

Write a comprehensive, fully SEO-optimized blog article AND a LinkedIn post for the following topic.

TOPIC:
Title: ${topic.title}
Primary Keyword: ${topic.primaryKeyword}
Tags: ${topic.tags.join(", ")}
Niche: ${topic.niche}
Excerpt: ${topic.excerpt}
Article URL: ${SITE_URL}/${topic.slug}

Today's date is ${TODAY}. Write from today's point of view: ${TODAY.slice(0, 4)} is the current year, not a future one.

ARTICLE REQUIREMENTS:
- 1200-1800 words, written for Pakistani business owners and entrepreneurs
- Full HTML only (no markdown) — use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <blockquote>
- Do NOT include an <h1>: the page template renders the article title as the page's only H1
- Do NOT include any <img>: the page template renders the hero image
- Natural keyword density — use primary keyword in the first paragraph, 2+ H2s, and conclusion, always as part of a grammatical sentence and never in bold
- Include at least one call-to-action linking to https://bitsolmarketing.com/contact or the most relevant service page under https://bitsolmarketing.com/services/
- Add a styled CTA box near the end:
  <div style="background:linear-gradient(135deg,#0a2463,#1e88e5);color:#fff;padding:2rem;border-radius:12px;text-align:center;margin:2rem 0">
    <h3 style="margin:0 0 0.75rem">Ready to Grow Your Business?</h3>
    <p style="margin:0 0 1rem">Get a FREE consultation with BITSOL Marketing today.</p>
    <a href="https://bitsolmarketing.com/contact" style="background:#fff;color:#0a2463;padding:0.75rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:700">Contact Us Now →</a>
  </div>
- Mention Pakistan, Pakistani businesses, or local context at least 3 times
- Do not invent statistics, client names or case studies, and do not describe BITSOL's clients, results or track record
- End with an <h2>Conclusion</h2> section

LINKEDIN POST REQUIREMENTS:
- 150-250 words max, plain text
- Engaging hook first line
- 4-6 bullet points with emojis
- 5-7 relevant hashtags at the end (mix of English + Pakistan specific)
- CTA linking to the article URL given above

Reply in exactly this format, with the three marker lines and nothing before or after them:
${ARTICLE_MARK}
<the full HTML article>
${LINKEDIN_MARK}
<the LinkedIn post text>
${END_MARK}`;

  return generate(prompt, 12000, (text) => parseArticle(text, topic));
}

// ── Step 3: Hero image ────────────────────────────────────────────────────────
const IMAGE_STYLE =
  "Professional editorial photograph, natural light, shallow depth of field, modern office setting, " +
  "no text, no letters, no logos, no watermark.";

async function imageFromCloudflare(prompt, seed) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt.slice(0, 2000), steps: 8, seed }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  const body = await res.json().catch(() => ({}));
  const base64 = body?.result?.image ?? body?.image;
  if (!res.ok || !base64) {
    throw new Error(`HTTP ${res.status} ${JSON.stringify(body?.errors ?? body).slice(0, 160)}`);
  }
  return Buffer.from(base64, "base64");
}

async function imageFromPollinations(prompt, seed) {
  const url =
    `https://gen.pollinations.ai/image/${encodeURIComponent(prompt.slice(0, 900))}` +
    `?width=${HERO_WIDTH}&height=${HERO_HEIGHT}&model=flux&seed=${seed}&nologo=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` },
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) {
    throw new Error(`HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/** Breaks a title into lines of roughly `maxChars` for the title card. */
function wrapTitle(title, maxChars, maxLines) {
  const lines = [];
  let line = "";
  for (const word of title.split(/\s+/)) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "…";
  }
  return lines;
}

/** A branded title card drawn locally. Needs no provider, so it always works. */
async function imageFromTitleCard(topic) {
  const lines = wrapTitle(topic.title, 28, 4);
  const lineHeight = 76;
  const firstLine = (HERO_HEIGHT - lines.length * lineHeight) / 2 + 70;
  const label = topic.niche.replace(/-/g, " ").toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_WIDTH}" height="${HERO_HEIGHT}" viewBox="0 0 ${HERO_WIDTH} ${HERO_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a2463"/>
      <stop offset="1" stop-color="#1e88e5"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <circle cx="1080" cy="90" r="260" fill="#ffffff" fill-opacity="0.06"/>
  <circle cx="1180" cy="600" r="200" fill="#ffffff" fill-opacity="0.05"/>
  <rect x="80" y="${firstLine - 150}" width="72" height="6" rx="3" fill="#ffffff"/>
  <text x="80" y="${firstLine - 96}" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="24" font-weight="600" letter-spacing="4" fill="#ffffff" fill-opacity="0.8">${escapeXml(label)}</text>
  ${lines
    .map(
      (l, i) =>
        `<text x="80" y="${firstLine + i * lineHeight}" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="60" font-weight="700" fill="#ffffff">${escapeXml(l)}</text>`
    )
    .join("\n  ")}
  <text x="80" y="${HERO_HEIGHT - 56}" font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="26" font-weight="600" fill="#ffffff" fill-opacity="0.9">BITSOL Marketing · bitsolmarketing.com</text>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Returns a 1200x630 WebP hero image and the name of what produced it. */
async function generateHeroImage(topic, seed) {
  const prompt = `${topic.imagePrompt} ${IMAGE_STYLE}`;
  const generators = [];
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    generators.push(["Cloudflare FLUX", () => imageFromCloudflare(prompt, seed)]);
  }
  if (process.env.POLLINATIONS_API_KEY) {
    generators.push(["Pollinations FLUX", () => imageFromPollinations(prompt, seed)]);
  }
  generators.push(["title card", () => imageFromTitleCard(topic)]);

  for (const [source, run] of generators) {
    try {
      const raw = await run();
      const buffer = await sharp(raw)
        .resize(HERO_WIDTH, HERO_HEIGHT, { fit: "cover", position: "attention" })
        .webp({ quality: 82 })
        .toBuffer();
      return { buffer, source };
    } catch (err) {
      log(`    Image from ${source} failed — ${err.message}`);
    }
  }
  throw new Error("every image generator failed");
}

/**
 * Uploads the hero image to the website and returns its public URL, or null
 * when the site has no image endpoint yet (it ships with the admin platform).
 */
async function uploadHeroImage(buffer, slug) {
  const res = await fetch(`${IMAGE_API_URL}?name=${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "image/webp", "x-api-key": BLOG_API_KEY },
    body: buffer,
    signal: AbortSignal.timeout(60_000),
  });
  if (res.status === 404 || res.status === 405) return null;
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.url) {
    throw new Error(`image upload failed: HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
  }
  return body.url;
}

// Stock photos, used only when a generated image cannot be hosted.
// source.unsplash.com is deprecated — use direct photo IDs per niche instead.
const NICHE_PHOTOS = {
  "digital-marketing":  ["1551288049-bebda4e38f71","1460925895917-afdab827c52f","1504868584819-f8e8b4b6d7e3","1542435503-956c469947f6","1559136555-9303baea8ebd"],
  "seo":                ["1432888498266-38ffec3eaf0a","1573804633927-bfcbcd909acd","1516321318423-f06f85e504b3","1562577309-4932fdd64cd1","1563986768609-322da13575f3"],
  "ecommerce":          ["1556742049-0cfed4f6a45d","1607082348824-0a96f2a4b9da","1556761175-4b46a572b786","1607252650355-f7fd0460ccdb","1546961342-ea5f56e58e98"],
  "social-media":       ["1611162617213-7d7a39e9b1d7","1611162616305-c69b3fa7fbe0","1611162618071-b39a2ec055fb","1536240478700-b869ad10a2eb","1493612276216-ee3925520721"],
  "ai-automation":      ["1677442135703-1787eea5ce01","1620712943543-bcc4688e7485","1664575602554-2087b04935a5","1485827404703-89b55fcc595e","1655720828018-edd2daec9349"],
  "web-dev":            ["1547658719-da2b51169166","1504868584819-f8e8b4b6d7e3","1558494949-ef010cbdcc31","1512941937669-90a1b58e7e9c","1499750310107-5fef28a66643"],
  "entrepreneurship":   ["1559136555-9303baea8ebd","1493612276216-ee3925520721","1460925895917-afdab827c52f","1504868584819-f8e8b4b6d7e3","1542435503-956c469947f6"],
  "pakistan-business":  ["1559136555-9303baea8ebd","1504868584819-f8e8b4b6d7e3","1551288049-bebda4e38f71","1460925895917-afdab827c52f","1432888498266-38ffec3eaf0a"],
};
const _photoCounters = {};

function getUnsplashImage(niche) {
  const pool = NICHE_PHOTOS[niche] ?? NICHE_PHOTOS["digital-marketing"];
  const idx = (_photoCounters[niche] ?? 0) % pool.length;
  _photoCounters[niche] = idx + 1;
  return `https://images.unsplash.com/photo-${pool[idx]}?w=1200&q=80`;
}

/** Generated image when it can be made and hosted, stock photo otherwise. */
async function getHeroImage(topic, index) {
  try {
    const seed = Number(TODAY.replace(/-/g, "")) + index;
    const { buffer, source } = await generateHeroImage(topic, seed);
    log(`  Hero image: generated by ${source} (${Math.round(buffer.length / 1024)} KB)`);

    if (DRY_RUN) {
      const file = path.join(DRY_RUN_DIR, `${topic.slug}.webp`);
      fs.writeFileSync(file, buffer);
      return file;
    }

    const url = await uploadHeroImage(buffer, topic.slug);
    if (url) return url;
    log("  Hero image: the website has no image upload endpoint yet — using a stock photo");
  } catch (err) {
    log(`  Hero image: ${err.message} — using a stock photo`);
  }
  return getUnsplashImage(topic.niche);
}

// ── Step 4: Publish article to website ────────────────────────────────────────
async function publishToWebsite(topic, htmlContent, imageUrl) {
  const payload = {
    title: topic.title,
    slug: topic.slug,
    content: htmlContent,
    author: "BITSOL Marketing",
    image: imageUrl,
    excerpt: topic.excerpt,
    metaDescription: topic.excerpt,
    tags: topic.tags,
    published: true,
  };

  const res = await fetch(BLOG_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": BLOG_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));

  if (res.status === 409 || body?.error?.includes?.("Unique constraint")) {
    return { status: "skipped", reason: "already exists" };
  }
  if (!res.ok) {
    throw new Error(`Blog API ${res.status}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return { status: "published", url: `${SITE_URL}/${topic.slug}` };
}

// ── Step 5: Post to LinkedIn ───────────────────────────────────────────────────
async function postToLinkedIn(topic, commentary, articleUrl) {
  const body = {
    author: `urn:li:organization:${LINKEDIN_COMPANY_ID}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: commentary },
        shareMediaCategory: "ARTICLE",
        media: [
          {
            status: "READY",
            originalUrl: articleUrl,
            title: { text: topic.title },
            description: { text: topic.excerpt },
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LINKEDIN_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  const resBody = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`LinkedIn API ${res.status}: ${JSON.stringify(resBody).slice(0, 200)}`);
  }
  return { status: "posted" };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  log("═══════════════════════════════════════════════════════");
  log(`BITSOL Daily Content Automation — ${TODAY}${DRY_RUN ? " (DRY RUN — nothing is published)" : ""}`);
  log("═══════════════════════════════════════════════════════");

  if (!AI_ARTICLE_WRITING) {
    log("AI article writing is switched off, so there is nothing to do. No AI request was made.");
    log("Social posts are written and published from the admin panel: /admin/social");
    log("To switch article writing back on, set AI_ARTICLE_WRITING=on in .env");
    logStream.end();
    return;
  }

  if (DRY_RUN) fs.mkdirSync(DRY_RUN_DIR, { recursive: true });

  // 0. Preflight — fail fast with actionable messages before doing any work
  log("Preflight: checking credentials...");
  const textProviders = availableTextProviders().map((p) => p.name);
  if (textProviders.length === 0) {
    log(
      "PREFLIGHT FAILED: no AI key in .env. Add at least one free key — GEMINI_API_KEY " +
        "(https://aistudio.google.com/apikey), GROQ_API_KEY (https://console.groq.com/keys) or " +
        "OPENROUTER_API_KEY (https://openrouter.ai/keys)"
    );
    logStream.end();
    process.exit(1);
  }
  log(`Text providers, in order: ${textProviders.join(" → ")}`);
  if (!process.env.CLOUDFLARE_API_TOKEN && !process.env.POLLINATIONS_API_KEY) {
    log("NOTE: no image provider key in .env — hero images will be title cards. See .env.example");
  }

  let linkedinEnabled = false;
  if (!DRY_RUN) {
    try {
      await verifyBlogApi();
    } catch (err) {
      log(`PREFLIGHT FAILED: ${err.message}`);
      logStream.end();
      process.exit(1);
    }
    linkedinEnabled = await verifyLinkedInToken();
    log(`Preflight OK — Blog API ✓  LinkedIn ${linkedinEnabled ? "✓" : "✗ (posting disabled)"}`);
  }

  // 1. Get already-published slugs
  log("Fetching published slugs to avoid duplicates...");
  const existingSlugs = await getPublishedSlugs();
  log(`Found ${existingSlugs.length} existing articles.`);

  // 2. Generate topics
  let topics;
  try {
    const result = await generateTopics(existingSlugs);
    topics = result.value;
    log(`${result.source} selected ${topics.length} topics:`);
    topics.forEach((t, i) => log(`  ${i + 1}. ${t.title}`));
  } catch (err) {
    log(`ERROR generating topics: ${err.message}`);
    logStream.end();
    process.exit(1);
  }

  // 3. Process each topic
  const results = [];
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];

    log(`\n── Article ${i + 1}/${topics.length}: ${topic.title}`);

    try {
      // Write first: an article that fails the quality checks needs no image
      const article = await writeArticle(topic);
      const { htmlContent, linkedinCommentary } = article.value;
      log(`  Article written by ${article.source} (${wordCount(htmlContent)} words)`);

      const imageUrl = await getHeroImage(topic, i);
      log(`  Hero image: ${imageUrl}`);

      if (DRY_RUN) {
        const file = path.join(DRY_RUN_DIR, `${topic.slug}.html`);
        fs.writeFileSync(
          file,
          `<!-- ${topic.title}\n     written by ${article.source}\n     excerpt: ${topic.excerpt}\n     tags: ${topic.tags.join(", ")} -->\n` +
            `${htmlContent}\n\n<!-- LinkedIn post\n${linkedinCommentary}\n-->\n`
        );
        log(`  Dry run: saved → ${file}`);
        results.push({ title: topic.title, slug: topic.slug, status: "success" });
        continue;
      }

      // Publish to website
      const pubResult = await publishToWebsite(topic, htmlContent, imageUrl);
      if (pubResult.status === "skipped") {
        log(`  Website: SKIPPED (${pubResult.reason})`);
      } else {
        log(`  Website: ✅ Published → ${pubResult.url}`);
      }

      // Post to LinkedIn (only if newly published, not skipped)
      if (pubResult.status === "published" && !linkedinEnabled) {
        log("  LinkedIn: SKIPPED (token expired — run node scripts/linkedin-auth.mjs)");
      } else if (pubResult.status === "published") {
        await sleep(3000);
        const articleUrl = `${SITE_URL}/${topic.slug}`;
        const liResult = await postToLinkedIn(topic, linkedinCommentary, articleUrl);
        log(`  LinkedIn: ✅ ${liResult.status}`);
      } else {
        log(`  LinkedIn: SKIPPED (article already existed)`);
      }

      results.push({ title: topic.title, slug: topic.slug, status: "success" });
    } catch (err) {
      log(`  ERROR: ${err.message}`);
      results.push({ title: topic.title, slug: topic.slug, status: "error", error: err.message });
    }

    // Rate limiting — free tiers allow only a few requests per minute
    if (i < topics.length - 1) {
      log("  Waiting 20s before next article...");
      await sleep(20000);
    }
  }

  // 4. Summary
  log("\n═══════════════════════════════════════════════════════");
  log("SUMMARY");
  log("═══════════════════════════════════════════════════════");
  const success = results.filter((r) => r.status === "success").length;
  const errors = results.filter((r) => r.status === "error").length;
  log(`${DRY_RUN ? "Written   " : "Published "}: ${success}`);
  log(`Errors    : ${errors}`);
  results.forEach((r) => {
    const icon = r.status === "success" ? "✅" : "❌";
    log(`  ${icon} ${r.title}`);
    if (r.error) log(`     → ${r.error}`);
  });
  log(`Log saved → ${LOG_FILE}`);
  log("═══════════════════════════════════════════════════════");

  logStream.end();
}

main().catch((err) => {
  log(`FATAL: ${err.message}`);
  logStream.end();
  process.exit(1);
});
