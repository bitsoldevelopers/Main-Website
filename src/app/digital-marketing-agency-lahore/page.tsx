import type { Metadata } from "next";
import Link from "next/link";
import { GlowingCard } from "@/components/ui/glowing-card";
import { ContactForm } from "@/components/ContactForm";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Digital Marketing Agency in Lahore",
  description:
    "Digital marketing agency in Lahore offering SEO, Meta Ads, Google Ads, social media and web development for Lahore businesses. Free strategy audit.",
  alternates: { canonical: "https://bitsolmarketing.com/digital-marketing-agency-lahore" },
  openGraph: {
    title: "Digital Marketing Agency Lahore | BITSOL Marketing",
    description:
      "Lahore's leading AI digital marketing agency. SEO, Meta Ads, Google Ads, automation, web development. Trusted by 150+ businesses. Free strategy call.",
    url: "https://bitsolmarketing.com/digital-marketing-agency-lahore",
    images: [DEFAULT_OG_IMAGE],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which is the best digital marketing agency in Lahore?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BITSOL Marketing is one of Lahore's top AI digital marketing agencies offering SEO, Meta Ads, Google Ads, and growth marketing. We have delivered measurable ROI for businesses across Lahore and Pakistan.",
      },
    },
    {
      "@type": "Question",
      name: "How much do digital marketing services cost in Lahore?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Digital marketing pricing in Lahore typically starts from PKR 25,000/month for local SEO and PKR 50,000/month for paid ad management. BITSOL Marketing offers transparent, results-focused packages for every budget.",
      },
    },
    {
      "@type": "Question",
      name: "Does BITSOL Marketing provide local SEO for Lahore businesses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We specialise in local SEO for Lahore businesses. Our AI keyword research identifies the searches Lahore customers make and we optimise your Google Business Profile, website, and content to rank for them.",
      },
    },
    {
      "@type": "Question",
      name: "Can BITSOL manage social media for my Lahore business?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We provide full social media management for Lahore businesses including content creation, scheduling, community management, and paid promotion on Instagram, Facebook, and TikTok.",
      },
    },
  ],
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ProfessionalService"],
  "@id": "https://bitsolmarketing.com/digital-marketing-agency-lahore#localbusiness",
  name: "BITSOL Marketing — Digital Marketing Agency Lahore",
  description: "Result-driven digital marketing agency in Lahore. SEO, social media marketing, Google Ads, Meta Ads, web development, and Google Business Profile optimization.",
  url: "https://bitsolmarketing.com/digital-marketing-agency-lahore",
  telephone: "+923103175175",
  priceRange: "$$",
  image: "https://bitsolmarketing.com/opengraph-image",
  areaServed: [
    { "@type": "City", "name": "Lahore" },
    { "@type": "State", "name": "Punjab" },
  ],
  address: {
    "@type": "PostalAddress",
    "streetAddress": "83/3 C KB Commercial, Phase 1, DHA",
    "addressLocality": "Lahore",
    "addressRegion": "Punjab",
    "postalCode": "54792",
    "addressCountry": "PK"
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    "name": "Digital Marketing Services in Lahore",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "SEO Services Lahore" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Social Media Marketing Lahore" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Google Ads Lahore" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Meta Ads Lahore" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Web Development Lahore" } },
    ]
  },
  parentOrganization: { "@id": "https://bitsolmarketing.com/#organization" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://bitsolmarketing.com" },
    { "@type": "ListItem", position: 2, name: "Digital Marketing Agency Lahore", item: "https://bitsolmarketing.com/digital-marketing-agency-lahore" },
  ],
};

const services = [
  { name: "SEO in Lahore", desc: "Dominate local search results for 'your service + Lahore' with AI-powered technical and content SEO." },
  { name: "Meta Ads Lahore", desc: "Facebook & Instagram campaigns targeting Lahore audiences with creative that converts." },
  { name: "Google Ads Lahore", desc: "Capture high-intent Lahore buyers at the moment they search on Google." },
  { name: "AI Chatbots & Automation", desc: "WhatsApp automation and AI agents that handle lead capture and customer queries 24/7." },
  { name: "Web Development Lahore", desc: "Fast, SEO-ready websites and e-commerce stores for Lahore businesses." },
  { name: "Social Media Management", desc: "Content strategy, daily posting, and community growth across all major platforms." },
];

export default function LahorePage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="pt-32 pb-24">
        <div className="container mx-auto px-6">

          <section className="text-center mb-20">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan mb-4">
              Lahore, Pakistan
            </p>
            <h1 className="text-5xl md:text-7xl font-bold mb-8 text-slate-900 dark:text-white">
              Digital Marketing Agency{" "}
              <span className="text-gradient">Lahore</span>
            </h1>
            <p className="text-xl text-black dark:text-brand-muted max-w-3xl mx-auto mb-12">
              BITSOL Marketing is Lahore&apos;s AI-powered digital marketing agency. We grow Lahore businesses with intelligent SEO, high-ROAS paid ads, WhatsApp automation, and conversion-first web development — all measured, all accountable.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button variant="brand" size="lg" className="rounded-full px-10">
                  Get a Free Lahore Audit <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/services">
                <Button variant="outline" size="lg" className="rounded-full px-10 border-brand-purple text-slate-900 dark:text-white hover:bg-brand-purple/10">
                  View All Services
                </Button>
              </Link>
            </div>
          </section>

          <section className="mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-10 text-slate-900 dark:text-white text-center">
              Digital Marketing Services for{" "}
              <span className="text-brand-cyan">Lahore Businesses</span>
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

          <section className="mb-20">
            <GlowingCard>
              <div className="p-10 md:p-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-900 dark:text-white">
                  Why Lahore Businesses Choose{" "}
                  <span className="text-brand-cyan">BITSOL Marketing</span>
                </h2>
                <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-brand-muted space-y-4">
                  <p>
                    Lahore is Pakistan&apos;s cultural capital and one of its fastest-growing digital markets. Businesses in Lahore face intense competition from both local brands and national players — and standing out requires a marketing strategy that is smarter, more targeted, and more data-driven than what most agencies deliver.
                  </p>
                  <p>
                    BITSOL Marketing brings AI-powered precision to digital marketing in Lahore. We use machine learning to identify the exact keywords Lahore customers search, build Meta and Google ad campaigns that speak to Lahore&apos;s demographics, and deploy WhatsApp automation that converts Lahore leads 24 hours a day.
                  </p>
                  <p>
                    Our Lahore clients consistently report a 3–10x return on their marketing investment within the first 90 days. We are transparent, data-driven, and committed to your long-term growth — not just one-time campaigns.
                  </p>
                </div>
              </div>
            </GlowingCard>
          </section>

          <section className="mb-20">
            <h2 className="text-3xl font-bold mb-10 text-slate-900 dark:text-white text-center">
              FAQs — Digital Marketing Agency Lahore
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

          <GlowingCard>
            <div className="p-10 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900 dark:text-white">
                Ready to Grow Your Lahore Business?
              </h2>
              <p className="text-brand-muted text-lg mb-10 max-w-xl mx-auto">
                Book a free strategy call. We&apos;ll audit your digital presence and deliver a custom Lahore growth plan.
              </p>
              <ContactForm />
            </div>
          </GlowingCard>

          <div className="mt-16 text-center">
            <p className="text-sm text-brand-muted mb-4">We also serve businesses in:</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/digital-marketing-agency-karachi" className="text-brand-cyan hover:underline text-sm font-semibold">
                Digital Marketing Agency Karachi
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
