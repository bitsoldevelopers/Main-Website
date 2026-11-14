"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import { GlowingCard } from "@/components/ui/glowing-card";
import { ContactForm } from "@/components/ContactForm";
import { X, MessageSquareText } from "lucide-react";

export function ContactPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);
  const { scrollYProgress } = useScroll();

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    // If user reaches 90% of the page and hasn't seen the popup yet
    if (latest > 0.9 && !hasShown && !isOpen) {
      setIsOpen(true);
      setHasShown(true);
    }
  });

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-contact-popup", handleOpen);
    return () => window.removeEventListener("open-contact-popup", handleOpen);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center z-[201] p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl pointer-events-auto"
            >
              <GlowingCard>
                <div className="p-8 md:p-12 relative">
                  {/* Close Button */}
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="absolute top-6 right-6 p-2 text-brand-muted hover:text-brand-cyan transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-brand-cyan/20 rounded-full flex items-center justify-center">
                      <MessageSquareText className="w-6 h-6 text-brand-cyan" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Let&apos;s Discuss Your Project</h3>
                      <p className="text-sm text-brand-muted">Drop us a line and we&apos;ll get back to you shortly.</p>
                    </div>
                  </div>

                  <ContactForm />
                </div>
              </GlowingCard>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
