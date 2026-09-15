import type { Metadata } from "next";
import Link from "next/link";
import { GlowingCard } from "@/components/ui/glowing-card";
import { ContactForm } from "@/components/ContactForm";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Digital Marketing Agency in Islamabad",
  description:
    "Digital marketing agency in Islamabad offering SEO, Meta Ads, Google Ads, web development and AI automation for Islamabad businesses. Free audit.",
  alternates: { canonical: "https://bitsolmarketing.com/digital-marketing-agency-islamabad" },
  openGraph: {
    title: "Digital Marketing Agency Islamabad | BITSOL Marketing",
    description:
      "Islamabad's top AI digital marketing agency. SEO, Meta Ads, Google Ads, AI automation, and web development. Proven results. Free strategy consultation.",
    url: "https://bitsolmarketing.com/digital-marketing-agency-islamabad",
    images: [DEFAULT_OG_IMAGE],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Which is the best digital marketing agency in Islamabad?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "BITSOL Marketing is one of Islamabad's top AI digital marketing agencies, providing SEO, Meta Ads, Google Ads, AI automation, and web development. We serve government entities, startups, and established businesses across the twin cities.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer government and B2B digital marketing in Islamabad?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. BITSOL Marketing has experience working with B2B companies, government-adjacent organisations, and professional services firms in Islamabad. We tailor our approach to formal procurement cycles and professional B2B audiences.",
      },
    },
    {
      "@type": "Question",
      name: "How does SEO work for Islamabad businesses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Local SEO for Islamabad businesses involves optimising your Google Business Profile, building local citations, creating Islamabad-specific landing pages, and targeting keywords like 'your service + Islamabad'. BITSOL uses AI keyword intelligence to identify the highest-value local searches.",
      },
    },
    {
      "@type": "Question",
      name: "Can BITSOL Marketing help with digital marketing for Rawalpindi businesses too?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. We serve the entire twin-cities area — Islamabad and Rawalpindi. Our local SEO and paid ad strategies can target both cities simultaneously for maximum coverage.",
      },
    },
  ],
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": ["LocalBusiness", "ProfessionalService"],
  "@id": "https://bitsolmarketing.com/digital-marketing-agency-islamabad#localbusiness",
  name: "BITSOL Marketing — Digital Marketing Agency Islamabad",
  description: "Result-driven digital marketing agency serving Islamabad and Rawalpindi. SEO, social media marketing, Google Ads, Meta Ads, web development, and branding.",
  url: "https://bitsolmarketing.com/digital-marketing-agency-islamabad",
  telephone: "+923103175175",
  priceRange: "$$",
  image: "https://bitsolmarketing.com/opengraph-image",
  areaServed: [
    { "@type": "City", "name": "Islamabad" },
    { "@type": "City", "name": "Rawalpindi" },
  ],
  address: {
    "@type": "PostalAddress",
    "addressLocality": "Islamabad",
    "addressCountry": "PK"
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    "name": "Digital Marketing Services in Islamabad",
    "itemListElement": [
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "SEO Services Islamabad" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Social Media Marketing Islamabad" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Google Ads Islamabad" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Meta Ads Islamabad" } },
      { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Web Development Islamabad" } },
    ]
  },
  parentOrganization: { "@id": "https://bitsolmarketing.com/#organization" },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://bitsolmarketing.com" },
    { "@type": "ListItem", position: 2, name: "Digital Marketing Agency Islamabad", item: "https://bitsolmarketing.com/digital-marketing-agency-islamabad" },
  ],
};

const services = [
  { name: "SEO Islamabad", desc: "Rank for 'your service + Islamabad' with technical SEO, local citations, and AI keyword strategy." },
  { name: "Meta Ads Islamabad", desc: "Facebook & Instagram ads targeting Islamabad and Rawalpindi audiences with precision." },
  { name: "Google Ads Islamabad", desc: "Search and display campaigns that capture high-intent buyers across the twin cities." },
  { name: "B2B Digital Marketing", desc: "LinkedIn, thought leadership content, and lead generation for Islamabad B2B companies." },
  { name: "AI Automation", desc: "WhatsApp bots, lead qualification, and workflow automation for Islamabad organisations." },
  { name: "Web Development", desc: "Professional, fast, SEO-ready websites for Islamabad businesses and government contractors." },
];

export default function IslamabadPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={localBusinessSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="pt-32 pb-24">
        <div className="container mx-auto px-6">

          <section className="text-center mb-20">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan mb-4">
              Islamabad & Rawalpindi, Pakistan
            </p>
            <h1 className="text-5xl md:text-7xl font-bold mb-8 text-slate-900 dark:text-white">
              Digital Marketing Agency{" "}
              <span className="text-gradient">Islamabad</span>
            </h1>
            <p className="text-xl text-black dark:text-brand-muted max-w-3xl mx-auto mb-12">
              BITSOL Marketing delivers AI-powered digital marketing for businesses in Islamabad and Rawalpindi. From local SEO and paid ads to AI automation and professional web development — we help twin-cities businesses grow faster, smarter, and more profitably.
            </p>
            <div className="flex flex-col md:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button variant="brand" size="lg" className="rounded-full px-10">
                  Get a Free Islamabad Audit <ArrowRight className="ml-2 w-4 h-4" />
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
              <span className="text-brand-cyan">Islamabad Businesses</span>
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
                  Why Islamabad Businesses Choose{" "}
                  <span className="text-brand-cyan">BITSOL Marketing</span>
                </h2>
                <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-brand-muted space-y-4">
                  <p>
                    Islamabad is home to Pakistan&apos;s most educated consumer base, a growing tech ecosystem, and an increasingly sophisticated B2B market. Businesses in Islamabad — from startups in I-8 to professional services firms in Blue Area — face a unique challenge: their customers are highly informed, research-driven, and expect polished digital experiences.
                  </p>
                  <p>
                    BITSOL Marketing understands the Islamabad market. We build SEO strategies that target the specific search behaviour of Islamabad&apos;s professional demographics, run LinkedIn and Google Ads campaigns optimised for B2B lead generation, and create web experiences that reflect the professionalism Islamabad clients expect.
                  </p>
                  <p>
                    Whether you are a real estate developer, an IT company, a consultancy, or a retail business, BITSOL Marketing has the AI tools and Pakistan market expertise to grow your Islamabad business online.
                  </p>
                </div>
              </div>
            </GlowingCard>
          </section>

          <section className="mb-20">
            <h2 className="text-3xl font-bold mb-10 text-slate-900 dark:text-white text-center">
              FAQs — Digital Marketing Agency Islamabad
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
                Ready to Grow Your Islamabad Business?
              </h2>
              <p className="text-brand-muted text-lg mb-10 max-w-xl mx-auto">
                Get a free digital marketing audit for your Islamabad business. No obligation, just actionable insights.
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
              <Link href="/digital-marketing-agency-lahore" className="text-brand-cyan hover:underline text-sm font-semibold">
                Digital Marketing Agency Lahore
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
