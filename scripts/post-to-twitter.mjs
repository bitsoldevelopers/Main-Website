/**
 * BITSOL MARKETING — Twitter/X Interactive Posts Publisher
 * Posts 10 engagement-driven posts to the BITSOL Twitter account.
 *
 * Run: node scripts/post-to-twitter.mjs
 * Dry run: node scripts/post-to-twitter.mjs --dry-run
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");

// ─── Load .env ────────────────────────────────────────────────────────────────
try {
  const envContent = readFileSync(join(__dirname, "../.env"), "utf8");
  envContent.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key?.trim() && rest.length)
      process.env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, "");
  });
} catch {}

const API_KEY            = process.env.TWITTER_API_KEY            || "";
const API_SECRET         = process.env.TWITTER_API_SECRET         || "";
const ACCESS_TOKEN       = process.env.TWITTER_ACCESS_TOKEN       || "";
const ACCESS_TOKEN_SECRET = process.env.TWITTER_ACCESS_TOKEN_SECRET || "";

if (!DRY_RUN && (!API_KEY || !API_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET)) {
  console.error("❌  Twitter credentials missing in .env");
  process.exit(1);
}

// ─── OAuth 1.0a signing ───────────────────────────────────────────────────────
function pct(str) {
  return encodeURIComponent(str)
    .replace(/!/g, "%21").replace(/'/g, "%27")
    .replace(/\(/g, "%28").replace(/\)/g, "%29").replace(/\*/g, "%2A");
}

function buildAuthHeader(method, url) {
  const oAuth = {
    oauth_consumer_key:     API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_token:            ACCESS_TOKEN,
    oauth_version:          "1.0",
  };

  const paramStr = Object.keys(oAuth).sort()
    .map((k) => `${pct(k)}=${pct(oAuth[k])}`).join("&");

  const base = [method.toUpperCase(), pct(url), pct(paramStr)].join("&");
  const key  = `${pct(API_SECRET)}&${pct(ACCESS_TOKEN_SECRET)}`;
  const sig  = crypto.createHmac("sha1", key).update(base).digest("base64");

  const all = { ...oAuth, oauth_signature: sig };
  const hdr = Object.keys(all).sort()
    .map((k) => `${pct(k)}="${pct(all[k])}"`).join(", ");

  return `OAuth ${hdr}`;
}

// ─── Twitter-optimised posts (≤ 280 chars) ────────────────────────────────────
const posts = [
  {
    label: "Post 1 | Comment poll",
    text: `Quick question for Pakistani business owners 👇

Biggest bottleneck right now?

A) Getting leads
B) Converting leads to paying clients
C) Managing & retaining clients
D) Scaling without more staff

Comment A/B/C/D — building a free resource around the top answer 🇵🇰`,
  },

  {
    label: "Post 2 | Agree or disagree",
    text: `Hot take: Most Pakistani businesses don't have a marketing problem.

They have an automation problem.

↳ WhatsApp messages answered manually
↳ Reports pulled from 4 tools every Monday
↳ Follow-ups sent one by one

React ✅ if you agree — comment DISAGREE if not 👇`,
  },

  {
    label: "Post 3 | Fill in the blank",
    text: `Fill in the blank 👇

"The one task I'd automate tomorrow in my business is ___"

For us: weekly reports from 6 platforms. Now AI does it every Monday at 7 AM.

Drop yours below — most common answers shape what we build next 🛠️`,
  },

  {
    label: "Post 4 | Controversial take",
    text: `Unpopular opinion: A PKR 50,000 website can be one of the most expensive decisions a business makes.

Not the cost — the opportunity cost.

No Google ranking + slow mobile load + no WhatsApp CTA = leads lost every day. Silently.

Agree? 👇`,
  },

  {
    label: "Post 5 | Tag someone",
    text: `Tag a business owner still doing customer support manually in 2026 👇

Answering the same 10 questions 50 times/day: price, delivery, hours, custom orders…

A WhatsApp AI handles ALL of these 24/7 in Urdu or English for PKR 15k–40k/month.

Less than one hire 🤖`,
  },

  {
    label: "Post 6 | Quick quiz",
    text: `Quick quiz 🎯

WhatsApp vs Email open rate?

A) 45% vs 25%
B) 65% vs 30%
C) 98% vs 20%
D) 80% vs 40%

.
.
Answer: C — 98% vs 20%. Not a typo.

If you're not on WhatsApp Business API yet — what's stopping you? Genuinely asking 👇`,
  },

  {
    label: "Post 7 | Which would you choose",
    text: `You have PKR 100,000 to invest in your business this month.

A) Meta/Google Ads — immediate leads, stops when you stop paying
B) AI Automation — higher setup, runs 24/7, ROI in 60–90 days
C) SEO — slow start, free traffic forever
D) Hire a salesperson

Comment your choice + why 👇`,
  },

  {
    label: "Post 8 | Story + question",
    text: `Client spent PKR 200k/month on a 4-person sales team.

Problem: 70% of leads came after hours. Team replied next morning. 60% had already called a competitor.

We built a WhatsApp AI: 90-second response, 24/7.

Result: same leads. 40% more deals closed.

Your lead response time? 👇`,
  },

  {
    label: "Post 9 | Opinion debate",
    text: `Honest question: Why do Pakistani businesses fail at digital marketing?

→ Expect 2-week results from a 6-month strategy
→ Hire cheapest, expect premium outcome
→ Track nothing
→ Treat marketing as expense, not investment
→ Something else?

Comment below — best answers get featured next week 👇`,
  },

  {
    label: "Post 10 | 30-day challenge",
    text: `30-Day AI Automation Challenge for Pakistani businesses 🚀

Week 1: List your 5 most repetitive tasks
Week 2: Automate ONE (WhatsApp, follow-ups, or reporting)
Week 3: Measure time & PKR saved
Week 4: Reinvest into next automation

Starting today? Comment "STARTING" 👇

#AIAutomation #PakistanBusiness`,
  },
];

// ─── Post tweet ───────────────────────────────────────────────────────────────
async function postTweet(text) {
  const url = "https://api.twitter.com/2/tweets";
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader("POST", url),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nBITSOL — Twitter/X Interactive Posts Publisher`);
  console.log(`Mode : ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Posts: ${posts.length}\n`);

  if (DRY_RUN) {
    posts.forEach((p) => {
      console.log(`\n── ${p.label} (${p.text.length} chars) ──`);
      console.log(p.text);
    });
    return;
  }

  let published = 0;
  let failed = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const preview = post.text.split("\n")[0].slice(0, 55);
    process.stdout.write(`[${i + 1}/${posts.length}] ${preview}... `);

    try {
      const res = await postTweet(post.text);
      const data = await res.json();

      if (res.status === 201 && data.data?.id) {
        console.log(`✅  Tweet ID: ${data.data.id}`);
        published++;
      } else {
        const err = data.detail || data.title || JSON.stringify(data).slice(0, 120);
        console.log(`❌  HTTP ${res.status}: ${err}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }

    if (i < posts.length - 1) await sleep(3000);
  }

  console.log(`\n── Summary ─────────────────────────────────`);
  console.log(`Published : ${published}`);
  console.log(`Failed    : ${failed}`);
  console.log(`────────────────────────────────────────────\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
