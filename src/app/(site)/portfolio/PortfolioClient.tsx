"use client";

import { motion } from "framer-motion";
import { projects } from "@/lib/portfolio";
import { Button } from "@/components/ui/button";
import { GlowingCard } from "@/components/ui/glowing-card";
import Link from "next/link";
import { ArrowRight, Tag, Calendar } from "lucide-react";

export default function PortfolioPage() {
  return (
    <div className="pt-32 pb-24">
      {/* Header */}
      <section className="container mx-auto px-6 mb-32 text-center">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-6xl md:text-8xl font-bold mb-8 text-slate-900 dark:text-white"
        >
          Selected <span className="text-gradient">Innovations</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl text-black dark:text-brand-muted max-w-3xl mx-auto"
        >
          A master collection of our most ambitious engineering feats, from neural networks to high-frequency trading ecosystems.
        </motion.p>
      </section>

      {/* Projects Grid */}
      <section className="container mx-auto px-6 mb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {projects.map((project, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <GlowingCard className="h-full overflow-hidden group">
                <div className="relative aspect-video overflow-hidden">
                  <img 
                    src={project.image} 
                    alt={project.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/80 via-transparent to-transparent opacity-60" />
                </div>
                
                <div className="p-10">
                  <div className="flex items-center gap-6 mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-cyan">
                      <Tag className="w-3 h-3" /> {project.category}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-muted">
                      <Calendar className="w-3 h-3" /> {project.year}
                    </div>
                  </div>

                  <h2 className="text-3xl font-bold mb-6 text-slate-900 dark:text-white group-hover:text-brand-cyan transition-colors">
                    {project.title}
                  </h2>
                  <p className="text-black dark:text-brand-muted text-lg mb-8 leading-relaxed">
                    {project.desc}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-10">
                    {project.tech.slice(0, 3).map((t, j) => (
                      <span key={j} className="text-[10px] font-bold uppercase tracking-tighter px-2 py-1 rounded bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-brand-muted border border-slate-200 dark:border-white/10">
                        {t}
                      </span>
                    ))}
                    {project.tech.length > 3 && <span className="text-[10px] font-bold text-brand-cyan">+{project.tech.length - 3} MORE</span>}
                  </div>

                  <Link href={`/portfolio/${project.slug}`} className="w-full">
                    <Button variant="brand" className="w-full rounded-full py-6 text-lg font-bold group/btn">
                      View Case Study <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover/btn:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </GlowingCard>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
