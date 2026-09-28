"use client";

import { motion } from "framer-motion";
import { Bot, Cpu, MessageSquare, Zap, Mic, BarChart, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const aiSolutions = [
  {
    title: "AI Chatbots",
    desc: "Intelligent conversational agents that handle customer queries 24/7 with human-like precision.",
    icon: MessageSquare,
    color: "brand-cyan",
  },
  {
    title: "AI Agents",
    desc: "Autonomous agents designed to perform complex tasks, research, and data processing.",
    icon: Bot,
    color: "brand-purple",
  },
  {
    title: "AI Voice Assistants",
    desc: "Natural language voice interfaces for hands-free interaction and automated calling.",
    icon: Mic,
    color: "brand-cyan",
  },
  {
    title: "Workflow Automation",
    desc: "Seamless integration of AI into your existing business workflows for maximum efficiency.",
    icon: Zap,
    color: "brand-purple",
  },
  {
    title: "Data Intelligence",
    desc: "Transform raw data into actionable insights using advanced machine learning models.",
    icon: BarChart,
    color: "brand-cyan",
  },
  {
    title: "Custom AI Models",
    desc: "Tailor-made neural networks designed specifically for your unique business needs.",
    icon: Cpu,
    color: "brand-purple",
  },
];

export default function AISolutionsClient() {
  return (
    <div className="pt-32 pb-24">
      <div className="container mx-auto px-6">
        <div className="max-w-3xl mb-20">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-5xl md:text-7xl font-bold mb-8"
          >
            Futuristic <span className="text-gradient">AI Solutions</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-brand-muted leading-relaxed"
          >
            We deploy the world's most advanced artificial intelligence to automate, optimize, and scale your business operations beyond human limits.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {aiSolutions.map((solution, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-10 hover:border-brand-cyan/50 transition-all group relative overflow-hidden"
            >
              <div className={`absolute -top-10 -right-10 w-32 h-32 bg-${solution.color}/10 blur-3xl group-hover:bg-${solution.color}/20 transition-all`} />

              <div className={`w-14 h-14 rounded-2xl bg-${solution.color}/10 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform`}>
                <solution.icon className={`w-7 h-7 text-${solution.color}`} />
              </div>

              <h3 className="text-2xl font-bold mb-4">{solution.title}</h3>
              <p className="text-brand-muted mb-8 leading-relaxed">
                {solution.desc}
              </p>

              <Button variant="ghost" className="p-0 text-brand-cyan hover:text-white hover:bg-transparent flex items-center gap-2">
                Learn More <Zap className="w-4 h-4" />
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-32 glass-card p-12 md:p-20 text-center relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/5 to-brand-purple/5" />
          <h2 className="text-3xl md:text-5xl font-bold mb-8 relative z-10">
            Ready to Build the Future?
          </h2>
          <p className="text-brand-muted max-w-2xl mx-auto mb-12 text-lg relative z-10">
            Schedule a consultation with our AI architects to explore how we can integrate intelligent systems into your infrastructure.
          </p>
          <Button size="lg" className="bg-brand-cyan text-brand-dark hover:bg-brand-cyan/90 px-10 py-8 rounded-full text-xl font-bold relative z-10">
            Book AI Strategy Session
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
