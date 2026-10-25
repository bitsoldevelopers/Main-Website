import EditorialHero from "@/components/home/EditorialHero";
import Partners from "@/components/home/Partners";
import ReelSection from "@/components/home/ReelSection";
import PortfolioPreview from "@/components/home/PortfolioPreview";
import ServicesGrid from "@/components/home/ServicesGrid";
import ProcessSteps from "@/components/home/ProcessSteps";
import PricingPreview from "@/components/home/PricingPreview";
import Testimonials from "@/components/home/Testimonials";
import StatsRow from "@/components/home/StatsRow";
import BlogPreview from "@/components/home/BlogPreview";
import { Eyebrow } from "@/components/home/editorial";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";
import { getHomeFaq, getHomeTestimonials } from "@/lib/cms";

export const revalidate = 60;

export const metadata: Metadata = {
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "BITSOL Marketing",
    url: SITE_URL,
    title: "BITSOL Marketing | Digital Marketing Agency in Pakistan",
    description:
      "Grow your business with BITSOL Marketing — result-driven SEO, social media marketing, Google Ads, Meta Ads, web development, and content marketing for brands in Pakistan and globally.",
    images: [DEFAULT_OG_IMAGE],
  },
};

const webPageSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${SITE_URL}/#webpage`,
  url: SITE_URL,
  name: "BITSOL Marketing | Digital Marketing Agency in Pakistan",
  isPartOf: { "@id": `${SITE_URL}/#website` },
  about: { "@id": `${SITE_URL}/#organization` },
};

function excerptFrom(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 140) + "…";
}

const expertise = [
  {
    title: "SEO & Google Business Profile",
    body: "Technical SEO, local SEO and Google Business Profile optimisation that puts your business on page one and in the Map Pack for searches in your city.",
    href: "/services/seo-optimization",
  },
  {
    title: "Meta Ads & Google Ads",
    body: "Facebook, Instagram and Google Ads campaigns for businesses across Pakistan: creative, targeting, bidding and daily optimisation for return on ad spend.",
    href: "/services/digital-marketing",
  },
  {
    title: "Social Media & Content Marketing",
    body: "Social presence and content strategies that attract your audience, build authority and turn followers into paying customers.",
    href: "/services/content-marketing",
  },
  {
    title: "Web Development & Branding",
    body: "Fast, SEO-ready websites on Next.js and complete brand identity systems: the foundation your business needs to compete online.",
    href: "/services/web-development",
  },
];

const cities = [
  { city: "Karachi", href: "/digital-marketing-agency-karachi" },
  { city: "Lahore", href: "/digital-marketing-agency-lahore" },
  { city: "Islamabad", href: "/digital-marketing-agency-islamabad" },
];

export default async function Home() {
  let blogPosts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    image: string | null;
    tags: string[];
    createdAt: Date;
  }[] = [];

  try {
    const raw = await prisma.blog.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        image: true,
        content: true,
        tags: true,
        createdAt: true,
      },
    });
    // BlogPreview is a client component, so everything passed to it is
    // serialized into the page. Sending the full article HTML added ~60KB to
    // the homepage for an excerpt the server can cut here.
    blogPosts = raw.map(({ content, ...p }) => ({
      ...p,
      excerpt: p.excerpt || excerptFrom(content),
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    }));
  } catch {
    // DB unavailable — blog section simply won't render
  }

  // CMS-managed sections; both fall back to the built-in copy when the
  // tables are empty or the database is unreachable.
  const [homepageFAQ, testimonials] = await Promise.all([getHomeFaq(), getHomeTestimonials()]);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homepageFAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <div className="relative w-full">
      <JsonLd data={webPageSchema} />
      <JsonLd data={faqSchema} />

      <EditorialHero />
      <Partners />
      <ReelSection />
      <PortfolioPreview />
      <ServicesGrid />
      <ProcessSteps />
      <PricingPreview />
      <Testimonials items={testimonials} />
      <StatsRow />
      <BlogPreview posts={blogPosts} />

      {/* Why BITSOL — keyword-rich content that search engines rely on */}
      <section className="py-24 md:py-32">
        <div className="wrap">
          <div className="max-w-[640px]">
            <Eyebrow className="mb-7">Why BITSOL</Eyebrow>
            <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">
              Pakistan&apos;s result-driven digital marketing agency
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
              BITSOL Marketing is a full-service digital marketing agency headquartered in Pakistan, helping
              businesses in Karachi, Lahore, Islamabad and globally rank higher, generate qualified leads and grow
              revenue through SEO, paid ads, social media and professional web solutions.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {expertise.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start justify-between gap-6 rounded-[28px] border border-black/[0.06] bg-white p-8 shadow-[0_1px_2px_rgba(20,20,20,0.04)] transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(20,20,20,0.3)] md:p-10"
              >
                <div>
                  <h3 className="text-[26px] leading-tight md:text-[30px]">{item.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-foreground transition-colors duration-300 group-hover:bg-foreground group-hover:text-white">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-start gap-4 md:flex-row md:items-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              Serving businesses across Pakistan
            </p>
            <div className="flex flex-wrap gap-2">
              {cities.map(({ city, href }) => (
                <Link
                  key={city}
                  href={href}
                  className="rounded-full border border-black/[0.06] bg-white px-4 py-2 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgba(20,20,20,0.04)] transition-colors hover:border-foreground"
                >
                  Digital Marketing Agency {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Homepage FAQ */}
      <section className="pb-8 pt-8 md:pb-16 md:pt-8">
        <div className="wrap grid gap-12 lg:grid-cols-[minmax(0,560px)_1fr] lg:gap-24">
          <div>
            <Eyebrow className="mb-7">FAQ</Eyebrow>
            <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">Questions? We are here to help</h2>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {homepageFAQ.map((item, i) => (
              <details key={i} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center gap-6 [&::-webkit-details-marker]:hidden">
                  <span className="w-6 shrink-0 font-heading text-[30px] leading-none text-[#c9c7c1]">{i + 1}</span>
                  {/* A span, not a heading: the site-wide serif rule on h3 would override font-sans. */}
                  <span className="flex-1 text-[16px] font-medium leading-snug text-foreground md:text-[17px]">
                    {item.question}
                  </span>
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white text-muted-foreground transition-transform duration-300 group-open:rotate-180"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </span>
                </summary>
                <p className="mt-4 pl-12 pr-16 text-[15px] leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
