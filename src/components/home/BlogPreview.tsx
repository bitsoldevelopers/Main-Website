"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GlowingCard } from "@/components/ui/glowing-card";
import Link from "next/link";
import { ArrowRight, Calendar, Tag } from "lucide-react";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  tags: string[];
  createdAt: Date;
};

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
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
    <section className="py-24 bg-transparent relative z-10">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-2xl">
            <motion.h2
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-white"
            >
              AI Marketing <span className="text-gradient">Insights</span>
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-black dark:text-brand-muted text-lg"
            >
              Expert guides on AI-powered SEO, automation, and digital growth — straight from our team.
            </motion.p>
          </div>
          <Link href="/blog">
            <Button
              size="lg"
              variant="outline"
              className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 rounded-full px-8"
            >
              View All Articles
            </Button>
          </Link>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post, i) => {
            const firstTag = post.tags?.[0] ?? "AI Marketing";
            const excerpt =
              post.excerpt ||
              stripHtml(post.content).slice(0, 140) + "…";

            return (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <GlowingCard className="h-full">
                  <div className="flex flex-col h-full group">
                    {/* Image area */}
                    <div className="relative aspect-video overflow-hidden rounded-t-xl bg-gradient-to-br from-brand-dark to-brand-slate">
                      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                        <span className="text-[4rem] font-black text-brand-cyan/10 uppercase tracking-tighter text-center px-4 leading-none">
                          {firstTag}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-transparent to-transparent" />
                      <div className="absolute bottom-4 left-4">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-cyan bg-brand-dark/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-brand-cyan/30">
                          <Tag className="w-2.5 h-2.5" />
                          {firstTag}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-8 flex flex-col flex-grow">
                      <div className="flex items-center gap-2 text-xs text-brand-muted mb-4">
                        <Calendar className="w-3 h-3" />
                        {formatDate(post.createdAt)}
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-brand-cyan transition-colors leading-snug mb-4">
                        {post.title.length > 72
                          ? post.title.slice(0, 72) + "…"
                          : post.title}
                      </h3>

                      <p className="text-sm text-slate-600 dark:text-brand-muted leading-relaxed flex-grow mb-6">
                        {excerpt}
                      </p>

                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-2 text-sm font-bold text-brand-cyan group/link mt-auto"
                      >
                        Read Article
                        <ArrowRight className="w-4 h-4 transition-transform group-hover/link:translate-x-1" />
                      </Link>
                    </div>
                  </div>
                </GlowingCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
