"use client";

import { motion } from "framer-motion";
import { TrendingUp, ShieldCheck, Zap, Globe, BarChart3, Database } from "lucide-react";
import { Button } from "@/components/ui/button";

const tradingServices = [
  {
    title: "PSX Trading Systems",
    desc: "Advanced automated systems optimized for the Pakistan Stock Exchange with real-time analytics.",
    icon: BarChart3,
  },
  {
    title: "PMEX Solutions",
    desc: "Custom algorithms for the Pakistan Mercantile Exchange, ensuring high-speed execution.",
    icon: TrendingUp,
  },
  {
    title: "Binance Automation",
    desc: "Highly secure API-based trading bots for Binance and other major crypto exchanges.",
    icon: Zap,
  },
  {
    title: "Risk Management",
    desc: "AI-driven risk assessment tools that protect your capital through intelligent hedging.",
    icon: ShieldCheck,
  },
  {
    title: "Trading Signals",
    desc: "Machine learning models that provide high-accuracy market entry and exit signals.",
    icon: Globe,
  },
  {
    title: "Big Data Analytics",
    desc: "Deep analysis of historical and real-time market data to identify hidden opportunities.",
    icon: Database,
  },
];

export default function TradingClient() {
  return (
    <div className="pt-32 pb-24 bg-white dark:bg-[#050816]">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center mb-32">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-block px-4 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-xs font-bold uppercase tracking-widest mb-6"
            >
              Financial Technology
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-bold mb-8 leading-tight text-slate-900 dark:text-white"
            >
              Precision <span className="text-gradient">Trading</span> Algorithms
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xl text-slate-600 dark:text-brand-muted leading-relaxed mb-10"
            >
              We bridge the gap between financial markets and advanced technology. Our trading solutions are built for speed, accuracy, and maximum ROI.
            </motion.p>
            <Button size="lg" className="bg-brand-cyan text-brand-dark hover:bg-brand-cyan/90 rounded-full px-10 py-7 font-bold text-lg">
              View Trading Performance
            </Button>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative h-[400px] md:h-[600px] rounded-2xl border border-slate-200 dark:border-brand-cyan/20 bg-slate-50 dark:bg-slate-900/60 dark:backdrop-blur-xl flex items-center justify-center overflow-hidden shadow-lg dark:shadow-none"
          >
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1611974717482-98aa01374246?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 dark:opacity-20" />
            <div className="relative z-10 w-full h-full p-8 flex flex-col justify-end">
              <div className="h-64 flex items-end gap-2">
                {[40, 70, 45, 90, 65, 80, 100, 75, 85, 60].map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ duration: 1, delay: i * 0.1, repeat: Infinity, repeatType: "reverse" }}
                    className="flex-1 bg-brand-cyan/30 dark:bg-brand-cyan/40 rounded-t-sm"
                  />
                ))}
              </div>
              <div className="mt-4 flex justify-between text-xs text-brand-cyan font-mono">
                <span>ILLUSTRATIVE DATA</span>
                <span>PSX ALGO</span>
                <span>CRYPTO BOT</span>
              </div>
            </div>
          </motion.div>
        </div>

        <p className="text-xs text-slate-400 dark:text-brand-muted/60 mb-16 border border-slate-200 dark:border-white/5 rounded-xl px-6 py-4 max-w-3xl">
          <strong>Risk Disclaimer:</strong> Algorithmic trading involves significant financial risk. Past performance of any system or strategy is not indicative of future results. All trading technology provided by BITSOL Marketing is for informational and automation purposes only and does not constitute financial advice. Capital invested in financial markets may be lost in part or in full.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
          {tradingServices.map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-8 border-l border-slate-200 dark:border-white/10 hover:border-brand-cyan transition-colors"
            >
              <service.icon className="w-10 h-10 text-brand-cyan mb-6" />
              <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{service.title}</h3>
              <p className="text-slate-500 dark:text-brand-muted leading-relaxed">
                {service.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
