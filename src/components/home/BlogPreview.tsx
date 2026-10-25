"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Eyebrow, Tag } from "@/components/home/editorial";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  image?: string | null;
  /** Only present on posts from the client-side /api/blog fallback. */
  content?: string;
  tags: string[];
  createdAt: Date;
};

function formatDate(date: Date | string): string {
  // Pinned to one time zone: without it the server (UTC) and the visitor's
  // browser rendered different dates for evening posts, which React reported
  // as a hydration mismatch and then re-rendered the whole tree.
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date(date));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Stand-in artwork for posts without a cover image: a soft duotone chosen
// from the slug, so a post keeps the same one across renders.
const WASHES = [
  "linear-gradient(135deg,#e9d7ff 0%,#f7c9e5 50%,#ffe3c7 100%)",
  "linear-gradient(135deg,#dfe8ff 0%,#eef1ec 55%,#f3e5d8 100%)",
  "linear-gradient(135deg,#ffd9c2 0%,#f5b8c8 50%,#d8c6ff 100%)",
  "linear-gradient(135deg,#d9f2ea 0%,#e8f0d2 55%,#fff0c9 100%)",
];

function washFor(slug: string): string {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return WASHES[h % WASHES.length];
}

export default function BlogPreview({ posts: initialPosts }: { posts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);

  useEffect(() => {
    if (initialPosts.length > 0) return;
    fetch("/api/blog?limit=3&full=1")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) setPosts(data);
        else if (data?.posts?.length > 0) setPosts(data.posts);
      })
      .catch(() => {});
  }, [initialPosts.length]);

  if (posts.length === 0) return null;

  return (
    <section className="py-24 md:py-32">
      <div className="wrap">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[560px]">
            <Eyebrow className="mb-7">Insights</Eyebrow>
            <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">Ideas, insights &amp; perspectives</h2>
          </div>
          <Link href="/blog" className="shrink-0 md:pb-2">
            <Button variant="outline" className="border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(20,20,20,0.04)]">
              View all articles
            </Button>
          </Link>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {posts.slice(0, 3).map((post) => {
            const firstTag = post.tags?.[0] ?? "Marketing";
            const excerpt = post.excerpt || (post.content ? stripHtml(post.content).slice(0, 140) + "…" : "");
            const title = post.title.length > 72 ? post.title.slice(0, 72) + "…" : post.title;

            return (
              <article
                key={post.id}
                className="group flex flex-col rounded-[28px] border border-black/[0.06] bg-white p-2 shadow-[0_1px_2px_rgba(20,20,20,0.04)] transition-shadow duration-500 hover:shadow-[0_30px_60px_-30px_rgba(20,20,20,0.3)]"
              >
                <div className="flex flex-1 flex-col px-5 pb-7 pt-6">
                  <time
                    dateTime={new Date(post.createdAt).toISOString()}
                    className="font-mono text-[11px] uppercase tracking-[0.08em] text-[#a4a4a4]"
                  >
                    {formatDate(post.createdAt)}
                  </time>
                  <h3 className="mt-5 text-[28px] leading-[1.1] md:text-[30px]">
                    <Link href={`/blog/${post.slug}`} className="transition-colors group-hover:text-foreground/80">
                      {title}
                    </Link>
                  </h3>
                  <p className="mt-5 flex-1 text-[14px] leading-relaxed text-muted-foreground">{excerpt}</p>
                  <div className="mt-6">
                    <Tag tone="muted">{firstTag}</Tag>
                  </div>
                </div>

                <Link
                  href={`/blog/${post.slug}`}
                  aria-label={post.title}
                  className="relative block aspect-[3/2] overflow-hidden rounded-[20px] bg-secondary"
                >
                  {post.image ? (
                    <Image
                      src={post.image}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 30vw, 100vw"
                      unoptimized={post.image.startsWith("http")}
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 flex items-end p-5 font-heading text-[88px] leading-none text-white/70"
                      style={{ background: washFor(post.slug) }}
                    >
                      {firstTag.charAt(0).toUpperCase()}
                    </span>
                  )}
                </Link>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
