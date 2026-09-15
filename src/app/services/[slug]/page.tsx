import { notFound } from "next/navigation";
import { services } from "@/lib/services";
import { GlowingCard } from "@/components/ui/glowing-card";
import { ContactForm } from "@/components/ContactForm";
import Link from "next/link";
import { CheckCircle2, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";

export async function generateStaticParams() {
  return services.map((service) => ({
    slug: service.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);
  if (!service) return {};

  return {
    title: service.metaTitle,
    description: service.metaDescription,
    alternates: {
      canonical: `https://bitsolmarketing.com/services/${slug}`,
    },
    openGraph: {
      title: service.metaTitle,
      description: service.metaDescription,
      url: `https://bitsolmarketing.com/services/${slug}`,
      images: [
        {
          url: "https://bitsolmarketing.com/opengraph-image",
          width: 1200,
          height: 630,
          alt: "BITSOL Marketing — AI Digital Marketing Agency",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: service.metaTitle,
      description: service.metaDescription,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = services.find((s) => s.slug === slug);

  if (!service) {
    notFound();
  }

  const Icon = service.icon;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: service.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.metaDescription,
    provider: {
      "@type": "Organization",
      name: "BITSOL Marketing PVT LTD",
      url: "https://bitsolmarketing.com",
    },
    areaServed: ["PK", "AE", "US", "Global"],
    url: `https://bitsolmarketing.com/services/${slug}`,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://bitsolmarketing.com" },
      { "@type": "ListItem", position: 2, name: "Services", item: "https://bitsolmarketing.com/services" },
      { "@type": "ListItem", position: 3, name: service.title, item: `https://bitsolmarketing.com/services/${slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={faqSchema} />
      <JsonLd data={serviceSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="pt-32 pb-24">
        <div className="container mx-auto px-6">

          {/* Breadcrumb nav */}
          <nav aria-label="Breadcrumb" className="mb-12">
            <ol className="flex items-center gap-2 text-sm text-slate-500 dark:text-brand-muted flex-wrap">
              <li>
                <Link href="/" className="hover:text-brand-cyan transition-colors">Home</Link>
              </li>
              <li className="select-none">/</li>
              <li>
                <Link href="/services" className="hover:text-brand-cyan transition-colors">Services</Link>
              </li>
              <li className="select-none">/</li>
              <li className="text-slate-900 dark:text-white font-medium" aria-current="page">{service.title}</li>
            </ol>
          </nav>

          {/* Hero */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-start mb-24">
            <div>
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mb-10"
                style={{ backgroundColor: service.iconBg }}
              >
                <Icon className="w-10 h-10" style={{ color: service.iconColor }} />
              </div>
              <h1 className="text-5xl md:text-7xl font-bold mb-8 text-slate-900 dark:text-white">
                {service.title}<span className="text-brand-cyan">.</span>
              </h1>
              <p className="text-xl text-black dark:text-brand-muted leading-relaxed mb-12">
                {service.fullDesc}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {service.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-brand-cyan shrink-0" />
                    <span className="text-lg text-slate-700 dark:text-white/80">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <GlowingCard>
                <div className="p-10">
                  <h2 className="text-3xl font-bold mb-8 text-slate-900 dark:text-white text-center">
                    Start Your Project
                  </h2>
                  <ContactForm />
                </div>
              </GlowingCard>
            </div>
          </div>

          {/* Benefits */}
          <section className="mb-24">
            <h2 className="text-4xl font-bold mb-12 text-slate-900 dark:text-white">
              Why Choose BITSOL for{" "}
              <span className="text-brand-cyan">{service.title}</span>?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {service.benefits.map((benefit, i) => (
                <GlowingCard key={i}>
                  <div className="p-8 flex items-start gap-4">
                    <CheckCircle2 className="w-6 h-6 text-brand-cyan shrink-0 mt-1" />
                    <p className="text-slate-700 dark:text-white/80 leading-relaxed">{benefit}</p>
                  </div>
                </GlowingCard>
              ))}
            </div>
          </section>

          {/* Process */}
          <section className="mb-24">
            <h2 className="text-4xl font-bold mb-12 text-slate-900 dark:text-white">
              Our <span className="text-brand-cyan">Process</span>
            </h2>
            <div className="flex flex-col gap-4">
              {service.processSteps.map((step, i) => (
                <GlowingCard key={i}>
                  <div className="p-8 flex items-start gap-6">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0"
                      style={{ backgroundColor: service.iconBg, color: service.iconColor }}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-white">
                        {step.step}
                      </h3>
                      <p className="text-slate-600 dark:text-brand-muted leading-relaxed">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                </GlowingCard>
              ))}
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-24">
            <h2 className="text-4xl font-bold mb-12 text-slate-900 dark:text-white">
              Frequently Asked <span className="text-brand-cyan">Questions</span>
            </h2>
            <div className="flex flex-col gap-4">
              {service.faq.map((item, i) => (
                <GlowingCard key={i}>
                  <details className="group">
                    <summary className="p-8 flex items-center justify-between cursor-pointer list-none">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white pr-4">
                        {item.question}
                      </h3>
                      <ChevronDown className="w-5 h-5 text-brand-cyan shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-8 pb-8">
                      <p className="text-slate-600 dark:text-brand-muted leading-relaxed">
                        {item.answer}
                      </p>
                    </div>
                  </details>
                </GlowingCard>
              ))}
            </div>
          </section>

          {/* CTA */}
          <GlowingCard>
            <div className="p-12 md:p-20 text-center">
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-white">
                Ready to Get Started with{" "}
                <span className="text-brand-cyan">{service.title}</span>?
              </h2>
              <p className="text-brand-muted text-lg mb-10 max-w-2xl mx-auto">
                Book a free strategy call with our team. We&apos;ll audit your current situation and give you a clear plan — no obligation.
              </p>
              <ContactForm />
            </div>
          </GlowingCard>
        </div>
      </div>
    </>
  );
}
