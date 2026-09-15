/**
 * BITSOL Daily Content Automation
 * Runs daily at 8:00 PM PKT via Windows Task Scheduler.
 *
 * Pipeline:
 *  1. Ask Claude to pick 3 fresh trending topics (avoids already-published slugs)
 *  2. Claude writes a full SEO HTML article + LinkedIn commentary per topic
 *  3. Publish each article to https://bitsolmarketing.com/blog via REST API
 *  4. Post each article as a LinkedIn article card (thumbnail + commentary)
 *
 * Logs are written to scripts/logs/daily-YYYY-MM-DD.log
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

// ── Config ────────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const BLOG_API_KEY = process.env.BLOG_API_KEY;
const BLOG_API_URL = "https://bitsolmarketing.com/api/blog";
const SITE_URL = "https://bitsolmarketing.com/blog";
const LINKEDIN_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const LINKEDIN_COMPANY_ID = process.env.LINKEDIN_COMPANY_ID;
const ARTICLES_PER_DAY = 3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "logs");
const TODAY = new Date().toISOString().slice(0, 10);
const LOG_FILE = path.join(LOG_DIR, `daily-${TODAY}.log`);

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

// ── Fetch published slugs to avoid duplicates ─────────────────────────────────
async function getPublishedSlugs() {
  try {
    const res = await fetch(`${BLOG_API_URL}?limit=200`, {
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
async function generateTopics(client, existingSlugs) {
  log("Step 1 — Asking Claude for trending topic ideas...");

  const prompt = `You are an SEO content strategist for BITSOL Marketing (https://bitsolmarketing.com), a Pakistani digital marketing agency offering:
- SEO, paid ads, social media marketing
- Web & app development
- AI automation (Conversiq WhatsApp chatbot: https://conversiq.bitsolmarketing.com)
- Content marketing and branding

Today is ${TODAY}. Pick exactly ${ARTICLES_PER_DAY} trending blog article topics that:
1. Are highly relevant to Pakistani businesses, entrepreneurs, or digital marketing in 2025-2026
2. Have strong Google search volume (think long-tail SEO keywords)
3. Would naturally promote or relate to BITSOL Marketing's services
4. Have NOT been covered by these existing slugs: ${existingSlugs.slice(0, 50).join(", ")}

Return ONLY valid JSON — an array of ${ARTICLES_PER_DAY} objects, no extra text:
[
  {
    "title": "Full SEO article title here",
    "slug": "url-friendly-slug-here",
    "primaryKeyword": "main keyword",
    "tags": ["tag1", "tag2", "tag3", "tag4"],
    "excerpt": "2-sentence meta description / excerpt (150-160 chars)",
    "imageQuery": "Unsplash search query for a relevant hero image (3-4 words)",
    "niche": "one of: digital-marketing | seo | ecommerce | social-media | ai-automation | web-dev | entrepreneurship | pakistan-business"
  }
]`;

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON for topics");
  return JSON.parse(jsonMatch[0]);
}

// ── Step 2: Write full article + LinkedIn post ─────────────────────────────────
async function writeArticle(client, topic, imageUrl) {
  log(`  Writing article: "${topic.title}"`);

  const prompt = `You are a senior SEO content writer for BITSOL Marketing, a Pakistani digital marketing agency (https://bitsolmarketing.com).

Write a comprehensive, fully SEO-optimized blog article AND a LinkedIn post for the following topic.

TOPIC:
Title: ${topic.title}
Primary Keyword: ${topic.primaryKeyword}
Tags: ${topic.tags.join(", ")}
Niche: ${topic.niche}
Excerpt: ${topic.excerpt}

ARTICLE REQUIREMENTS:
- 1200-1800 words, written for Pakistani business owners and entrepreneurs
- Full HTML only (no markdown) — use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <figure>, <blockquote>
- Do NOT include an <h1>: the page template renders the article title as the page's only H1
- Include the hero image exactly once at the top:
  <figure style="margin:0 0 2rem 0"><img src="${imageUrl}" alt="${topic.primaryKeyword}" style="width:100%;border-radius:12px;"><figcaption style="text-align:center;color:#666;font-size:0.85rem;margin-top:0.5rem">${topic.primaryKeyword} — BITSOL Marketing</figcaption></figure>
- Natural keyword density — use primary keyword in the first paragraph, 2+ H2s, and conclusion
- Include at least one call-to-action linking to https://bitsolmarketing.com/contact, the most relevant service page under https://bitsolmarketing.com/services/, or https://conversiq.bitsolmarketing.com (relevant to niche)
- Add a styled CTA box near the end:
  <div style="background:linear-gradient(135deg,#0a2463,#1e88e5);color:#fff;padding:2rem;border-radius:12px;text-align:center;margin:2rem 0">
    <h3 style="margin:0 0 0.75rem">Ready to Grow Your Business?</h3>
    <p style="margin:0 0 1rem">Get a FREE consultation with BITSOL Marketing today.</p>
    <a href="https://bitsolmarketing.com/contact" style="background:#fff;color:#0a2463;padding:0.75rem 1.5rem;border-radius:6px;text-decoration:none;font-weight:700">Contact Us Now →</a>
  </div>
- Mention Pakistan, Pakistani businesses, or local context at least 3 times
- End with an <h2>Conclusion</h2> section

LINKEDIN POST REQUIREMENTS:
- 150-250 words max
- Engaging hook first line
- 4-6 bullet points with emojis
- 5-7 relevant hashtags at the end (mix of English + Pakistan specific)
- CTA linking to the article or https://bitsolmarketing.com

Return ONLY valid JSON, no extra text:
{
  "htmlContent": "<full HTML article here>",
  "linkedinCommentary": "Full LinkedIn post text here"
}`;

  const message = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 6000,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  // Extract JSON — handle cases where Claude wraps it in ```json blocks
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude did not return valid JSON for article");

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    // Try to extract just the JSON object more aggressively
    const cleaned = jsonMatch[0].replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
    parsed = JSON.parse(cleaned);
  }

  return parsed;
}

// ── Step 3: Get Unsplash image ─────────────────────────────────────────────────
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

function getUnsplashImage(query, niche) {
  const pool = NICHE_PHOTOS[niche] ?? NICHE_PHOTOS["digital-marketing"];
  const idx = (_photoCounters[niche] ?? 0) % pool.length;
  _photoCounters[niche] = idx + 1;
  return `https://images.unsplash.com/photo-${pool[idx]}?w=1200&q=80`;
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
  log(`BITSOL Daily Content Automation — ${TODAY}`);
  log("═══════════════════════════════════════════════════════");

  if (!ANTHROPIC_API_KEY) {
    log("ERROR: ANTHROPIC_API_KEY not set in .env");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // 1. Get already-published slugs
  log("Fetching published slugs to avoid duplicates...");
  const existingSlugs = await getPublishedSlugs();
  log(`Found ${existingSlugs.length} existing articles.`);

  // 2. Generate topics
  let topics;
  try {
    topics = await generateTopics(client, existingSlugs);
    log(`Claude selected ${topics.length} topics:`);
    topics.forEach((t, i) => log(`  ${i + 1}. ${t.title}`));
  } catch (err) {
    log(`ERROR generating topics: ${err.message}`);
    process.exit(1);
  }

  // 3. Process each topic
  const results = [];
  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    // Ensure slug is URL-safe
    topic.slug = topic.slug || slugify(topic.title);

    log(`\n── Article ${i + 1}/${topics.length}: ${topic.title}`);

    try {
      // Get hero image
      const imageUrl = getUnsplashImage(topic.imageQuery || topic.primaryKeyword, topic.niche);
      log(`  Hero image: ${imageUrl}`);

      // Write article content
      const { htmlContent, linkedinCommentary } = await writeArticle(client, topic, imageUrl);
      log(`  Article written (${htmlContent.length} chars)`);

      // Publish to website
      const pubResult = await publishToWebsite(topic, htmlContent, imageUrl);
      if (pubResult.status === "skipped") {
        log(`  Website: SKIPPED (${pubResult.reason})`);
      } else {
        log(`  Website: ✅ Published → ${pubResult.url}`);
      }

      // Post to LinkedIn (only if newly published, not skipped)
      if (pubResult.status === "published") {
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

    // Rate limiting — wait between articles
    if (i < topics.length - 1) {
      log("  Waiting 8s before next article...");
      await sleep(8000);
    }
  }

  // 4. Summary
  log("\n═══════════════════════════════════════════════════════");
  log("SUMMARY");
  log("═══════════════════════════════════════════════════════");
  const success = results.filter((r) => r.status === "success").length;
  const errors = results.filter((r) => r.status === "error").length;
  log(`Published : ${success}`);
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
