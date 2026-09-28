import { MetadataRoute } from "next";

export const dynamic = "force-static";

/**
 * The live /robots.txt is the static public/robots.txt, which shadows this
 * route. This copy stays because the admin SEO screen reads it; keep the two
 * in step.
 *
 * All crawlers share one rule group. A crawler obeys only the most specific
 * group that names it, so separate `{ userAgent: "Googlebot", allow: "/" }`
 * entries let the named crawlers ignore the /admin and /api disallows.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: [
          "*",
          // Search engines
          "Googlebot",
          "Googlebot-Image",
          "Bingbot",
          "Slurp",
          "DuckDuckBot",
          "Applebot",
          // Social link previews
          "facebookexternalhit",
          "LinkedInBot",
          "Twitterbot",
          // AI search and assistants
          "GPTBot",
          "OAI-SearchBot",
          "ChatGPT-User",
          "anthropic-ai",
          "ClaudeBot",
          "Claude-User",
          "PerplexityBot",
          "Google-Extended",
          "Applebot-Extended",
          "cohere-ai",
          "Bytespider",
        ],
        allow: "/",
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: "https://bitsolmarketing.com/sitemap.xml",
  };
}
