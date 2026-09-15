/**
 * Cleans stored article HTML before it is rendered.
 *
 * Posts are written by several generators and pasted in over time, so the
 * stored HTML carries three problems the page template can't fix on its own:
 * a repeated <h1>, images from the shut-down source.unsplash.com service, and
 * calls to action that all link to the homepage.
 */

const SITE_URL = "https://bitsolmarketing.com";
const HOMEPAGE = /^https?:\/\/(?:www\.)?bitsolmarketing\.com\/?$/i;

/** Anchor text that means "get in touch" rather than "the BITSOL website". */
const CTA_TEXT = /contact|get in touch|talk to|let'?s talk|book |consultation|strategy (call|session)|free audit/i;
const SERVICES_TEXT = /social media marketing services|our services|marketing services/i;

function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function cleanArticleHtml(html: string, title: string): string {
  const titleText = plainText(title);

  return (
    html
      // The template already renders the post title as the page's single H1.
      // Drop an in-content H1 that repeats it, and demote any other to H2.
      .replace(/<h1(\s[^>]*)?>([\s\S]*?)<\/h1>/gi, (_match, attrs = "", inner: string) =>
        plainText(inner) === titleText ? "" : `<h2${attrs ?? ""}>${inner}</h2>`
      )
      // source.unsplash.com was retired; those images load at 0x0.
      .replace(
        /<figure\b[^>]*>(?:(?!<\/figure>)[\s\S])*?<img\b[^>]*source\.unsplash\.com[^>]*>[\s\S]*?<\/figure>/gi,
        ""
      )
      .replace(/<img\b[^>]*source\.unsplash\.com[^>]*>/gi, "")
      // Send in-article CTAs to the page that can act on them.
      .replace(
        /<a\b([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi,
        (match, before: string, href: string, after: string, inner: string) => {
          if (!HOMEPAGE.test(href)) return match;
          const text = plainText(inner);
          const target = CTA_TEXT.test(text)
            ? `${SITE_URL}/contact`
            : SERVICES_TEXT.test(text)
              ? `${SITE_URL}/services`
              : null;
          return target ? `<a${before}href="${target}"${after}>${inner}</a>` : match;
        }
      )
  );
}

/**
 * Article bylines are stored inconsistently ("BITSOL MARKETING",
 * "BITSOL Marketing Team", a person's name). Posts credited to the company
 * are an Organization, not a Person — Article markup naming an organisation
 * as a Person is invalid.
 */
export function resolveAuthor(stored: unknown): {
  name: string;
  schema: Record<string, string>;
} {
  const name = typeof stored === "string" && stored.trim() ? stored.trim() : "BITSOL Marketing";

  if (/bitsol/i.test(name)) {
    return {
      name: "BITSOL Marketing",
      schema: {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "BITSOL Marketing",
        url: SITE_URL,
      },
    };
  }

  return {
    name,
    schema: { "@type": "Person", name, url: `${SITE_URL}/about` },
  };
}
