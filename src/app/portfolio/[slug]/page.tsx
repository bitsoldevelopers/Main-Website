import { notFound } from "next/navigation";
import { projects } from "@/lib/portfolio";
import { GlowingCard } from "@/components/ui/glowing-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Calendar, User, Tag } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateStaticParams() {
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return {};
  return {
    title: `${project.title} | Portfolio`,
    description: project.desc,
    alternates: { canonical: `https://bitsolmarketing.com/portfolio/${slug}` },
    openGraph: {
      title: project.title,
      description: project.desc,
      url: `https://bitsolmarketing.com/portfolio/${slug}`,
      // Relative paths (e.g. /alphatrade-pro.png) resolve against metadataBase.
      images: [{ url: project.image }],
    },
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  return (
    <div className="pt-32 pb-24">
      <div className="container mx-auto px-6">
        <Link href="/portfolio" className="inline-flex items-center gap-2 text-brand-muted hover:text-brand-cyan mb-12 transition-colors group">
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Innovations
        </Link>

        {/* Project Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-24">
          <div className="lg:col-span-8">
            <h1 className="text-5xl md:text-7xl font-bold mb-8 text-slate-900 dark:text-white">
              {project.title}<span className="text-brand-cyan">.</span>
            </h1>
            <div className="flex flex-wrap gap-8 mb-12">
              <div className="flex items-center gap-2 text-brand-muted">
                <Tag className="w-4 h-4" /> {project.category}
              </div>
              <div className="flex items-center gap-2 text-brand-muted">
                <User className="w-4 h-4" /> {project.client}
              </div>
              <div className="flex items-center gap-2 text-brand-muted">
                <Calendar className="w-4 h-4" /> {project.year}
              </div>
            </div>

            <div className="relative aspect-video rounded-3xl overflow-hidden mb-12 border border-white/10 shadow-2xl">
              <Image
                src={project.image}
                alt={project.title}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/40 to-transparent" />
            </div>

            <h3 className="text-3xl font-bold mb-6">The Challenge & Solution</h3>
            <p className="text-xl text-black dark:text-brand-muted leading-relaxed mb-12">
              {project.fullDesc}
            </p>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <GlowingCard>
              <div className="p-8">
                <h4 className="text-xl font-bold mb-6 border-b border-white/10 pb-4">Tech Stack</h4>
                <div className="flex flex-wrap gap-3">
                  {project.tech.map((t, i) => (
                    <span key={i} className="px-4 py-2 rounded-lg bg-brand-cyan/10 text-brand-cyan text-sm font-bold border border-brand-cyan/20">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </GlowingCard>

            <GlowingCard>
              <div className="p-8">
                <h4 className="text-xl font-bold mb-6 border-b border-white/10 pb-4">Key Metrics</h4>
                <div className="space-y-6">
                  {Object.entries(project.stats).map(([key, val], i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-brand-muted capitalize">{key}</span>
                      <span className="text-2xl font-bold text-brand-cyan">{val as string}</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlowingCard>

            <Button variant="brand" className="w-full py-8 text-xl font-bold rounded-2xl group">
              View Case Study <ExternalLink className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
