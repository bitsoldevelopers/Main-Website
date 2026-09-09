#!/usr/bin/env node
/**
 * BITSOL MARKETING — Blog cover image repair
 *
 * 1. Assigns a topical cover image to posts that have none.
 * 2. Detects published posts whose cover image URL no longer resolves
 *    (several Unsplash IDs used by older posts now return 404) and
 *    repoints them at a verified replacement.
 *
 * Every candidate URL is HTTP-checked before it is written, so a broken
 * image can never be introduced by this script.
 *
 * Usage:
 *   node scripts/fix-blog-images.mjs --dry-run
 *   node scripts/fix-blog-images.mjs --apply
 *
 * Reads BLOG_API_KEY from .env — never hardcode it.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function loadEnv() {
  for (const p of [resolve(projectRoot, ".env"), resolve(projectRoot, ".env.local")]) {
    try {
      for (const line of readFileSync(p, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const eq = t.indexOf("=");
        if (eq === -1) continue;
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (!process.env[k]) process.env[k] = v;
      }
    } catch { /* optional */ }
  }
}
loadEnv();

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const APPLY = args.includes("--apply");
if (!DRY && !APPLY) {
  console.error("Refusing to run without --dry-run or --apply.");
  process.exit(1);
}

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://bitsolmarketing.com").replace(/\/$/, "");
const API = `${SITE}/api/blog`;
const KEY = process.env.BLOG_API_KEY;

const U = (id) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

// Verified-resolving IDs only (checked 2026-09-10).
const IMG = {
  ai:         "1677442135703-1787eea5ce01",
  automation: "1485827404703-89b55fcc595e",
  chatbot:    "1531746790731-6c087fecd65a",
  whatsapp:   "1577563908411-5077b6dc7624",
  search:     "1573804633927-bfcbcd909acd",
  analytics:  "1504868584819-f8e8b4b6d7e3",
  roi:        "1551288049-bebda4e38f71",
  website:    "1460925895917-afdab827c52f",
  webdesign:  "1467232004584-a241de8bcf5d",
  ecommerce:  "1563013544-824ae1b704d3",
  leadgen:    "1551434678-e076c223a692",
  social:     "1611162617474-5b21e879e113",
  metaads:    "1563986768609-322da13575f3",
  googleads:  "1432888622747-4eb9a8efeb07",
  business:   "1600880292203-757bb62b4baf",
  strategy:   "1455390582262-044cdead277a",
  startup:    "1559136555-9303baea8ebd",
  education:  "1516321318423-f06f85e504b3",
  content:    "1499750310107-5fef28a66643",
  branding:   "1493421419110-74f4e85ba126",
  video:      "1492691527719-9d1e07e534b4",
  linkedin:   "1556742049-0cfed4f6a45d",
  trading:    "1611974789855-9c2a0a7236a3",
  youtube:    "1611532736597-de2d4265fba3",
  influencer: "1557804506-669a67965ba0",
};

// Explicit covers for the newly published packages.
const EXPLICIT = {
  "ai-business-automation-pakistan": IMG.automation,
  "ai-marketing-services-pakistan": IMG.ai,
  "ai-seo-services-pakistan": IMG.search,
  "best-ai-marketing-agency-pakistan": IMG.ai,
  "best-digital-marketing-agency-pakistan": IMG.business,
  "best-lead-generation-agency-pakistan": IMG.leadgen,
  "best-seo-agency-pakistan": IMG.search,
  "best-social-media-marketing-agency-pakistan": IMG.social,
  "best-web-development-company-pakistan": IMG.webdesign,
  "crm-development-company-pakistan": IMG.analytics,
  "custom-software-development-pakistan": IMG.webdesign,
  "digital-marketing-agency-faisalabad": IMG.business,
  "digital-marketing-agency-sahiwal": IMG.education,
  "digital-marketing-cost-pakistan": IMG.roi,
  "digital-marketing-services-pakistan": IMG.social,
  "digital-marketing-strategy-pakistan": IMG.strategy,
  "ecommerce-website-development-pakistan": IMG.ecommerce,
  "facebook-ads-agency-pakistan": IMG.metaads,
  "google-ads-agency-pakistan": IMG.googleads,
  "google-maps-seo-pakistan-rank-local-3-pack": IMG.search,
  "google-maps-seo-services-pakistan": IMG.website,
  "lead-generation-services-pakistan": IMG.leadgen,
  "local-seo-services-pakistan": IMG.website,
  "saas-development-company-pakistan": IMG.startup,
  "seo-cost-pakistan": IMG.analytics,
  "technical-seo-services-pakistan": IMG.webdesign,
  "whatsapp-api-vs-whatsapp-business-app": IMG.whatsapp,
  "whatsapp-automation-pakistani-businesses": IMG.whatsapp,
  "whatsapp-chatbot-development-company-pakistan": IMG.chatbot,
  "whatsapp-chatbot-pricing-pakistan": IMG.roi,
  "whatsapp-chatbot-real-estate-pakistan": IMG.business,
};

// Keyword fallback for any other post needing a cover.
function inferImage(slug) {
  const s = slug.toLowerCase();
  if (/whatsapp/.test(s)) return IMG.whatsapp;
  if (/chatbot|agent/.test(s)) return IMG.chatbot;
  if (/trading|psx|crypto/.test(s)) return IMG.trading;
  if (/youtube/.test(s)) return IMG.youtube;
  if (/influencer/.test(s)) return IMG.influencer;
  if (/linkedin|b2b/.test(s)) return IMG.linkedin;
  if (/video|short-form/.test(s)) return IMG.video;
  if (/brand/.test(s)) return IMG.branding;
  if (/email|content-marketing/.test(s)) return IMG.content;
  if (/ecommerce|e-commerce|shopif|store/.test(s)) return IMG.ecommerce;
  if (/meta-ads|facebook|instagram/.test(s)) return IMG.metaads;
  if (/google-ads|ppc/.test(s)) return IMG.googleads;
  if (/social/.test(s)) return IMG.social;
  if (/lead/.test(s)) return IMG.leadgen;
  if (/lms|course|institute|education|school/.test(s)) return IMG.education;
  if (/website|web-development|nextjs|react/.test(s)) return IMG.webdesign;
  if (/saas|startup/.test(s)) return IMG.startup;
  if (/roi|cost|pricing|budget/.test(s)) return IMG.roi;
  if (/analytics|ga4|data/.test(s)) return IMG.analytics;
  if (/seo|search|maps/.test(s)) return IMG.search;
  if (/automation/.test(s)) return IMG.automation;
  if (/\bai\b|llm|gpt|agentic/.test(s)) return IMG.ai;
  if (/strategy|plan/.test(s)) return IMG.strategy;
  return IMG.business;
}

const urlCache = new Map();
async function resolves(url) {
  if (!url) return false;
  if (urlCache.has(url)) return urlCache.get(url);
  try {
    const res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    const ok = res.status >= 200 && res.status < 400;
    urlCache.set(url, ok);
    return ok;
  } catch {
    urlCache.set(url, false);
    return false;
  }
}

console.log(`\nFetching published posts from ${API} …`);
const res = await fetch(`${API}?limit=500`);
if (!res.ok) { console.error(`Failed to list posts: ${res.status}`); process.exit(1); }
const posts = await res.json();
console.log(`Found ${posts.length} published posts.\n`);

const planned = [];
for (const p of posts) {
  const current = p.image || null;
  let reason = null;

  if (!current) {
    reason = "missing";
  } else if (!(await resolves(current))) {
    reason = "broken";
  }
  if (!reason) continue;

  const id = EXPLICIT[p.slug] || inferImage(p.slug);
  const next = U(id);
  if (!(await resolves(next))) {
    console.log(`  SKIP    ${p.slug} — replacement URL did not resolve`);
    continue;
  }
  planned.push({ slug: p.slug, reason, next });
}

console.log(`${planned.length} post(s) need a cover image:\n`);
const missing = planned.filter((x) => x.reason === "missing").length;
const broken = planned.filter((x) => x.reason === "broken").length;
for (const x of planned) console.log(`  ${x.reason.padEnd(8)} ${x.slug}`);
console.log(`\n  missing: ${missing}   broken: ${broken}`);

if (DRY) {
  console.log("\nDRY RUN — nothing written.");
  process.exit(0);
}

if (!KEY) { console.error("\nBLOG_API_KEY not set. Refusing to write."); process.exit(1); }

console.log("\nApplying …\n");
let ok = 0, failed = 0;
for (const x of planned) {
  try {
    const r = await fetch(`${API}/${x.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-api-key": KEY },
      body: JSON.stringify({ image: x.next }),
    });
    if (r.ok) { console.log(`  ok      ${x.slug}`); ok++; }
    else { console.log(`  FAILED  ${x.slug} — ${r.status}`); failed++; }
  } catch (e) {
    console.log(`  ERROR   ${x.slug} — ${e.message}`); failed++;
  }
}
console.log(`\nDone. ${ok} updated, ${failed} failed.`);
