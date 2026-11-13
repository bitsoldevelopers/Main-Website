"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * Small hand-drawn charts for the dashboard, in SVG/HTML so they follow the
 * admin theme (light/dark, primary colour) through CSS variables. Mark specs
 * follow the dataviz guidance: 2px lines, columns at most 24px wide with a
 * 4px rounded data end and a square baseline, a 2px surface gap between
 * segments, and a tooltip on hover and keyboard focus. Every chart also
 * carries a text summary for screen readers.
 */

export interface Noun {
  one: string;
  other: string;
}

function count(value: number, noun?: Noun) {
  const n = value.toLocaleString("en-US");
  return noun ? `${n} ${value === 1 ? noun.one : noun.other}` : n;
}

function onArrowKeys(e: KeyboardEvent, length: number, current: number | null, set: (i: number) => void) {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  e.preventDefault();
  const from = current ?? length - 1;
  set(Math.min(length - 1, Math.max(0, from + (e.key === "ArrowRight" ? 1 : -1))));
}

/** Monotone cubic path (no overshoot below zero) through points in a 0–100 box. */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M0,${ys[0]} L100,${ys[0]}`;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(xs[i + 1] - xs[i]);
    slope.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const t: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(slope[i - 1] * slope[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / slope[i - 1] + (dx[i] + 2 * dx[i - 1]) / slope[i]));
  }
  t.push(slope[n - 2]);
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${xs[i] + h},${ys[i] + h * t[i]} ${xs[i + 1] - h},${ys[i + 1] - h * t[i + 1]} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

// ─── Area ───────────────────────────────────────────────────────────────────

/** A single-series area chart that bleeds to the card edges. */
export function AreaChart({
  points,
  height = 110,
  noun,
  label,
  className,
}: {
  points: { label: string; value: number }[];
  height?: number;
  noun?: Noun;
  /** What the series is, for the accessible summary. */
  label: string;
  className?: string;
}) {
  const gradientId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.value));
  const xs = points.map((_, i) => (n === 1 ? 50 : (i / (n - 1)) * 100));
  // Leave headroom for the end dot and a little floor for the stroke.
  const ys = points.map((p) => 92 - (p.value / max) * 76);
  const line = monotonePath(xs, ys);
  const active = hover ?? n - 1;
  const summary = `${label}: ${points.map((p) => `${p.label} ${count(p.value, noun)}`).join(", ")}.`;

  if (n === 0) return null;

  return (
    <div
      ref={ref}
      className={cn("relative touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-adm-primary/40", className)}
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={summary}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || n < 2) return;
        setHover(Math.round(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * (n - 1)));
      }}
      onPointerLeave={() => setHover(null)}
      onFocus={() => setHover(n - 1)}
      onBlur={() => setHover(null)}
      onKeyDown={(e) => onArrowKeys(e, n, hover, setHover)}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--adm-primary)", stopOpacity: 0.22 }} />
            <stop offset="1" style={{ stopColor: "var(--adm-primary)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={`${line} L100,100 L0,100 Z`} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--adm-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {hover !== null && (
        <span className="pointer-events-none absolute inset-y-0 w-px bg-slate-300" style={{ left: `${xs[hover]}%` }} aria-hidden />
      )}
      <span
        className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-adm-primary ring-2 ring-adm-paper"
        style={{ left: `${xs[active]}%`, top: `${ys[active]}%` }}
        aria-hidden
      />
      {hover !== null && <Tooltip x={xs[hover]} y={ys[hover]} value={count(points[hover].value, noun)} label={points[hover].label} />}
    </div>
  );
}

function Tooltip({ x, y, value, label }: { x: number; y: number; value: string; label: string }) {
  return (
    <span
      className="pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-md bg-adm-paper px-2.5 py-1.5 text-start"
      style={{
        left: `${Math.min(82, Math.max(18, x))}%`,
        top: `calc(${y}% - 10px)`,
        translate: "-50% 0",
        boxShadow: "var(--adm-shadow-lg)",
      }}
      aria-hidden
    >
      <span className="block text-[0.8125rem] font-medium text-slate-900">{value}</span>
      <span className="block text-xs text-slate-500">{label}</span>
    </span>
  );
}

// ─── Columns ────────────────────────────────────────────────────────────────

/**
 * Columns from one baseline. The tallest (or `highlight`) column is drawn in
 * the primary colour and labelled at its cap; the others are a lighter step
 * of the same hue and show their value on hover or focus.
 */
export function ColumnChart({
  bars,
  height = 160,
  highlight,
  noun,
  label,
  className,
}: {
  bars: { label: string; value: number; title?: string }[];
  height?: number;
  highlight?: number;
  noun?: Noun;
  label: string;
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const peak = highlight ?? bars.reduce((best, b, i) => (b.value > bars[best].value ? i : best), 0);
  const summary = `${label}: ${bars.map((b) => `${b.title ?? b.label} ${count(b.value, noun)}`).join(", ")}.`;

  return (
    <div className={className}>
      <div
        className="flex items-end gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-adm-primary/40"
        style={{ height }}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onFocus={() => setHover(peak)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => onArrowKeys(e, bars.length, hover, setHover)}
        onPointerLeave={() => setHover(null)}
      >
        {bars.map((bar, i) => {
          const pct = (bar.value / max) * 100;
          const showValue = i === hover || (hover === null && i === peak && bar.value > 0);
          return (
            <div key={`${bar.label}-${i}`} className="relative flex h-full min-w-0 flex-1 flex-col items-center justify-end pt-6" onPointerEnter={() => setHover(i)}>
              {showValue && (
                <span className="absolute inset-x-0 text-center text-[0.8125rem] font-medium tabular-nums text-slate-900" style={{ bottom: `calc((${height}px - 1.5rem) * ${(pct / 100).toFixed(4)} + 0.25rem)` }}>
                  {bar.value.toLocaleString("en-US")}
                </span>
              )}
              <span
                className={cn(
                  "block w-full max-w-6 rounded-t-[4px] transition-colors",
                  bar.value === 0 ? "bg-slate-200" : i === peak ? "bg-adm-primary" : i === hover ? "bg-cyan-300" : "bg-cyan-100"
                )}
                style={{ height: bar.value === 0 ? 2 : `max(4px, ${pct}%)` }}
                title={`${bar.title ?? bar.label}: ${count(bar.value, noun)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {bars.map((bar, i) => (
          <span key={`${bar.label}-${i}`} className={cn("min-w-0 flex-1 truncate text-center text-[0.8125rem]", i === hover ? "text-slate-900" : "text-slate-400")}>
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Radial gauge ───────────────────────────────────────────────────────────

/** A 270° meter with the percentage in the middle. `null` means no data yet. */
export function RadialGauge({ value, label, size = 200 }: { value: number | null; label: string; size?: number }) {
  const r = 80;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size * 0.88 }} role="img" aria-label={value === null ? `${label}: no data yet` : `${label}: ${Math.round(pct)}%`}>
      <svg viewBox="0 0 200 176" className="h-full w-full" aria-hidden>
        <g transform="rotate(135 100 100)">
          <circle cx="100" cy="100" r={r} fill="none" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${arc} ${c}`} className="stroke-cyan-100" />
          {pct > 0 && (
            <circle
              cx="100"
              cy="100"
              r={r}
              fill="none"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${(arc * pct) / 100} ${c}`}
              stroke="var(--adm-primary)"
              className="transition-[stroke-dasharray] duration-700"
            />
          )}
        </g>
      </svg>
      <div className="absolute inset-x-0 top-[38%] text-center">
        <p className="text-[0.8125rem] text-slate-500">{label}</p>
        <p className="text-[1.75rem] font-medium leading-tight text-slate-900">{value === null ? "—" : `${Math.round(pct)}%`}</p>
      </div>
    </div>
  );
}

// ─── Parts of a whole ───────────────────────────────────────────────────────

const PART_COLOR = { primary: "bg-adm-primary", second: "bg-adm-chart-2" } as const;

/** A thin bar split into parts with a 2px gap; a part at zero draws nothing. */
export function SegmentBar({
  parts,
  className,
}: {
  parts: { label: string; value: number; color: keyof typeof PART_COLOR }[];
  className?: string;
}) {
  const total = parts.reduce((sum, p) => sum + p.value, 0);
  const summary = parts.map((p) => `${p.label} ${p.value} (${total ? Math.round((p.value / total) * 100) : 0}%)`).join(", ");
  if (total === 0) return <div className={cn("h-2 rounded-full bg-slate-200", className)} role="img" aria-label="No data yet" />;
  return (
    <div className={cn("flex h-2 gap-0.5", className)} role="img" aria-label={summary}>
      {parts
        .filter((p) => p.value > 0)
        .map((p) => (
          <span
            key={p.label}
            className={cn("h-full rounded-full", PART_COLOR[p.color])}
            style={{ width: `${(p.value / total) * 100}%` }}
            title={`${p.label}: ${p.value} (${Math.round((p.value / total) * 100)}%)`}
          />
        ))}
    </div>
  );
}

const METER_TONE = {
  cyan: { track: "bg-cyan-100", fill: "bg-cyan-600" },
  purple: { track: "bg-violet-100", fill: "bg-violet-500" },
  green: { track: "bg-emerald-100", fill: "bg-emerald-500" },
  amber: { track: "bg-amber-100", fill: "bg-amber-500" },
  red: { track: "bg-red-100", fill: "bg-red-500" },
  slate: { track: "bg-slate-200", fill: "bg-slate-500" },
} as const;

/** A progress meter: the unfilled track is a lighter step of the fill's hue. */
export function Meter({ value, tone = "cyan", label, className }: { value: number; tone?: keyof typeof METER_TONE; label: string; className?: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full", METER_TONE[tone].track, className)}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", METER_TONE[tone].fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
