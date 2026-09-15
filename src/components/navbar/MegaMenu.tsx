"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { MegaMenuColumn } from "@/lib/navigation";

interface MegaMenuProps {
  columns: MegaMenuColumn[];
  /** Landing page for the section, so the dropdown itself is reachable. */
  hub?: { name: string; href: string };
  onNavigate: () => void;
}

const containerVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 300, damping: 28, staggerChildren: 0.03 },
  },
  exit: { opacity: 0, y: 8, scale: 0.98, filter: "blur(4px)", transition: { duration: 0.15 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export function MegaMenu({ columns, hub, onNavigate }: MegaMenuProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="absolute left-1/2 top-full z-40 mt-3 w-[92vw] max-w-5xl -translate-x-1/2"
      role="menu"
    >
      <div className="rounded-[22px] border border-white/15 bg-white/90 p-8 shadow-[0_25px_70px_rgba(0,0,0,0.15)] backdrop-blur-2xl dark:bg-[#0B1120]/90 dark:border-white/10">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {columns.map((column) => (
          <div key={column.heading}>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-[#185FA5] dark:text-brand-cyan">
              {column.heading}
            </h3>
            <ul className="flex flex-col gap-1">
              {column.items.map((item) => (
                <motion.li key={item.title} variants={itemVariants}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    role="menuitem"
                    className="group/item relative flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-all duration-200 hover:border-[#185FA5]/20 hover:bg-gradient-to-r hover:from-[#185FA5]/[0.07] hover:to-[#06B6D4]/[0.07] dark:hover:border-white/10"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[#185FA5] transition-all duration-200 group-hover/item:scale-110 group-hover/item:bg-[#185FA5] group-hover/item:text-white dark:bg-white/5 dark:text-brand-cyan">
                      <item.icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-brand-muted">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {hub && (
        <div className="mt-6 border-t border-slate-200/80 pt-4 dark:border-white/10">
          <Link
            href={hub.href}
            onClick={onNavigate}
            className="group/hub inline-flex items-center gap-1.5 text-sm font-semibold text-[#185FA5] dark:text-brand-cyan"
          >
            View all {hub.name}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/hub:translate-x-0.5" />
          </Link>
        </div>
      )}
      </div>
    </motion.div>
  );
}
