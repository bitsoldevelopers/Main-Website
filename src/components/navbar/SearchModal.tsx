"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ArrowUpRight } from "lucide-react";
import { searchIndex } from "@/lib/navigation";
import { NavPortal } from "./NavPortal";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchIndex.slice(0, 8);
    return searchIndex
      .filter((p) => `${p.title} ${p.keywords}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
      document.body.classList.add("body-scroll-lock");
    } else {
      document.body.classList.remove("body-scroll-lock");
    }
    return () => document.body.classList.remove("body-scroll-lock");
  }, [open]);

  const navigate = (href: string) => {
    router.push(href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      navigate(results[activeIndex].href);
    }
  };

  return (
    <NavPortal>
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[360] flex items-start justify-center bg-slate-950/50 backdrop-blur-sm px-4 pt-[15vh]"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Site search"
        >
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl dark:bg-[#141414] dark:border-white/10"
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/10">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search services, solutions, pages…"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
                aria-label="Search"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="Search results">
              {results.length === 0 && (
                <li role="presentation" className="px-4 py-8 text-center text-sm text-slate-400">
                  No results for &ldquo;{query}&rdquo;
                </li>
              )}
              {results.map((page, i) => (
                <li
                  key={page.href + page.title}
                  role="option"
                  aria-selected={i === activeIndex ? "true" : "false"}
                  onClick={() => navigate(page.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-[#0066ff]/10 text-[#0066ff] dark:bg-brand-cyan/10 dark:text-brand-cyan"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="font-medium">{page.title}</span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 opacity-60" />
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </NavPortal>
  );
}
