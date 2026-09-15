import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, User, Clock, Tag } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { GlowingCard } from "@/components/ui/glowing-card";
import { JsonLd } from "@/components/JsonLd";
import { cleanArticleHtml, resolveAuthor } from "@/lib/blog-content";
import { relatedLinks } from "@/lib/blog-links";
import { clampDescription, DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";
import type { Metadata } from "next";
import Image from "next/image";

// Articles were rendered on every request, which meant a database query and a
// full render per hit and no cacheable HTML at the CDN. Serve them from the
// ISR cache instead; writes through the blog API and the admin revalidate the
// affected URL, and anything else is picked up within the hour.
export const revalidate = 3600;

// Empty list: nothing is prerendered at build time, each post is generated on
// first request and then cached.
export async function generateStaticParams() {
  return [];
}

/** Deduplicates the query between generateMetadata and the page render. */
const getPost = cache(async (slug: string) => prisma.blog.findUnique({ where: { slug } }));

const BRAND_SUFFIX = " | BITSOL Marketing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) return {};

  const summary = post.metaDescription || post.excerpt || post.title;
  const description = clampDescription(summary);
  const url = `${SITE_URL}/blog/${slug}`;
  const images = post.image ? [{ url: post.image }] : [DEFAULT_OG_IMAGE];

  return {
    // Most article titles are already long. Appending the brand pushed them
    // past what Google shows, so it is only added when it still fits.
    title: {
      absolute:
        post.title.length + BRAND_SUFFIX.length <= 60
          ? `${post.title}${BRAND_SUFFIX}`
          : post.title,
    },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      url,
      images,
      publishedTime: new Date(post.createdAt).toISOString(),
      modifiedTime: new Date(post.updatedAt).toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date(date));
}

function readTime(content: string): string {
  const words = content.replace(/<[^>]*>/g, "").split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Deliberately not wrapped in try/catch: a database blip should fail the
  // render so the cached page is kept, rather than caching a 404.
  const post = await getPost(slug);

  if (!post) notFound();

  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];
  const firstTag = tags[0] ?? "AI Marketing";
  const author = resolveAuthor(post.author);
  const content = cleanArticleHtml(post.content, post.title);
  const related = relatedLinks(post);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: clampDescription(post.metaDescription || post.excerpt || post.title),
    author: author.schema,
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "BITSOL Marketing",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
    },
    datePublished: new Date(post.createdAt).toISOString(),
    dateModified: new Date(post.updatedAt).toISOString(),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${slug}`,
    },
    ...(post.image && { image: post.image }),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: `${SITE_URL}/blog/${slug}` },
    ],
  };

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="pt-32 pb-24">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Breadcrumb */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-brand-muted hover:text-brand-cyan mb-12 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Blog
          </Link>

          {/* Header */}
          <header className="mb-12">
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-cyan">
                <Tag className="w-3 h-3" />
                {firstTag}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-brand-muted">
                <Calendar className="w-3 h-3" />
                {formatDate(post.createdAt)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-brand-muted">
                <User className="w-3 h-3" />
                {author.name}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-brand-muted">
                <Clock className="w-3 h-3" />
                {readTime(post.content)}
              </span>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white leading-tight mb-6">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-xl text-slate-600 dark:text-brand-muted leading-relaxed border-l-4 border-brand-cyan pl-6">
                {post.excerpt}
              </p>
            )}
          </header>

          {/* Featured Image */}
          {post.image && (
            <div className="mb-12 rounded-2xl overflow-hidden aspect-video relative">
              <Image
                src={post.image}
                alt={post.title}
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          )}

          {/* Article Content */}
          <article
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: content }}
          />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-slate-200 dark:border-white/10">
              {tags.map((tag: string) => (
                <span
                  key={tag}
                  className="text-xs font-bold uppercase tracking-tighter px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-brand-muted border border-slate-200 dark:border-white/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Where this article leads — posts previously linked only to the
              homepage, so nothing reached the service and city pages. */}
          {related.length > 0 && (
            <section className="mt-16" aria-labelledby="related-services">
              <h2
                id="related-services"
                className="text-2xl font-bold text-slate-900 dark:text-white mb-6"
              >
                Related services
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group rounded-2xl border border-slate-200 p-5 transition-colors hover:border-brand-cyan dark:border-white/10"
                  >
                    <span className="block font-bold text-slate-900 group-hover:text-brand-cyan dark:text-white">
                      {link.title}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-brand-muted">
                      {link.desc}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <div className="mt-20">
            <GlowingCard>
              <div className="p-10 md:p-16">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900 dark:text-white text-center">
                  Ready to Grow with <span className="text-gradient">AI Marketing</span>?
                </h2>
                <p className="text-center text-brand-muted mb-10 max-w-xl mx-auto">
                  Get a free audit of your digital presence and a custom 90-day growth
                  roadmap — no obligation.
                </p>
                <ContactForm />
              </div>
            </GlowingCard>
          </div>
        </div>
      </div>
    </>
  );
}
