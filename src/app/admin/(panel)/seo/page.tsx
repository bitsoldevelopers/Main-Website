import type { Metadata } from "next";
import { ExternalLink, Globe, Image as ImageIcon, MapPin, ShieldCheck } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getBlogSeoGaps } from "@/lib/admin/queries";
import { SITE_URL } from "@/lib/seo";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { Callout, DbUnavailable, KeyValue, PageHeader, Panel, Pill, StatCard, btn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { BarList } from "@/components/admin/BarList";

export const metadata: Metadata = { title: "SEO & Site" };

const cityPages = [
  { city: "Lahore", href: "/digital-marketing-agency-lahore" },
  { city: "Karachi", href: "/digital-marketing-agency-karachi" },
  { city: "Islamabad", href: "/digital-marketing-agency-islamabad" },
];

const quickLinks = [
  { label: "sitemap.xml", href: "/sitemap.xml", note: "Generated per request from services, portfolio and published posts" },
  { label: "robots.txt", href: "/robots.txt", note: "Static; AI crawlers explicitly allowed" },
  { label: "llms.txt", href: "/llms.txt", note: "Guide for AI assistants (public/llms.txt)" },
  { label: "opengraph-image", href: "/opengraph-image", note: "Default social preview, rendered from app/opengraph-image.tsx" },
  { label: "logo.png", href: "/logo.png", note: "Organization logo used in schema markup" },
  { label: "api/blog/health", href: "/api/blog/health", note: "Post counts straight from the database" },
];

function classify(url: string): "blog" | "service" | "portfolio" | "static" {
  const path = url.replace(SITE_URL, "");
  if (path.startsWith("/blog/")) return "blog";
  if (path.startsWith("/services/")) return "service";
  if (path.startsWith("/portfolio/")) return "portfolio";
  return "static";
}

export default async function SeoPage() {
  await requireAdminPage("seo.write");
  const [entries, gaps] = await Promise.all([sitemap(), getBlogSeoGaps()]);
  const robotsConfig = robots();
  const rules = Array.isArray(robotsConfig.rules) ? robotsConfig.rules : [robotsConfig.rules];

  const counts = { static: 0, service: 0, portfolio: 0, blog: 0 };
  for (const entry of entries) counts[classify(entry.url)] += 1;
  const sitemapDegraded = entries.length <= 1;

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="SEO & Site"
        description="The plumbing search engines and AI assistants see: sitemap, robots, structured data and tracking. Numbers here are computed live from the same code that serves the public files."
      />

      {sitemapDegraded && (
        <Callout tone="amber" className="mb-6" title="Sitemap is serving its fallback">
          The database could not be reached, so /sitemap.xml currently lists only the homepage. It recovers on its own once
          the connection is back.
        </Callout>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="URLs in sitemap" value={entries.length} hint="What /sitemap.xml lists right now" icon={Globe} />
        <StatCard label="Service pages" value={counts.service} hint="From src/lib/services.ts" tone="purple" />
        <StatCard label="Portfolio pages" value={counts.portfolio} hint="From src/lib/portfolio.ts" tone="slate" />
        <StatCard label="Blog URLs" value={counts.blog} hint="Published posts only" tone="green" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Sitemap composition" description="Static pages exclude the five noindex legal pages and /admin">
          <BarList
            items={[
              { label: "Blog articles", value: counts.blog },
              { label: "Static pages", value: counts.static },
              { label: "Portfolio", value: counts.portfolio },
              { label: "Services", value: counts.service },
            ]}
          />
        </Panel>

        <Panel title="Blog SEO gaps" description="Published posts missing fields the article template relies on">
          {!gaps.ok ? (
            <DbUnavailable error={gaps.error} />
          ) : (
            <>
              <BarList
                items={[
                  { label: "No meta description", value: gaps.data.missingMeta, title: "Falls back to the excerpt, then the title" },
                  { label: "No excerpt", value: gaps.data.missingExcerpt, title: "Cards fall back to the first 160 characters" },
                  { label: "No featured image", value: gaps.data.missingImage, title: "Social previews fall back to the default OG image" },
                  { label: "No tags", value: gaps.data.untagged, title: "Cards show the AI Marketing label instead" },
                ]}
              />
              <p className="mt-4 text-xs text-slate-500">Out of {gaps.data.published} published posts. Fix them from the Blog editor.</p>
            </>
          )}
        </Panel>

        <Panel bodyClassName="p-0" title="robots.txt rules" description="src/app/robots.ts">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr>
                  <th className={thClass}>User agent</th>
                  <th className={thClass}>Allow</th>
                  <th className={thClass}>Disallow</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, i) => {
                  const agents = Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? "*"];
                  const allow = Array.isArray(rule.allow) ? rule.allow : rule.allow ? [rule.allow] : [];
                  const disallow = Array.isArray(rule.disallow) ? rule.disallow : rule.disallow ? [rule.disallow] : [];
                  return (
                    <tr key={i} className={trClass}>
                      <td className={`${tdClass} font-mono text-xs text-slate-900`}>{agents.join(", ")}</td>
                      <td className={`${tdClass} font-mono text-xs text-emerald-700/90`}>{allow.join(", ") || "—"}</td>
                      <td className={`${tdClass} font-mono text-xs text-amber-700/90`}>{disallow.join(", ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Structured data & tracking" description="Defined once in src/app/layout.tsx">
          <KeyValue
            items={[
              { label: "Organization", value: "Organization + LocalBusiness + ProfessionalService, with OfferCatalog of 8 services and two contact points" },
              { label: "Website", value: "WebSite node linked to the organization" },
              { label: "Per page", value: "FAQPage on the homepage and city pages; Article + BreadcrumbList on every blog post; LocalBusiness on city pages" },
              { label: "Google Tag Manager", value: <span className="font-mono text-xs">GTM-KMPSR8SX</span> },
              { label: "GA4", value: <span className="font-mono text-xs">G-J473YSMZKE</span> },
              { label: "Search Console", value: <Pill tone="green"><ShieldCheck className="h-3 w-3" /> verification meta tag present</Pill> },
              { label: "Canonical host", value: "www redirects to bitsolmarketing.com (next.config.ts)" },
              { label: "Security headers", value: "HSTS, nosniff, SAMEORIGIN, referrer policy, permissions policy, report-only CSP" },
            ]}
          />
        </Panel>

        <Panel title="City landing pages" description="Local SEO pages with their own FAQ and LocalBusiness schema">
          <ul className="space-y-2">
            {cityPages.map((page) => (
              <li key={page.href} className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-cyan-700" />
                <span className="font-semibold text-slate-900">Digital Marketing Agency {page.city}</span>
                <a href={page.href} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-slate-500 hover:text-slate-900">
                  {page.href} <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Blog posts that mention a city automatically link to its page (src/lib/blog-links.ts).
          </p>
        </Panel>

        <Panel title="Public SEO files" description="Open in a new tab">
          <ul className="space-y-2">
            {quickLinks.map((link) => (
              <li key={link.href} className="flex items-start gap-3 text-sm">
                <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <span className="min-w-0 flex-1">
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-cyan-700 hover:underline">
                    {SITE_URL}{link.href}
                  </a>
                  <span className="block text-xs text-slate-500">{link.note}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              Search Console <ExternalLink className="h-4 w-4" />
            </a>
            <a href={`https://pagespeed.web.dev/analysis?url=${encodeURIComponent(SITE_URL)}`} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              PageSpeed Insights <ExternalLink className="h-4 w-4" />
            </a>
            <a href={`https://validator.schema.org/#url=${encodeURIComponent(SITE_URL)}`} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              Schema validator <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </Panel>
      </div>
    </>
  );
}
