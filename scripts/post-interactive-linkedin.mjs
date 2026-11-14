/**
 * BITSOL MARKETING — LinkedIn Interactive Posts Publisher
 * Posts 10 engagement-driven posts to the company page immediately.
 *
 * Run: node scripts/post-interactive-linkedin.mjs
 * Dry run: node scripts/post-interactive-linkedin.mjs --dry-run
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

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

const ACCESS_TOKEN = process.env.LINKEDIN_ACCESS_TOKEN || "";
const COMPANY_ID   = process.env.LINKEDIN_COMPANY_ID   || "";

if (!DRY_RUN && (!ACCESS_TOKEN || !COMPANY_ID)) {
  console.error("❌  LINKEDIN_ACCESS_TOKEN and LINKEDIN_COMPANY_ID must be set in .env");
  process.exit(1);
}

// ─── Posts ────────────────────────────────────────────────────────────────────
const posts = [
  {
    label: "Post 1 | Comment poll",
    text: `Quick question for business owners in Pakistan 👇

Which is your biggest bottleneck right now?

A) Getting leads
B) Converting leads into paying clients
C) Managing and retaining clients
D) Scaling operations without hiring more staff

Comment A, B, C, or D below.

We're building a free resource around the top answer — and we want it to solve your actual problem, not a textbook one.

Tag a fellow business owner whose answer you're curious about 👇`,
  },

  {
    label: "Post 2 | Agree or disagree",
    text: `Hot take: Most Pakistani businesses don't have a marketing problem.

They have an automation problem.

Think about it:
↳ 50–200 WhatsApp messages/day answered manually
↳ Social content created from scratch every morning
↳ Follow-up emails sent one by one
↳ Reports pulled manually from 4 different tools every Monday

Fix the automation — and the marketing actually works.

React ✅ if you agree.
Comment "DISAGREE" if you think the marketing itself is the real problem.

Curious which camp Pakistan's business community falls into.`,
  },

  {
    label: "Post 3 | Fill in the blank",
    text: `Fill in the blank 👇

"The one task in my business I would automate tomorrow if I could is ___________"

I'll start: for us, it used to be manually compiling weekly performance reports from 6 different platforms. Now an AI does it every Monday at 7 AM before we're even at our desks.

Drop your answer in the comments.

Reading every single response — the most common ones will directly shape what we build and write about next.`,
  },

  {
    label: "Post 4 | Controversial take",
    text: `Unpopular opinion in the Pakistani digital marketing world:

A PKR 50,000 website is one of the most expensive decisions a business can make.

Not because of the upfront cost. Because of the opportunity cost.

A website that:
❌ Doesn't rank on Google
❌ Loads in 8 seconds on mobile
❌ Has no WhatsApp button above the fold
❌ Sends ad traffic to the homepage

...costs you leads every single day. Silently. Forever.

The hardest conversation we have with clients: "Your website is actively hurting your business." Because they already paid someone for it.

Agree or think I'm being too harsh? Let me know below 👇`,
  },

  {
    label: "Post 5 | Tag someone",
    text: `Tag a business owner in Pakistan who is still doing customer support manually in 2026 👇

They're answering the same 10 questions 50 times a day:
→ "What's the price?"
→ "Do you deliver to [city]?"
→ "How long does it take?"
→ "What are your working hours?"
→ "Do you do custom orders?"

An AI WhatsApp chatbot handles ALL of these. 24 hours a day, 7 days a week, in Urdu or English. For PKR 15,000–40,000/month.

That's less than one full-time hire.

Tag them. They'll thank you later 😄

#PakistanBusiness #AIAutomation #WhatsApp`,
  },

  {
    label: "Post 6 | Quick quiz",
    text: `Quick quiz for marketers and business owners 🎯

What's the average open rate for WhatsApp messages vs email?

A) 45% vs 25%
B) 65% vs 30%
C) 98% vs 20%
D) 80% vs 40%

Comment your answer before scrolling.

.
.
.
.
.

Answer: C — 98% WhatsApp open rate vs 20% for email.

Not a typo. 98 out of every 100 WhatsApp messages get opened.

If your business isn't using WhatsApp Business API for customer communication yet — what's the main reason? Genuinely asking 👇`,
  },

  {
    label: "Post 7 | Which would you choose",
    text: `You have PKR 100,000 to invest in growing your business this month.

Which do you choose?

A) Meta / Google Ads
→ Immediate leads, trackable ROI — stops the moment you stop paying

B) AI Automation System
→ Higher setup, but runs 24/7 and pays for itself in 60–90 days

C) SEO + Content
→ Slow start (3–6 months) — generates free traffic indefinitely after that

D) Hire a salesperson
→ Human relationships — limited to working hours and has bad months

Comment your choice and why. No wrong answers — the right one depends on your stage and model.

(We work with businesses doing all four. Sharing a breakdown of which works best at each business stage in a future post.)`,
  },

  {
    label: "Post 8 | Story + question",
    text: `A client came to us spending PKR 200,000/month on a 4-person sales team.

The problem: 70% of their leads came in after hours. The team responded the next morning. By then, 60% had already contacted a competitor.

We built a WhatsApp AI that:
→ Responded to every lead within 90 seconds — day or night
→ Qualified them with 4 smart questions
→ Booked calls or sent quotes automatically
→ Handed off to humans with full context attached

Three months later: same lead volume. 40% more closed deals.

The only thing that changed was response time.

What is the current response time on your leads — hours? Days? Drop a number in the comments 👇`,
  },

  {
    label: "Post 9 | Opinion debate",
    text: `Honest question for Pakistan's business community:

What is the #1 reason businesses fail at digital marketing here?

My hypotheses:

→ They expect results in 2 weeks from a 6-month strategy
→ They hire the cheapest option and expect premium outcomes
→ They track nothing, so they never know what's working
→ They treat marketing as an expense instead of an investment
→ Something else entirely

Comment below — especially if your answer is "something else." I want to hear the real ones.

The most insightful responses will become a follow-up post next week (with credit to you).`,
  },

  {
    label: "Post 10 | 30-day challenge CTA",
    text: `The 30-Day AI Automation Challenge for Pakistani businesses 🚀

Week 1: List your 5 highest-volume, most repetitive tasks
Week 2: Automate ONE of them — just one (WhatsApp responses, lead follow-up, reporting — pick the biggest daily pain)
Week 3: Measure time saved and calculate the PKR value per month
Week 4: Reinvest that savings into the next automation

Businesses that have done this tell us the same thing in month 2: "Why did we wait so long?"

If you're starting this challenge today, comment "STARTING" below 👇

If you've already automated something in your business, share what it was. It might be exactly what someone else here needs to hear.

Let's build a smarter, faster business community in Pakistan. 🇵🇰

#AIAutomation #PakistanBusiness #DigitalTransformation #BITSOL`,
  },
];

// ─── LinkedIn ugcPosts API ────────────────────────────────────────────────────
async function postToLinkedIn(text) {
  return fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:organization:${COMPANY_ID}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
  console.log(`\nBITSOL — LinkedIn Interactive Posts Publisher`);
  console.log(`Mode : ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`Posts: ${posts.length}\n`);

  if (DRY_RUN) {
    posts.forEach((p) => {
      console.log(`\n── ${p.label} ──`);
      console.log(p.text);
      console.log(`\n[${p.text.length} chars]`);
    });
    return;
  }

  let published = 0;
  let failed = 0;

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const preview = post.text.split("\n")[0].slice(0, 60);
    process.stdout.write(`[${i + 1}/${posts.length}] ${preview}... `);

    try {
      const res = await postToLinkedIn(post.text);
      if (res.status === 201 || res.status === 200) {
        const id = res.headers.get("x-restli-id") || "";
        console.log(`✅  Published${id ? `  [${id}]` : ""}`);
        published++;
      } else {
        const body = await res.text();
        console.log(`❌  HTTP ${res.status}: ${body.slice(0, 120)}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌  ${err.message}`);
      failed++;
    }

    if (i < posts.length - 1) await sleep(2000);
  }

  console.log(`\n── Summary ─────────────────────────────────`);
  console.log(`Published : ${published}`);
  console.log(`Failed    : ${failed}`);
  console.log(`────────────────────────────────────────────`);
  console.log(`\nView posts → https://www.linkedin.com/company/${COMPANY_ID}/posts/\n`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
