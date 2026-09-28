"use client";

import { motion } from "framer-motion";
import { Brain, Rocket, Shield, Target, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";
import { journeyData } from "@/lib/journey";

const values = [
  { icon: Brain, title: "Innovation", desc: "Pushing the boundaries of what's possible with AI and emerging tech." },
  { icon: Target, title: "Precision", desc: "Data-driven strategies that hit the mark every single time." },
  { icon: Zap, title: "Velocity", desc: "Rapid development and deployment to keep you ahead of the market." },
  { icon: Shield, title: "Reliability", desc: "Scalable infrastructures built for 99.9% uptime and security." }
];

export default function AboutPage() {
  return (
    <div className="pt-32 pb-24">
      {/* Hero Section */}
      <section className="container mx-auto px-6 mb-32">
        <div className="max-w-4xl">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-bold mb-8"
          >
            Pioneering the <br />
            <span className="text-gradient">Intelligent</span> Future
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-black dark:text-brand-muted leading-relaxed"
          >
            BITSOL Marketing is more than an agency. We are a collective of architects, engineers, and visionaries dedicated to building the digital ecosystems of tomorrow.
          </motion.p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-brand-slate/30 py-24 mb-32 relative overflow-hidden">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold mb-8 text-slate-900 dark:text-white">Our Mission</h2>
            <p className="text-black dark:text-brand-muted text-lg leading-relaxed mb-6">
              Founded in 2020, BITSOL began with a single vision: to bridge the gap between complex AI technology and real-world business growth. 
            </p>
            <p className="text-black dark:text-brand-muted text-lg leading-relaxed">
              Today, we serve global enterprises, helping them navigate the digital landscape with custom-built neural networks, automated marketing engines, and high-performance trading technologies.
            </p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-2 relative aspect-square"
          >
             <img 
               src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80" 
               alt="Technology" 
               className="w-full h-full object-cover rounded-xl opacity-80"
             />
             <div className="absolute inset-0 bg-gradient-to-tr from-brand-cyan/20 to-transparent rounded-xl" />
          </motion.div>
        </div>
      </section>

      {/* CEO Message Section */}
      <section className="container mx-auto px-6 mb-32">
        <div className="glass-card p-8 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-purple/5 to-transparent pointer-events-none" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
            {/* CEO Photo */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="lg:col-span-4 flex justify-center"
            >
              <div className="relative group">
                <div className="absolute -inset-4 bg-gradient-to-r from-brand-cyan to-brand-purple rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-full overflow-hidden border-4 border-white/10 shadow-2xl">
                  <img 
                    src="/adnan-bashir.png" 
                    alt="Muhammad Adnan Bashir" 
                    className="w-full h-full object-cover scale-110 translate-y-4"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/40 to-transparent" />
                </div>
              </div>
            </motion.div>

            {/* Message Content */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="lg:col-span-8"
            >
              <div className="mb-6 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-brand-cyan/10 border border-brand-cyan/20">
                <span className="w-2 h-2 rounded-full bg-brand-cyan animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-widest text-brand-cyan">CEO & Founder</span>
              </div>
              <h2 className="text-4xl font-bold mb-6 text-slate-900 dark:text-white">Muhammad Adnan Bashir</h2>
              
              <blockquote className="relative mb-10">
                <span className="absolute -top-6 -left-4 text-8xl text-brand-cyan/20 font-serif">"</span>
                <p className="text-2xl italic leading-relaxed text-slate-800 dark:text-brand-white/90">
                  At BITSOL, we don't just build technology; we architect growth. Our journey started with a simple belief: that AI should be accessible, actionable, and transformational for every ambitious brand. Today, we continue to push the boundaries of what's possible, ensuring our partners lead the digital revolution rather than follow it.
                </p>
              </blockquote>

              <div className="flex flex-wrap items-center gap-8">
                <div className="flex items-center gap-4">
                    <a 
                      href="https://www.linkedin.com/company/bitsolpvtltd/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                    >
                      <svg 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="w-6 h-6"
                      >
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect x="2" y="9" width="4" height="12"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
                    </a>
                    <a 
                      href="https://www.facebook.com/bitsolmarketing/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-12 h-12 rounded-full bg-blue-700/10 flex items-center justify-center text-blue-700 hover:bg-blue-700 hover:text-white transition-all shadow-lg"
                    >
                      <svg 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        className="w-6 h-6"
                      >
                        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                      </svg>
                    </a>
                </div>
                <div className="h-10 w-px bg-slate-200 dark:bg-white/10" />
                <p className="text-brand-muted text-sm max-w-xs font-medium">
                  Follow the journey on social media for insights into AI and digital engineering.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Grid */}
      <section className="container mx-auto px-6 mb-32 text-center">
        <h2 className="text-4xl font-bold mb-16">The BITSOL <span className="text-gradient">DNA</span></h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {values.map((val, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-10 group hover:border-brand-cyan/40 transition-all"
            >
              <div className="w-14 h-14 bg-brand-cyan/10 rounded-2xl flex items-center justify-center mb-8 mx-auto group-hover:scale-110 transition-transform">
                <val.icon className="w-7 h-7 text-brand-cyan" />
              </div>
              <h3 className="text-xl font-bold mb-4">{val.title}</h3>
              <p className="text-brand-muted leading-relaxed text-sm">
                {val.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Our Journey Section */}
      <section className="py-24 bg-brand-dark/30 overflow-hidden relative border-y border-white/5 mb-32">
        <div className="container mx-auto px-6 text-center relative z-10 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-6xl font-bold mb-6 text-slate-900 dark:text-white">
              Our <span className="text-gradient">Journey</span>
            </h2>
            <p className="text-xl text-slate-600 dark:text-brand-muted max-w-2xl mx-auto">
              From our digital genesis to the quantum future—witness the evolution of innovation at BITSOL.
            </p>
          </motion.div>
        </div>

        <div className="relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-cyan/5 blur-[150px] pointer-events-none rounded-full" />
          <RadialOrbitalTimeline timelineData={journeyData} />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6">
        <div className="glass-card p-12 md:p-20 text-center relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-brand-purple/10 blur-[100px]" />
           <h2 className="text-4xl md:text-6xl font-bold mb-8">Ready to Build Something <span className="text-gradient">Legendary</span>?</h2>
           <p className="text-brand-muted text-xl max-w-2xl mx-auto mb-10">
             Our team of experts is ready to architect your next digital leap.
           </p>
           <Button size="lg" className="bg-brand-cyan text-brand-dark hover:bg-brand-cyan/90 rounded-full px-12 py-8 text-xl font-bold">
              Connect With Us
           </Button>
        </div>
      </section>
    </div>
  );
}
