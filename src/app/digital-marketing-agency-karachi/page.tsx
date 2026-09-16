import type { Metadata } from "next";
import Link from "next/link";
import { GlowingCard } from "@/components/ui/glowing-card";
import { ContactForm } from "@/components/ContactForm";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Digital Marketing Agency in Karachi",
  description:
    "Digital marketing agency in Karachi offering SEO, Meta Ads, Google Ads, social media management and web development for Karachi businesses. Free audit.",
  alternates: { canonical: "https://bitsolmarketing.com/digital-marketing-agency-karachi" },
  openGraph: {
    title: "Digital Marketing Agency Karachi | BITSOL Marketing",
    description:
      "Karachi's leading AI digital marketing agency. SEO, Meta Ads, Google Ads, automation, web development. Trusted by 150+ businesses. Free strategy call.",
    url: "https://bitsolmarketing.com/digital-marketing-agency-karachi",
    images: [DEFAULT_OG_IMAGE],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which is the best digital marketing agency in Karachi?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BITSOL Marketing is consistently rated among the top digital marketing agencies in Karachi for AI-powered SEO, Meta Ads, and growth marketing. We have delivered measurable results for 150+ businesses across Pakistan.",
      },
    },
    {
      "@type": "Question",
      name: "How much does digital marketing cost in Karachi?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Digital marketing services in Karachi range from PKR 25,000/month for basic SEO to PKR 300,000+/month for full-service campaigns including paid ads, content, and automation. BITSOL Marketing offers packages for every business size.",
      },
    },
    {
      "@type": "Question",
      name: "Does BITSOL Marketing offer SEO services in Karachi?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. BITSOL Marketing provides local SEO, technical SEO, and content SEO for businesses in Karachi. We use AI-powered keyword intelligence to rank Karachi businesses on page one of Google.",
      },
    },
    {
      "@type": "Question",
      name: "Can a Karachi business get Meta Ads management from BITSOL?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We manage Facebook and Instagram (Meta) ad campaigns for Karachi businesses. Our team handles creative production, audience targeting, A/B testing, and daily budget optimisation.",
      },
    },
  ],
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ProfessionalService"],
  "@id": "https://bitsolmarketing.com/digital-marketing-agency-karachi#localbusiness",
  name: "BITSOL Marketing — Digital Marketing Agency Karachi",
  description: "Result-driven digital marketing agency serving businesses in Karachi. SEO, social media marketing, Google Ads, Meta Ads, web development, and Google Business Profile optimization.",
  url: "https://bitsolmarketing.com/digital-marketing-agency-karachi",
  telephone: "+923103175175",
  priceRange: "$$",
  image: DEFAULT_OG_IMAGE.url,
  areaServed: [
    { "@type": "City", "name": "Karachi" },
    { "@type": "State", "name": "Sindh" },
  ],
  address: {
    "@type": "PostalAddress",
    "addressLocality": "Karachi",
    "addressRegion": "Sindh",
    "addressCountry": "PK"
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    "name": "Digital Marketing Services in Karachi",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "SEO Services Karachi" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Social Media Marketing Karachi" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Google Ads Karachi" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Meta Ads Karachi" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Web Development Karachi" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Google Business Profile Optimization Karachi" } },
    ]
  },
  parentOrganization: { "@id": "https://bitsolmarketing.com/#organization" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://bitsolmarketing.com" },
    { "@type": "ListItem", position: 2, name: "Digital Marketing Agency Karachi", item: "https://bitsolmarketing.com/digital-marketing-agency-karachi" },
  ],
};

const services = [
  { name: "SEO in Karachi", desc: "Rank on page one of Google for 'your service + Karachi' searches with AI-powered local SEO." },
  { name: "Meta Ads Karachi", desc: "Facebook & Instagram ad campaigns targeting Karachi audiences by interest, location, and behaviour." },
  { name: "Google Ads Karachi", desc: "High-intent search ads that put BITSOL clients at the top of Google when Karachi buyers are searching." },
  { name: "AI Automation", desc: "WhatsApp bots, lead qualification agents, and workflow automation built for Karachi businesses." },
  { name: "Web Development", desc: "Fast, SEO-ready Next.js websites and e-commerce stores built for Karachi's competitive market." },
  { name: "Social Media Management", desc: "Daily content, community management, and growth strategy for Instagram, Facebook, and TikTok." },
];

export default function KarachiPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="pt-32 pb-24">
        <div className="container mx-auto px-6">

          {/* Hero */}
          <section className="text-center mb-20">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan mb-4">
              Karachi, Pakistan
            </p>
            <h1 className="text-5xl md:text-7xl font-bold mb-8 text-slate-900 dark:text-white">
              Digital Marketing Agency{" "}
              <span className="text-gradient">Karachi</span>
            </h1>
            <p className="text-xl text-black dark:text-brand-muted max-w-3xl mx-auto mb-12">
              BITSOL Marketing is Karachi&apos;s premier AI digital marketing agency. We help Karachi businesses grow online with AI-powered SEO, Meta Ads, Google Ads, automation, and web development — all backed by data and built for results.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button variant="brand" size="lg" className="rounded-full px-10">
                  Get a Free Karachi Audit <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/services">
                <Button variant="outline" size="lg" className="rounded-full px-10 border-brand-purple text-slate-900 dark:text-white hover:bg-brand-purple/10">
                  View All Services
                </Button>
              </Link>
            </div>
          </section>

          {/* Services */}
          <section className="mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-10 text-slate-900 dark:text-white text-center">
              Digital Marketing Services for{" "}
              <span className="text-brand-cyan">Karachi Businesses</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((svc, i) => (
                <GlowingCard key={i}>
                  <div className="p-8 flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-brand-cyan shrink-0 mt-1" />
                    <div>
                      <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">{svc.name}</h3>
                      <p className="text-slate-600 dark:text-brand-muted text-sm leading-relaxed">{svc.desc}</p>
                    </div>
                  </div>
                </GlowingCard>
              ))}
            </div>
          </section>

          {/* Why BITSOL in Karachi */}
          <section className="mb-20">
            <GlowingCard>
              <div className="p-10 md:p-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-900 dark:text-white">
                  Why Karachi Businesses Choose{" "}
                  <span className="text-brand-cyan">BITSOL Marketing</span>
                </h2>
                <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-brand-muted space-y-4">
                  <p>
                    Karachi is Pakistan&apos;s economic capital — and its most competitive digital market. With millions of consumers online and thousands of businesses vying for their attention, you need a digital marketing partner who understands the Karachi audience, the local competitive landscape, and the algorithms that determine who gets found and who gets ignored.
                  </p>
                  <p>
                    BITSOL Marketing has helped 150+ businesses across Pakistan grow their digital presence. Our Karachi clients benefit from AI-powered SEO that targets high-intent local searches, Meta Ads campaigns optimised for Karachi demographics, and conversion-focused landing pages built to turn Karachi web traffic into paying customers.
                  </p>
                  <p>
                    We are not a generic template agency. Every strategy we build is specific to your business, your Karachi target audience, and your growth goals. Our team is available for in-person meetings and strategy sessions in Karachi — we are a local partner, not a distant vendor.
                  </p>
                </div>
              </div>
            </GlowingCard>
          </section>

          {/* FAQ */}
          <section className="mb-20">
            <h2 className="text-3xl font-bold mb-10 text-slate-900 dark:text-white text-center">
              FAQs — Digital Marketing Agency Karachi
            </h2>
            <div className="flex flex-col gap-4">
              {faqSchema.mainEntity.map((item, i) => (
                <GlowingCard key={i}>
                  <details className="group">
                    <summary className="p-6 flex items-center justify-between cursor-pointer list-none">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white pr-4">{item.name}</h3>
                      <span className="text-brand-cyan shrink-0 text-xl font-light group-open:rotate-45 transition-transform inline-block">+</span>
                    </summary>
                    <div className="px-6 pb-6">
                      <p className="text-slate-600 dark:text-brand-muted leading-relaxed">{item.acceptedAnswer.text}</p>
                    </div>
                  </details>
                </GlowingCard>
              ))}
            </div>
          </section>

          {/* CTA */}
          <GlowingCard>
            <div className="p-10 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900 dark:text-white">
                Ready to Grow Your Karachi Business?
              </h2>
              <p className="text-brand-muted text-lg mb-10 max-w-xl mx-auto">
                Book a free strategy call. We&apos;ll audit your digital presence and show you exactly how to win in Karachi&apos;s competitive market.
              </p>
              <ContactForm />
            </div>
          </GlowingCard>

          {/* Internal links to other city pages */}
          <div className="mt-16 text-center">
            <p className="text-sm text-brand-muted mb-4">We also serve businesses in:</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/digital-marketing-agency-lahore" className="text-brand-cyan hover:underline text-sm font-semibold">
                Digital Marketing Agency Lahore
              </Link>
              <Link href="/digital-marketing-agency-islamabad" className="text-brand-cyan hover:underline text-sm font-semibold">
                Digital Marketing Agency Islamabad
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
