"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Phone, Mail, ArrowRight, X } from "lucide-react";
import { DIcons } from "@/components/ui/dicons";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { primaryNav, contactInfo } from "@/lib/navigation";
import { NavPortal } from "./NavPortal";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMenu({ open, onClose }: MobileMenuProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setOpenSection(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    document.body.classList.add("body-scroll-lock");

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && contentRef.current) {
        const focusables = contentRef.current.querySelectorAll<HTMLElement>(
          'a, button, [tabindex="0"]'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else if (document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("body-scroll-lock");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  return (
    <NavPortal>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="mobile-menu-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          <motion.div
            ref={contentRef}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="mobile-menu-content"
          >
            <div className="flex items-center justify-between px-6 pt-6">
              <Link href="/" className="flex items-center gap-2" onClick={onClose}>
                <Logo className="h-10 w-10" />
                <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  BITSOL<span className="text-[#06B6D4]">.</span>
                </span>
              </Link>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={onClose}
                className="rounded-full border border-slate-200 p-2.5 text-slate-700 transition-colors hover:border-[#185FA5] hover:text-[#185FA5] dark:border-white/15 dark:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <ul className="flex flex-col gap-1">
                {primaryNav.map((item) => (
                  <li key={item.name} className="border-b border-slate-100 dark:border-white/5">
                    {item.columns ? (
                      <div>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between py-4 text-left text-lg font-semibold text-slate-900 dark:text-white"
                          aria-expanded={openSection === item.name ? "true" : "false"}
                          onClick={() =>
                            setOpenSection((cur) => (cur === item.name ? null : item.name))
                          }
                        >
                          {item.name}
                          <ChevronDown
                            className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${
                              openSection === item.name ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {openSection === item.name && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden"
                            >
                              <div className="flex flex-col gap-5 pb-5 pl-1">
                                {item.columns.map((col) => (
                                  <div key={col.heading}>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-[#185FA5] dark:text-brand-cyan">
                                      {col.heading}
                                    </p>
                                    <div className="flex flex-col gap-0.5">
                                      {col.items.map((sub) => (
                                        <Link
                                          key={sub.title}
                                          href={sub.href}
                                          onClick={onClose}
                                          className="flex items-center gap-2 rounded-lg py-2 text-sm text-slate-600 hover:text-[#185FA5] dark:text-brand-muted dark:hover:text-white"
                                        >
                                          <sub.icon className="h-4 w-4 shrink-0 opacity-70" />
                                          {sub.title}
                                        </Link>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="block py-4 text-lg font-semibold text-slate-900 hover:text-[#185FA5] dark:text-white dark:hover:text-brand-cyan"
                      >
                        {item.name}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto flex flex-col gap-4 border-t border-slate-100 px-6 py-6 dark:border-white/5">
              <div className="flex items-center justify-center gap-4">
                <a
                  href={`tel:${contactInfo.phone}`}
                  aria-label="Call us"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-[#185FA5] hover:text-[#185FA5] dark:border-white/15 dark:text-white"
                >
                  <Phone className="h-4.5 w-4.5" strokeWidth={1.75} />
                </a>
                <a
                  href={`https://wa.me/${contactInfo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp us"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-green-500 hover:text-green-500 dark:border-white/15 dark:text-white"
                >
                  <DIcons.WhatsApp className="h-4.5 w-4.5" />
                </a>
                <a
                  href={`mailto:${contactInfo.email}`}
                  aria-label="Email us"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-[#185FA5] hover:text-[#185FA5] dark:border-white/15 dark:text-white"
                >
                  <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
                </a>
                <a
                  href={contactInfo.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-[#185FA5] hover:text-[#185FA5] dark:border-white/15 dark:text-white"
                >
                  <DIcons.LinkedIn className="h-4.5 w-4.5" />
                </a>
                <a
                  href={contactInfo.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition-colors hover:border-[#185FA5] hover:text-[#185FA5] dark:border-white/15 dark:text-white"
                >
                  <DIcons.Instagram className="h-4.5 w-4.5" />
                </a>
              </div>
              <Link href="/contact" onClick={onClose}>
                <Button className="nav-cta-button w-full justify-center gap-2 py-6 text-base font-bold">
                  Book a Consultation
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </NavPortal>
  );
}
