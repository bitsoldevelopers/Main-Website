import Hero from "@/components/hero/Hero";
import Partners from "@/components/home/Partners";
import ServicesGrid from "@/components/home/ServicesGrid";
import Testimonials from "@/components/home/Testimonials";
import PortfolioPreview from "@/components/home/PortfolioPreview";
import BlogPreview from "@/components/home/BlogPreview";
import { Button } from "@/components/ui/button";
import { GlowingCard } from "@/components/ui/glowing-card";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import { prisma } from "@/lib/prisma";

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

const homepageFAQ = [
  {
    question: "What digital marketing services does BITSOL Marketing offer in Pakistan?",
    answer: "BITSOL Marketing offers a complete range of digital marketing services in Pakistan: SEO, social media marketing, Google Ads, Meta Ads (Facebook & Instagram), web development, content marketing, Google Business Profile optimization, and branding. We serve businesses in Karachi, Lahore, Islamabad, and internationally.",
  },
  {
    question: "How do SEO services from BITSOL Marketing help my business rank on Google?",
    answer: "We run a full SEO process — technical audit, keyword research, on-page optimisation, content production, and link building. We also optimise your Google Business Profile so your business ranks in the Google Map Pack for local searches. Most clients see first-page rankings for local keywords within 60–90 days.",
  },
  {
    question: "Does BITSOL Marketing manage Google Ads and Meta Ads campaigns?",
    answer: "Yes. Paid media management is a core BITSOL service. We manage Google Search, Display, Shopping, and Performance Max campaigns alongside Meta Ads (Facebook + Instagram) for Pakistani businesses. We handle creative, audience targeting, bidding, and daily optimisation — with transparent weekly reporting.",
  },
  {
    question: "Can BITSOL Marketing build a professional website for my business?",
    answer: "Yes. Our web development team builds fast, mobile-responsive, SEO-optimised websites and web applications on Next.js, React, and WordPress. Every site includes proper schema markup, Core Web Vitals compliance, and conversion-optimised design. We serve businesses in Karachi, Lahore, Islamabad, and the UAE.",
  },
  {
    question: "What is Google Business Profile optimization and why does it matter?",
    answer: "Google Business Profile (GBP) optimization means setting up and fully completing your free Google listing so your business appears in Google Maps and the Local Pack when people search for your services nearby. BITSOL's local SEO team optimises your GBP profile, manages reviews, publishes regular posts, and builds local citations to maximise your visibility in local search.",
  },
  {
    question: "How do I get a free consultation from BITSOL Marketing?",
    answer: "Click the 'Get Free Consultation' button on this page or visit our Contact page. You can book a call directly or message us on WhatsApp. We'll review your current digital presence, identify the highest-ROI opportunities, and propose a tailored growth plan — with no obligation.",
  },
];

export default async function Home() {
  let blogPosts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string;
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
        content: true,
        tags: true,
        createdAt: true,
      },
    });
    blogPosts = raw.map((p) => ({
      ...p,
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    }));
  } catch {
    // DB unavailable — blog section simply won't render
  }

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
      <Hero />
      <Partners />
      
      {/* Services Section */}
      <ServicesGrid />

      {/* About CTA Section */}
      <section className="py-24 bg-transparent relative z-10">
        <div className="container mx-auto px-6">
          <GlowingCard>
            <div className="p-12 md:p-20 relative overflow-hidden flex flex-col md:flex-row items-center gap-12">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/10 blur-[100px]" />
              
              <div className="flex-1">
                <h2 className="text-4xl md:text-5xl font-bold mb-8 text-slate-900 dark:text-white">
                  Building <span className="text-gradient">Intelligent</span> Business Infrastructures
                </h2>
                <p className="text-brand-muted text-lg mb-10 leading-relaxed">
                  We specialize in architecting scalable digital ecosystems that integrate AI, high-performance web tech, and data-driven marketing strategies to drive exponential growth.
                </p>
                <Link href="/about">
                  <Button variant="brand-purple" size="lg" className="rounded-full px-10 py-6">
                    Meet Our Architects
                  </Button>
                </Link>
              </div>
              
              <div className="flex-1 grid grid-cols-2 gap-4">
                {[
                  { label: "AI Experts", val: "25+" },
                  { label: "Successful Projects", val: "150+" },
                  { label: "Lines of Code", val: "2M+" },
                  { label: "Satisfied Clients", val: "98%" },
                ].map((stat, i) => (
                  <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-2xl text-center">
                    <div className="text-3xl font-bold text-brand-cyan mb-2">{stat.val}</div>
                    <div className="text-xs uppercase tracking-widest text-black dark:text-brand-muted">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </GlowingCard>
        </div>
      </section>

      <Testimonials />

      {/* Portfolio Preview */}
      <PortfolioPreview />

      {/* Blog Preview */}
      <BlogPreview posts={blogPosts} />

      {/* Why BITSOL — SEO keyword-rich content section */}
      <section className="py-24 bg-transparent relative z-10">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white">
              Pakistan&apos;s Result-Driven <span className="text-gradient">Digital Marketing Agency</span>
            </h2>
            <p className="text-lg text-black dark:text-brand-muted max-w-3xl mx-auto">
              BITSOL Marketing is a full-service digital marketing agency headquartered in Pakistan, helping businesses in Karachi, Lahore, Islamabad, and globally rank higher, generate qualified leads, and grow revenue through SEO, paid ads, social media, and professional web solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {[
              {
                title: "SEO & Google Business Profile",
                body: "We deliver technical SEO, local SEO, and Google Business Profile optimization that ranks your business on page one of Google and in the Google Map Pack for searches in your city.",
                href: "/services/seo-optimization",
              },
              {
                title: "Meta Ads & Google Ads",
                body: "We manage Facebook, Instagram, and Google Ads campaigns for businesses across Pakistan — creative, targeting, bidding, and daily optimisation for maximum ROAS.",
                href: "/services/digital-marketing",
              },
              {
                title: "Social Media & Content Marketing",
                body: "We build social media presence and content strategies that attract your target audience, build brand authority, and convert followers into paying customers.",
                href: "/services/content-marketing",
              },
              {
                title: "Web Development & Branding",
                body: "From fast, SEO-optimised websites on Next.js to complete brand identity systems, we build the digital foundation your business needs to compete and grow online.",
                href: "/services/web-development",
              },
            ].map((item, i) => (
              <Link key={i} href={item.href}>
                <GlowingCard>
                  <div className="p-8 flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-brand-cyan shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{item.title}</h3>
                      <p className="text-slate-600 dark:text-brand-muted leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </GlowingCard>
              </Link>
            ))}
          </div>

          {/* City targeting */}
          <div className="text-center mb-6">
            <p className="text-brand-muted text-sm uppercase tracking-widest font-semibold mb-4">Serving Businesses Across Pakistan</p>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                { city: "Karachi", href: "/digital-marketing-agency-karachi" },
                { city: "Lahore", href: "/digital-marketing-agency-lahore" },
                { city: "Islamabad", href: "/digital-marketing-agency-islamabad" },
              ].map(({ city, href }) => (
                <Link
                  key={city}
                  href={href}
                  className="px-6 py-2 rounded-full border border-brand-cyan/30 text-brand-cyan text-sm font-semibold hover:bg-brand-cyan/10 transition-colors"
                >
                  Digital Marketing Agency {city}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Homepage FAQ */}
      <section className="py-16 bg-transparent relative z-10">
        <div className="container mx-auto px-6 max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-10 text-slate-900 dark:text-white text-center">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h2>
          <div className="flex flex-col gap-4">
            {homepageFAQ.map((item, i) => (
              <GlowingCard key={i}>
                <details className="group">
                  <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white pr-4">{item.question}</h3>
                    <span className="text-brand-cyan shrink-0 text-xl font-light group-open:rotate-45 transition-transform inline-block">+</span>
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="text-slate-600 dark:text-brand-muted leading-relaxed">{item.answer}</p>
                  </div>
                </details>
              </GlowingCard>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 bg-transparent text-center border-t border-slate-200 dark:border-white/5">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl md:text-6xl font-bold mb-10 text-slate-900 dark:text-white">
            Ready to <span className="text-gradient">Grow Your Business</span>?
          </h2>
          <p className="text-black dark:text-brand-muted text-xl max-w-2xl mx-auto mb-12">
            Get a free consultation and discover which digital marketing services will generate the most growth for your business.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
             <Link href="/contact">
               <Button variant="brand" size="lg" className="rounded-full px-12 py-8 text-xl font-bold">
                  Get Free Consultation
               </Button>
             </Link>
             <Link href="/pricing">
               <Button variant="outline" size="lg" className="border-brand-purple text-slate-900 dark:text-brand-white hover:bg-brand-purple/10 rounded-full px-12 py-8 text-xl font-bold">
                  View Packages
               </Button>
             </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
