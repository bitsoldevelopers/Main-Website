import { services } from "@/lib/services";

export interface RelatedLink {
  title: string;
  href: string;
  desc: string;
}

/**
 * Articles used to link only to the homepage, so nothing passed authority to
 * the pages that actually sell. Match a post to the services it talks about,
 * by keyword, and let the template link to them.
 *
 * Order matters: the first pattern that matches a phrase wins, so the more
 * specific topics come first.
 */
const SERVICE_KEYWORDS: [RegExp, string][] = [
  [/whatsapp|chat ?bot|ai agent|ai assistant|voice agent|automation|workflow|crm integration/i, "ai-automation"],
  [/trading|psx|pmex|crypto|forex|binance|algorithmic/i, "trading-tech"],
  [/mobile app|ios app|android app|flutter|app development/i, "mobile-apps"],
  [/\bseo\b|search engine|google maps|google business|local search|keyword|backlink|ranking/i, "seo-optimization"],
  [/website|web development|shopify|woocommerce|next\.?js|wordpress|landing page|e-?commerce|page speed|web design/i, "web-development"],
  [/content marketing|blogging|blog post|copywriting|email marketing|newsletter/i, "content-marketing"],
  [/branding|brand identity|logo design|visual identity/i, "branding"],
  [/meta ads|facebook ads|instagram ads|google ads|ppc|paid ads|social media|lead generation|digital marketing|marketing agency|roas|conversion/i, "digital-marketing"],
];

const CITY_PAGES: [RegExp, RelatedLink][] = [
  [
    /\blahore\b/i,
    {
      title: "Digital Marketing Agency in Lahore",
      href: "/digital-marketing-agency-lahore",
      desc: "SEO, ads and web development for Lahore businesses.",
    },
  ],
  [
    /\bkarachi\b/i,
    {
      title: "Digital Marketing Agency in Karachi",
      href: "/digital-marketing-agency-karachi",
      desc: "SEO, ads and web development for Karachi businesses.",
    },
  ],
  [
    /\bislamabad\b/i,
    {
      title: "Digital Marketing Agency in Islamabad",
      href: "/digital-marketing-agency-islamabad",
      desc: "SEO, ads and web development for Islamabad businesses.",
    },
  ],
];

/** Services every post can fall back to when nothing else matches. */
const FALLBACK_SLUGS = ["digital-marketing", "seo-optimization"];

export function relatedLinks(post: {
  title: string;
  tags?: unknown;
  excerpt?: string | null;
}): RelatedLink[] {
  const tags = Array.isArray(post.tags) ? (post.tags as string[]).join(" ") : "";
  const haystack = `${post.title} ${tags} ${post.excerpt ?? ""}`;

  const slugs: string[] = [];
  for (const [pattern, slug] of SERVICE_KEYWORDS) {
    if (pattern.test(haystack) && !slugs.includes(slug)) slugs.push(slug);
    if (slugs.length === 3) break;
  }
  if (slugs.length === 0) slugs.push(...FALLBACK_SLUGS);

  const links: RelatedLink[] = slugs.flatMap((slug) => {
    const service = services.find((s) => s.slug === slug);
    return service
      ? [{ title: service.title, href: `/services/${service.slug}`, desc: service.desc }]
      : [];
  });

  const city = CITY_PAGES.find(([pattern]) => pattern.test(haystack));
  if (city) links.push(city[1]);

  return links;
}
