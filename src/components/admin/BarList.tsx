import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A bar-per-row breakdown: label, bar, value. One hue because the bars
 * encode magnitude only; identity is carried by the label column. Bars are
 * 8px thick with a rounded data end and a square baseline.
 */
export function BarList({
  items,
  className,
}: {
  items: { label: ReactNode; value: number; title?: string }[];
  className?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item, i) => (
        <li key={i} className="grid grid-cols-[minmax(0,132px)_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm" title={item.title}>
          <span className="truncate text-slate-500">{item.label}</span>
          <span className="h-2 overflow-hidden rounded-r-[4px] bg-slate-200">
            <span
              className="block h-full rounded-r-[4px] bg-brand-cyan transition-[width] duration-500"
              style={{ width: `${Math.round((item.value / max) * 100)}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums text-slate-900">{item.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
