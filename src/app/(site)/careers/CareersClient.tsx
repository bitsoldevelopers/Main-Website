"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { GlowingCard } from "@/components/ui/glowing-card";
import { 
  Briefcase, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle, 
  GraduationCap, 
  Zap, 
  ShieldCheck, 
  Users, 
  ArrowRight,
  Sparkles,
  Link as LinkIcon
} from "lucide-react";

export default function CareersClient() {
  const formRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    portfolio: "",
    role: "nextjs",
    pitch: "",
  });

  const roles = [
    {
      id: "nextjs",
      title: "Senior React / Next.js Developer",
      department: "Engineering",
      location: "Lahore (Hybrid)",
      type: "Full-Time",
      desc: "Architect low-latency, pixel-perfect, and SEO-optimized frontend architectures on Next.js 15, React 19, and Tailwind.",
      requirements: [
        "4+ years of professional production experience with React and Next.js.",
        "Deep understanding of server actions, streaming, PPR, and SSR architectures.",
        "Obsession with clean code, design fidelity, and sub-second page performance.",
      ],
    },
    {
      id: "ai-architect",
      title: "Generative AI & Automation Architect",
      department: "AI Solutions",
      location: "Lahore (Hybrid)",
      type: "Full-Time",
      desc: "Design and implement custom AI agents, automated LLM orchestration flows, and intelligent database integrations.",
      requirements: [
        "Hands-on experience with OpenAI, Claude, LangChain, and vector databases.",
        "Strong backend coding proficiency in Python and Node.js.",
        "Experience building agentic workflows and automated WhatsApp/CRM channels.",
      ],
    },
    {
      id: "seo-growth",
      title: "SEO & Search Intelligence Specialist",
      department: "Growth Marketing",
      location: "Remote / Hybrid",
      type: "Full-Time",
      desc: "Drive compounding organic growth and search engine visibility using semantic cluster mapping and data-driven SEO strategies.",
      requirements: [
        "Proven track record scaling organic traffic for B2B/SaaS or local businesses.",
        "Mastery of technical SEO (schema markup, site architecture, indexing signals).",
        "Expertise in AEO/GEO (Search Generative Experience & AI citation engines).",
      ],
    },
  ];

  const handleApplyClick = (roleId: string) => {
    setFormData((prev) => ({ ...prev, role: roleId }));
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to submit application");

      setIsSubmitted(true);

      const roleTitle = roles.find((r) => r.id === formData.role)?.title || formData.role;
      const waMsg = `Hello BITSOL Marketing! I just submitted my job application.\n\nName: ${formData.name}\nEmail: ${formData.email}\nRole: ${roleTitle}\nPortfolio/LinkedIn: ${formData.portfolio}\nPitch: ${formData.pitch}`;
      window.open(`https://wa.me/923120141581?text=${encodeURIComponent(waMsg)}`, "_blank");
    } catch {
      setError("Failed to transmit application. Please try again or drop your CV to careers@bitsolmarketing.com.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
    },
  };

  return (
    <div className="relative min-h-screen pt-32 pb-24 overflow-hidden bg-transparent">
      {/* Decorative Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] bg-brand-cyan/5 blur-[120px] rounded-full pointer-events-none z-0" />
      
      <div className="container mx-auto px-6 relative z-10">
        
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-brand-cyan bg-brand-cyan/10 px-4 py-2 rounded-full border border-brand-cyan/25 mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            We Are Hiring
          </span>
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500 dark:from-neutral-50 dark:to-neutral-400 mb-8 leading-tight">
            Join the Architects of <span className="text-gradient">Digital Innovation</span>
          </h1>
          <p className="text-slate-600 dark:text-brand-muted text-lg leading-relaxed max-w-2xl mx-auto">
            Help us architect high-performance digital ecosystems, custom AI infrastructures, and result-driven marketing frameworks. Build the future with us.
          </p>
        </motion.div>

        {/* Culture / Perks Section */}
        <motion.section 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-28"
        >
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-purple mb-2 block">Our DNA</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Why BITSOL Marketing?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: Zap,
                colorClass: "text-brand-cyan",
                bgClass: "bg-brand-cyan/10",
                title: "Autonomy & Impact",
                desc: "We completely reject micro-management. Own your projects, implement solutions, and make a massive visual impact.",
              },
              {
                icon: GraduationCap,
                colorClass: "text-brand-purple",
                bgClass: "bg-brand-purple/10",
                title: "Continuous Upskilling",
                desc: "Compounding learning allowances, professional certifications, and technical book budgets to constantly build your edge.",
              },
              {
                icon: Users,
                colorClass: "text-brand-cyan",
                bgClass: "bg-brand-cyan/10",
                title: "Collaborative Flow",
                desc: "Work closely with senior architects, engage in elite pair-programming, and deliver clean, enterprise-ready codebases.",
              },
              {
                icon: ShieldCheck,
                colorClass: "text-brand-purple",
                bgClass: "bg-brand-purple/10",
                title: "Premium Packages",
                desc: "Top-market salary packages, performance incentives, annual profit sharing, and full healthcare support plans.",
              },
            ].map((perk, i) => (
              <motion.div key={i} variants={itemVariants}>
                <GlowingCard className="h-full">
                  <div className="p-8 flex flex-col h-full">
                    <div 
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 shrink-0 ${perk.bgClass}`}
                    >
                      <perk.icon className={`w-6 h-6 ${perk.colorClass}`} />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{perk.title}</h3>
                    <p className="text-slate-600 dark:text-brand-muted text-sm leading-relaxed flex-grow">{perk.desc}</p>
                  </div>
                </GlowingCard>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Job Listings Section */}
        <motion.section 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="mb-28"
        >
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-cyan mb-2 block">Opportunities</span>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">Active Career Paths</h2>
          </div>

          <div className="flex flex-col gap-8 max-w-4xl mx-auto">
            {roles.map((role) => (
              <motion.div key={role.id} variants={itemVariants}>
                <GlowingCard>
                  <div className="p-8 md:p-10 flex flex-col md:flex-row gap-8 justify-between items-start md:items-center">
                    <div className="space-y-4 max-w-xl">
                      <div className="flex flex-wrap gap-3 items-center">
                        <span className="text-xs font-bold uppercase tracking-widest text-brand-cyan bg-brand-cyan/10 px-3 py-1 rounded-full border border-brand-cyan/20">
                          {role.department}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
                          <MapPin className="w-3.5 h-3.5" /> {role.location}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
                          <Clock className="w-3.5 h-3.5" /> {role.type}
                        </span>
                      </div>
                      
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{role.title}</h3>
                      <p className="text-slate-600 dark:text-brand-muted leading-relaxed text-sm">{role.desc}</p>
                      
                      <div className="space-y-2 pt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white/90">Desired Competencies:</span>
                        <ul className="list-disc pl-5 text-xs text-slate-500 dark:text-brand-muted space-y-1">
                          {role.requirements.map((req, index) => (
                            <li key={index}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <Button 
                      variant="brand" 
                      size="lg" 
                      className="rounded-full px-8 shrink-0 group self-end md:self-auto"
                      onClick={() => handleApplyClick(role.id)}
                    >
                      Apply Now <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </GlowingCard>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Interactive Application Form */}
        <motion.section 
          ref={formRef}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-2xl mx-auto"
        >
          <GlowingCard>
            <div className="p-8 md:p-12 relative overflow-hidden">
              {/* Background gradient flare */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-cyan/5 blur-[80px] pointer-events-none" />

              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-brand-cyan/20 rounded-full flex items-center justify-center shrink-0">
                  <Briefcase className="w-6 h-6 text-brand-cyan" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Transmit Application</h3>
                  <p className="text-sm text-brand-muted">Architect your career path. Fill in details below.</p>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {isSubmitted ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="py-12 text-center"
                  >
                    <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10" />
                    </div>
                    <h4 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Application Received</h4>
                    <p className="text-slate-600 dark:text-brand-muted text-base leading-relaxed mb-8 max-w-md mx-auto">
                      Your credentials have been securely transmitted. Our talent architects will review your portfolio and reach out within 48 hours.
                    </p>
                    <Button variant="outline" className="rounded-full px-8" onClick={() => setIsSubmitted(false)}>
                      Submit Another Path
                    </Button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label htmlFor="name-input" className="text-xs font-bold uppercase tracking-widest text-brand-muted">Your Name</label>
                        <input 
                          id="name-input"
                          required
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 outline-none focus:border-brand-cyan transition-all text-slate-900 dark:text-white text-sm"
                          placeholder="Adnan Bashir"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="email-input" className="text-xs font-bold uppercase tracking-widest text-brand-muted">Email Address</label>
                        <input 
                          id="email-input"
                          required
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 outline-none focus:border-brand-cyan transition-all text-slate-900 dark:text-white text-sm"
                          placeholder="adnan@company.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="role-select" className="text-xs font-bold uppercase tracking-widest text-brand-muted">Target Career Path</label>
                      <select 
                        id="role-select"
                        title="Target Career Path Select"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 outline-none focus:border-brand-cyan transition-all text-slate-900 dark:text-white text-sm"
                      >
                        {roles.map((role) => (
                          <option key={role.id} value={role.id} className="bg-white dark:bg-brand-dark text-slate-900 dark:text-white">
                            {role.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="portfolio-input" className="text-xs font-bold uppercase tracking-widest text-brand-muted flex items-center gap-1">
                        <LinkIcon className="w-3.5 h-3.5 text-brand-cyan" />
                        LinkedIn / Portfolio URL
                      </label>
                      <input 
                        id="portfolio-input"
                        required
                        type="url"
                        value={formData.portfolio}
                        onChange={(e) => setFormData({ ...formData, portfolio: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 outline-none focus:border-brand-cyan transition-all text-slate-900 dark:text-white text-sm"
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="pitch-input" className="text-xs font-bold uppercase tracking-widest text-brand-muted">Why BITSOL? (Short Pitch)</label>
                      <textarea 
                        id="pitch-input"
                        required
                        rows={4}
                        value={formData.pitch}
                        onChange={(e) => setFormData({ ...formData, pitch: e.target.value })}
                        className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-4 outline-none focus:border-brand-cyan transition-all text-slate-900 dark:text-white text-sm"
                        placeholder="Tell us about a cool project you engineered or how you drive search engine rankings..."
                      />
                    </div>

                    {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

                    <Button 
                      type="submit" 
                      variant="brand" 
                      size="lg" 
                      className="w-full py-8 text-xl font-bold rounded-xl group"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Transmitting..." : "Send Application"}
                      <Send className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-0.5" />
                    </Button>
                  </form>
                )}
              </AnimatePresence>
            </div>
          </GlowingCard>
        </motion.section>

      </div>
    </div>
  );
}
