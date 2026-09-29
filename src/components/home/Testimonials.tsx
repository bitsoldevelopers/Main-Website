"use client";

import { MorphingCardStack } from "@/components/ui/morphing-card-stack";
import { Star, Rocket, Shield, Heart, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { TESTIMONIAL_DEFAULTS, type TestimonialItem } from "@/lib/cms-defaults";

// Icons stay presentation-side and cycle over however many testimonials the
// CMS provides; the text comes from the database (with built-in fallback).
const icons = [
  <Rocket key="rocket" className="h-6 w-6" />,
  <Star key="star" className="h-6 w-6" />,
  <Globe key="globe" className="h-6 w-6" />,
  <Shield key="shield" className="h-6 w-6" />,
  <Heart key="heart" className="h-6 w-6" />,
];

export default function Testimonials({ items }: { items?: TestimonialItem[] }) {
  const testimonialData = (items && items.length > 0 ? items : TESTIMONIAL_DEFAULTS).map((item, i) => ({
    ...item,
    icon: icons[i % icons.length],
  }));
  return (
    <section className="py-32 relative overflow-hidden bg-slate-50/50 dark:bg-transparent">
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-white">
              Voices of <span className="text-gradient">Success</span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-brand-muted max-w-2xl mx-auto">
              Don&apos;t just take our word for it. Hear from the leaders who have architected their future with BITSOL.
            </p>
          </motion.div>
        </div>

        <div className="max-w-6xl mx-auto">
          <MorphingCardStack cards={testimonialData} defaultLayout="stack" />
        </div>
      </div>

      {/* Decorative Background Elements */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[500px] h-[500px] bg-brand-cyan/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-purple/5 blur-[120px] pointer-events-none" />
    </section>
  );
}
