import { prisma } from "@/lib/prisma";
import AdBanner from "@/components/AdBanner";
import Link from "next/link";
import { GlowingCard } from "@/components/ui/glowing-card";
import { ArrowRight, Calendar, User, Tag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import Image from "next/image";

export const revalidate = 60;

/** Posts fetched per page. Keeps the listing query small as the archive grows. */
const PAGE_SIZE = 12;

function pageFrom(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const page = pageFrom((await searchParams).page);
  const base = "https://bitsolmarketing.com/blog";
  const url = page > 1 ? `${base}?page=${page}` : base;
  const suffix = page > 1 ? ` — Page ${page}` : "";

  return {
    title: `Blog | AI Marketing Insights & SEO Strategies${suffix}`,
    description:
      "Expert insights on AI digital marketing, SEO strategies, automation, and business growth from the BITSOL MARKETING team.",
    // Self-referencing canonical per page so paginated results are not
    // collapsed onto page 1.
    alternates: { canonical: url },
    openGraph: {
      title: `Blog | BITSOL MARKETING${suffix}`,
      description:
        "Expert insights on AI digital marketing, SEO, automation and business growth.",
      url,
    },
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function readTime(content: string): string {
  const words = stripHtml(content).split(" ").length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  type PostRow = {
    id: string;
    title: string;
    slug: string;
    author: string;
    image: string | null;
    excerpt: string | null;
    content: string;
    tags: string[];
    createdAt: Date;
  };

  const page = pageFrom((await searchParams).page);

  let posts: any[] = [];
  let totalPosts = 0;

  try {
    // Paginated. Previously this fetched every published post including its
    // full HTML content (~1.6MB across 175 posts) purely to derive read time
    // and an excerpt fallback, which grew linearly with the archive.
    [posts, totalPosts] = await Promise.all([
      prisma.blog.findMany({
        where: { published: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          title: true,
          slug: true,
          author: true,
          image: true,
          excerpt: true,
          content: true,
          tags: true,
          createdAt: true,
        },
      }),
      prisma.blog.count({ where: { published: true } }),
    ]);
  } catch (err) {
    console.error("[Blog] Database query failed:", err);
  }

  const totalPages = Math.max(1, Math.ceil(totalPosts / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const pageHref = (n: number) => (n <= 1 ? "/blog" : `/blog?page=${n}`);

  return (
    <div className="pt-32 pb-24">
      {/* Header */}
      <section className="container mx-auto px-6 mb-20 text-center">
        <h1 className="text-6xl md:text-8xl font-bold mb-8 text-slate-900 dark:text-white">
          AI Marketing <span className="text-gradient">Insights</span>
        </h1>
        <p className="text-xl text-black dark:text-brand-muted max-w-3xl mx-auto">
          Expert guides on AI-powered SEO, digital marketing strategy, automation, and
          business growth — straight from the BITSOL MARKETING team.
        </p>
      </section>

      {/* Ad Banner */}
      <div className="container mx-auto px-6 mb-12">
        <AdBanner adSlot="8287317610" />
      </div>

      {/* Posts Grid */}
      <section className="container mx-auto px-6">
        {posts.length === 0 ? (
          <div className="text-center py-32">
            <p className="text-2xl text-brand-muted">
              First article coming soon. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => {
              const excerpt =
                post.excerpt ||
                stripHtml(post.content).slice(0, 160) + "…";
              const firstTag = post.tags?.[0] ?? "AI Marketing";

              return (
                <GlowingCard key={post.id} className="h-full">
                  <div className="flex flex-col h-full group">
                    {/* Image */}
                    <div className="relative aspect-video overflow-hidden rounded-t-xl bg-gradient-to-br from-brand-dark to-brand-slate">
                      {post.image ? (
                        <Image
                          src={post.image}
                          alt={post.title}
                          fill
                          unoptimized
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-5xl font-black text-brand-cyan/20 uppercase tracking-tighter">
                            {firstTag}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/60 via-transparent to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="p-8 flex flex-col flex-grow">
                      {/* Meta */}
                      <div className="flex items-center gap-4 mb-4">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-cyan">
                          <Tag className="w-3 h-3" />
                          {firstTag}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-muted">
                          <Calendar className="w-3 h-3" />
                          {formatDate(post.createdAt)}
                        </span>
                      </div>

                      <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white group-hover:text-brand-cyan transition-colors leading-snug">
                        {post.title}
                      </h2>

                      <p className="text-sm text-slate-600 dark:text-brand-muted leading-relaxed flex-grow mb-6">
                        {excerpt}
                      </p>

                      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-200 dark:border-white/10">
                        <span className="flex items-center gap-1.5 text-xs text-brand-muted">
                          <User className="w-3 h-3" />
                          {post.author?.name || post.author || "BITSOL Team"}
                        </span>
                        <span className="text-xs text-brand-muted">
                          {readTime(post.content)}
                        </span>
                      </div>

                      <Link
                        href={`/blog/${post.slug}`}
                        className={cn(
                          buttonVariants({ variant: "brand" }),
                          "w-full rounded-full py-5 font-bold group/btn mt-6"
                        )}
                      >
                        Read Article{" "}
                        <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </GlowingCard>
              );
            })}
          </div>
        )}

        {/* Pagination — real anchors so crawlers can follow the archive */}
        {totalPages > 1 && (
          <nav
            aria-label="Blog pagination"
            className="flex items-center justify-center gap-3 mt-16 flex-wrap"
          >
            {hasPrev && (
              <Link
                href={pageHref(page - 1)}
                rel="prev"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "rounded-full px-6"
                )}
              >
                Previous
              </Link>
            )}

            <span className="text-sm text-brand-muted px-4">
              Page {page} of {totalPages}
              <span className="hidden sm:inline"> · {totalPosts} articles</span>
            </span>

            {hasNext && (
              <Link
                href={pageHref(page + 1)}
                rel="next"
                className={cn(
                  buttonVariants({ variant: "brand" }),
                  "rounded-full px-6"
                )}
              >
                Next
              </Link>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
