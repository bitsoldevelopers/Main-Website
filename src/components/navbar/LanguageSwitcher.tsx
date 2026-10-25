"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Check } from "lucide-react";
import { useOutsideClick } from "@/hooks/useOutsideClick";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ur", label: "اردو" },
] as const;

function getStoredLang(): (typeof LANGUAGES)[number]["code"] {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("bitsol-lang");
  return stored === "ur" ? "ur" : "en";
}

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState(getStoredLang);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, () => setOpen(false), open);

  const select = (code: (typeof LANGUAGES)[number]["code"]) => {
    setLang(code);
    window.localStorage.setItem("bitsol-lang", code);
    document.documentElement.setAttribute("lang", code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open ? "true" : "false"}
        aria-label="Change language"
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 hover:text-[#0066ff] dark:text-slate-300 dark:hover:bg-white/10"
      >
        <Globe className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-36 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-[#141414]"
          >
            <ul role="listbox" aria-label="Select language">
              {LANGUAGES.map((l) => (
                <li key={l.code} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={lang === l.code ? "true" : "false"}
                    onClick={() => select(l.code)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                  >
                    {l.label}
                    {lang === l.code && <Check className="h-3.5 w-3.5 text-[#0066ff] dark:text-brand-cyan" />}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
