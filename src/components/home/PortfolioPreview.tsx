"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { projects } from "@/lib/portfolio";
import Link from "next/link";
import Image from "next/image";

export default function PortfolioPreview() {
  const previewProjects = projects.slice(0, 6);

  return (
    <section className="py-24 bg-transparent relative z-10">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-8">
          <div className="max-w-2xl">
            <motion.h2 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-white"
            >
              Selected <span className="text-gradient">Innovations</span>
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-black dark:text-brand-muted text-lg"
            >
              Exploring the boundaries of AI, high-performance web ecosystems, and institutional trading technology.
            </motion.p>
          </div>
          <Link href="/portfolio">
            <Button size="lg" variant="outline" className="border-brand-cyan text-brand-cyan hover:bg-brand-cyan/10 rounded-full px-8">
              View All Projects
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {previewProjects.map((project, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative h-[450px] rounded-3xl overflow-hidden border border-white/10"
            >
              <Image
                src={project.image}
                alt={project.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                // Unsplash URLs already ask its CDN for a sized, compressed
                // image. The local screenshots are 1024px PNGs of up to 1.2MB,
                // so those go through the optimizer.
                unoptimized={project.image.startsWith("http")}
                className="object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
              
              <div className="absolute inset-0 p-10 flex flex-col justify-end">
                <div className="text-brand-cyan font-bold text-sm uppercase tracking-widest mb-4 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                  {project.category}
                </div>
                <h3 className="text-3xl font-bold text-white mb-6 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                  {project.title}
                </h3>
                
                <Link href={`/portfolio/${project.slug}`}>
                  <div className="flex items-center gap-2 text-white font-bold opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                    View Case Study <div className="w-8 h-px bg-brand-cyan" />
                  </div>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
