"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export interface ColumnDatum {
  key: string;
  /** Short label for the axis ("Sep 29"). */
  label: string;
  value: number;
}

/** 0, then the smallest "clean" step that fits the largest value in four bands. */
function axisTop(max: number): number {
  if (max <= 4) return 4;
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  return step * 4;
}

const PLOT_HEIGHT = 160;

/**
 * Single-series column chart: one hue, thin columns with a rounded data end
 * and a square baseline, hairline grid. Every column takes hover and
 * keyboard focus, and the same numbers are one click away as a table, so no
 * value depends on the tooltip.
 */
export function ColumnChart({ data, unit, caption }: { data: ColumnDatum[]; unit: string; caption: string }) {
  const [active, setActive] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();

  const max = Math.max(0, ...data.map((d) => d.value));
  const top = axisTop(max);
  const ticks = [top, top * 0.75, top * 0.5, top * 0.25, 0];
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const current = data.find((d) => d.key === active) ?? null;
  // Roughly seven labels, however many columns there are.
  const every = Math.max(1, Math.ceil(data.length / 7));

  return (
    <figure>
      <div className="mb-3 flex items-center justify-between gap-3">
        <figcaption className="text-xs text-slate-500">{caption}</figcaption>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          aria-pressed={table}
          aria-controls={id}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>

      <div id={id}>
        {table ? (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-500">Day</th>
                  <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-widest text-slate-500">{unit}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((d) => (
                  <tr key={d.key} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-600">{d.label}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-900">{d.value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : total === 0 ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500" style={{ height: PLOT_HEIGHT + 28 }}>
            Nothing in this period yet.
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex shrink-0 flex-col justify-between pb-7 text-right text-[11px] tabular-nums text-slate-500" style={{ height: PLOT_HEIGHT + 28 }}>
              {ticks.map((tick) => (
                <span key={tick} className="leading-none">
                  {tick.toLocaleString()}
                </span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: PLOT_HEIGHT }}>
                {ticks.map((tick) => (
                  <span key={tick} className={cn("block h-px w-full", tick === 0 ? "bg-slate-300" : "bg-slate-100")} />
                ))}
              </div>

              <div className="relative flex items-end" style={{ height: PLOT_HEIGHT }} onMouseLeave={() => setActive(null)}>
                {data.map((d) => {
                  const height = top > 0 ? (d.value / top) * PLOT_HEIGHT : 0;
                  return (
                    <button
                      key={d.key}
                      type="button"
                      // The whole band is the target, not just the painted column.
                      className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                      onMouseEnter={() => setActive(d.key)}
                      onFocus={() => setActive(d.key)}
                      onBlur={() => setActive(null)}
                      aria-label={`${d.label}: ${d.value.toLocaleString()} ${unit.toLowerCase()}`}
                    >
                      <span
                        className={cn(
                          "block w-full max-w-[24px] rounded-t-[4px] bg-[#0891b2] transition-[filter,opacity]",
                          active && active !== d.key && "opacity-50",
                          "group-focus-visible:ring-2 group-focus-visible:ring-slate-900 group-focus-visible:ring-offset-2"
                        )}
                        style={{ height: d.value > 0 ? Math.max(2, height) : 0, marginInline: 1 }}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="flex h-7 items-end">
                {data.map((d, i) => (
                  <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[11px] text-slate-500">
                    {(data.length - 1 - i) % every === 0 ? d.label : ""}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {!table && total > 0 && (
        <p className="mt-2 min-h-5 text-xs text-slate-500" aria-live="polite">
          {current ? (
            <>
              <span className="font-bold tabular-nums text-slate-900">{current.value.toLocaleString()}</span> {unit.toLowerCase()} on {current.label}
            </>
          ) : (
            <>
              <span className="font-bold tabular-nums text-slate-900">{total.toLocaleString()}</span> {unit.toLowerCase()} in total. Hover or tab through the
              columns for each day.
            </>
          )}
        </p>
      )}
    </figure>
  );
}
