"use client";

import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowingCard } from "@/components/ui/glowing-card";
import { DIcons } from "dicons";
import { plans } from "@/lib/pricing";

export default function PricingCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
      {plans.map((plan, i) => {
        const Icon = plan.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="relative"
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <span className="bg-brand-cyan text-black text-xs font-bold uppercase tracking-widest px-4 py-1.5 rounded-full">
                  Most Popular
                </span>
              </div>
            )}
            <GlowingCard className="h-full">
              <div className="p-10 flex flex-col h-full">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                  style={{ backgroundColor: plan.bg }}
                >
                  <Icon className="w-7 h-7" style={{ color: plan.color }} />
                </div>

                <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">
                  {plan.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-brand-muted mb-6 leading-relaxed">
                  {plan.desc}
                </p>

                <div className="flex items-end gap-1 mb-8">
                  <span className="text-5xl font-bold text-slate-900 dark:text-white">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-brand-muted mb-2">{plan.period}</span>
                  )}
                </div>

                <ul className="flex flex-col gap-3 mb-10 flex-grow">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-3">
                      <CheckCircle2
                        className="w-5 h-5 shrink-0 mt-0.5"
                        style={{ color: plan.color }}
                      />
                      <span className="text-sm text-slate-700 dark:text-white/80 leading-relaxed">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={`https://wa.me/923120141581?text=${encodeURIComponent(`Hello BITSOL Marketing! I'd like to order the ${plan.name} plan (${plan.price}${plan.period}). Please get in touch.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                >
                  <Button
                    variant={plan.popular ? "brand" : "outline"}
                    className="w-full rounded-full py-6 text-base font-bold group"
                  >
                    <DIcons.WhatsApp className="w-4 h-4 mr-2" />
                    {plan.name === "Enterprise" ? "Get a Custom Quote" : "Order via WhatsApp"}
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </a>
              </div>
            </GlowingCard>
          </motion.div>
        );
      })}
    </div>
  );
}
