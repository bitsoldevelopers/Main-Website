"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface SectionTab {
  label: string;
  href: string;
  count?: number;
}

/**
 * Second-level navigation of the automation area. The most specific match
 * wins, so /admin/automation/sources/google-sheets lights up "Sources" and
 * not "Overview".
 */
export function AutomationTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();
  const active = tabs
    .filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav aria-label="Automation sections" className="-mx-1 mb-6 overflow-x-auto px-1">
      <ul className="flex min-w-max gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const current = tab.href === active;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  current ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                {tab.label}
                {typeof tab.count === "number" && tab.count > 0 && (
                  <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", current ? "bg-white/20" : "bg-slate-200 text-slate-700")}>
                    {tab.count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
