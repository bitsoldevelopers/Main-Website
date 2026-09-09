/**
 * Patches every published blog post with a relevant Unsplash cover image.
 * Run: node scripts/patch-blog-images.mjs
 *
 * Requires the PATCH /api/blog/[slug] endpoint to be live on production.
 */

const API_BASE = "https://bitsolmarketing.com/api/blog";
const API_KEY  = process.env.BLOG_API_KEY;

// Curated Unsplash photo IDs mapped to each slug.
// Format: https://images.unsplash.com/photo-<ID>?w=1200&q=80&auto=format&fit=crop
const U = (id) =>
  `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format&fit=crop`;

const imageMap = {
  // ── 10 new articles ────────────────────────────────────────────────────────
  "google-ads-management-pakistan-maximum-roi-ppc-2026":
    U("1432888622747-4eb9a8efeb07"), // laptop + analytics
  "tiktok-marketing-pakistan-2026-complete-business-guide":
    U("1611162617474-5b21e879e113"), // phone/social media scrolling
  "website-design-pakistan-cost-high-converting-2026":
    U("1467232004584-a241de8bcf5d"), // web design / dual monitors
  "influencer-marketing-pakistan-2026-strategy-guide":
    U("1557804506-669a67965ba0"), // influencer with phone
  "video-marketing-strategy-2026-dominate-every-channel":
    U("1492691527719-9d1e07e534b4"), // video camera / production
  "conversion-rate-optimization-cro-website-visitors-customers":
    U("1504868584819-f8e8b4b6d7e3"), // analytics dashboard / charts
  "b2b-digital-marketing-pakistan-generate-business-leads-2026":
    U("1600880292203-757bb62b4baf"), // business meeting / handshake
  "youtube-marketing-pakistan-2026-grow-channel-generate-business":
    U("1611532736597-de2d4265fba3"), // YouTube / content creator
  "linkedin-marketing-b2b-pakistan-lead-generation-2026":
    U("1556742049-0cfed4f6a45d"), // professional / LinkedIn
  "mobile-app-development-pakistan-cost-timeline-choose-team":
    U("1512941937938-a272b6cd7bf6"), // mobile app development / code

  // ── existing 40 articles ───────────────────────────────────────────────────
  "ai-automation-transforming-digital-marketing":
    U("1677442135703-1787eea5ce01"), // AI / neural network
  "whatsapp-ai-chatbots-complete-guide-pakistani-businesses":
    U("1577563908411-5077b6dc7624"), // WhatsApp / messaging
  "meta-ads-mastery-scale-business-facebook-instagram":
    U("1563986768609-322da13575f3"), // Meta / Facebook ads
  "seo-2025-business-owner-ranking-guide":
    U("1571721795195-a2ca2d3370e9"), // SEO / search engine
  "high-converting-website-generates-leads":
    U("1460925895917-afdab827c52f"), // website / laptop
  "ai-chatbots-vs-human-support-right-balance":
    U("1531746790731-6c087fecd65a"), // AI chatbot / robot
  "proven-strategies-generate-leads-digital-marketing":
    U("1551434678-e076c223a692"), // lead generation / funnel
  "social-media-marketing-guide-pakistani-businesses-2025":
    U("1611162617474-5b21e879e113"), // social media
  "why-business-needs-lms-learning-management-system":
    U("1516321318423-f06f85e504b3"), // e-learning / LMS
  "google-ads-vs-meta-ads-right-platform":
    U("1432888622747-4eb9a8efeb07"), // ads / comparison
  "complete-guide-email-marketing-2025":
    U("1633265486501-34e8e8b80bf3"), // email marketing
  "local-seo-pakistani-businesses-dominate-google":
    U("1571721795195-a2ca2d3370e9"), // local SEO / Google Maps
  "building-brand-online-complete-digital-presence":
    U("1493421419110-74f4e85ba126"), // brand building
  "real-roi-ai-automation-numbers-businesses":
    U("1551288049-bebda4e38f71"), // ROI / analytics
  "whatsapp-business-api-everything-you-need-to-know-2025":
    U("1577563908411-5077b6dc7624"), // WhatsApp
  "data-driven-marketing-analytics-smart-decisions":
    U("1504868584819-f8e8b4b6d7e3"), // data analytics
  "ecommerce-growth-hacking-strategies-pakistan":
    U("1563013544-824ae1b704d3"), // e-commerce / shopping
  "digital-marketing-uae-businesses-complete-2025":
    U("1518684079-3149a4756a76"), // Dubai / UAE skyline
  "content-marketing-strategy-build-authority":
    U("1455390582262-044cdead277a"), // content writing / strategy
  "growth-marketing-startups-zero-to-10000-customers":
    U("1559136555-9303baea8ebd"), // startup growth / rocket
  "ai-agents-2025-autonomous-business-workflows":
    U("1677442135703-1787eea5ce01"), // AI agents
  "ai-powered-seo-2025-complete-strategy-guide":
    U("1571721795195-a2ca2d3370e9"), // SEO strategy
  "whatsapp-ai-chatbot-business-2025-guide":
    U("1577563908411-5077b6dc7624"), // WhatsApp chatbot
  "meta-ads-ai-5x-roas-strategy-2025":
    U("1563986768609-322da13575f3"), // Meta ads ROAS
  "generative-ai-content-marketing-scale-quality":
    U("1499750310107-5fef28a66643"), // content creation / writing
  "ai-automation-pakistani-businesses-where-to-start":
    U("1485827404703-89b55fcc595e"), // AI automation / Pakistan
  "large-language-models-explained-business-guide-gpt4-claude-gemini":
    U("1677442135703-1787eea5ce01"), // LLMs / AI
  "ai-ecommerce-automation-strategies-increase-revenue":
    U("1563013544-824ae1b704d3"), // e-commerce AI
  "future-web-development-ai-generated-interfaces-2025":
    U("1467232004584-a241de8bcf5d"), // web development future
  "ai-analytics-business-intelligence-real-time-decisions":
    U("1504868584819-f8e8b4b6d7e3"), // analytics / BI
  "ai-digital-marketing-2026-complete-strategy-guide":
    U("1677442135703-1787eea5ce01"), // AI marketing 2026
  "marketing-automation-ai-scale-business":
    U("1485827404703-89b55fcc595e"), // marketing automation
  "digital-marketing-agency-lahore-why-bitsol-marketing":
    U("1587560699334-cc4ff634909f"), // Lahore / Pakistan business
  "ai-chatbot-customer-service-cut-costs":
    U("1531746790731-6c087fecd65a"), // AI customer service
  "seo-services-pakistan-2026-ranking-guide":
    U("1571721795195-a2ca2d3370e9"), // SEO Pakistan
  "google-ai-overviews-search-generative-experience":
    U("1573804633927-bfcbcd909acd"), // Google / search AI
  "first-party-data-marketing-cdp-strategy":
    U("1504868584819-f8e8b4b6d7e3"), // data / privacy
  "performance-marketing-pakistan-complete-guide":
    U("1551288049-bebda4e38f71"), // performance marketing
  "algorithmic-trading-bot-ai-transforming-trading":
    U("1611974789855-9c2a0a7236a3"), // trading / finance charts
  "ai-automation-smes-pakistan-where-to-start":
    U("1485827404703-89b55fcc595e"), // SME automation Pakistan
};

async function patchImage(slug, imageUrl) {
  const res = await fetch(`${API_BASE}/${slug}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
    },
    body: JSON.stringify({ image: imageUrl }),
  });
  return res;
}

async function run() {
  const entries = Object.entries(imageMap);
  console.log(`\nPatching images on ${entries.length} posts...\n`);

  let ok = 0, fail = 0;

  for (const [slug, imageUrl] of entries) {
    const res = await patchImage(slug, imageUrl);
    if (res.ok) {
      console.log(`✅  ${slug}`);
      ok++;
    } else {
      const text = await res.text();
      console.error(`❌  ${slug} — HTTP ${res.status}: ${text.slice(0, 80)}`);
      fail++;
    }
  }

  console.log(`\n── Summary ──────────────────────`);
  console.log(`Patched : ${ok}`);
  console.log(`Failed  : ${fail}`);
  console.log(`─────────────────────────────────\n`);
}

run();
