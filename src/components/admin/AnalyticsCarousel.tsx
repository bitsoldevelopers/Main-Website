"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface CarouselSlide {
  /** Small label above the tiles, e.g. "Leads". */
  section: string;
  title: string;
  subtitle: string;
  tiles: { label: string; value: string }[];
}

/**
 * The primary-coloured headline card at the top of the dashboard: a few
 * slides of key numbers that rotate every few seconds. Rotation pauses on
 * hover and focus, and never runs when the visitor prefers reduced motion.
 */
export function AnalyticsCarousel({ slides, className }: { slides: CarouselSlide[]; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  const slide = slides[index] ?? slides[0];
  if (!slide) return null;

  return (
    <section
      className={cn("adm-hero relative overflow-hidden rounded-md", className)}
      aria-roledescription="carousel"
      aria-label="Highlights"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="absolute end-5 top-5 z-10 flex gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.section}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={`Show ${s.section}`}
            aria-current={i === index}
            className={cn("h-2 rounded-full transition-all", i === index ? "w-5 bg-[#ffffff]" : "w-2 bg-[#ffffff]/40 hover:bg-[#ffffff]/70")}
          />
        ))}
      </div>

      <div key={index} className="relative flex min-h-[15.5rem] items-stretch gap-4 p-6 animate-in fade-in-0 slide-in-from-right-3 duration-500" aria-live="polite">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="pe-16 text-[1.125rem] font-medium text-white">{slide.title}</h2>
          <p className="text-[0.8125rem] text-white/80">{slide.subtitle}</p>
          <p className="mb-3 mt-auto pt-5 text-[0.9375rem] font-medium text-white">{slide.section}</p>
          <dl className="grid max-w-[21rem] grid-cols-2 gap-x-4 gap-y-3">
            {slide.tiles.map((tile) => (
              <div key={tile.label} className="flex min-w-0 items-center gap-2">
                <dd className="min-w-[2.75rem] rounded bg-[#ffffff]/15 px-2 py-1 text-center text-[0.9375rem] font-medium text-white">{tile.value}</dd>
                <dt className="truncate text-[0.9375rem] text-white/90">{tile.label}</dt>
              </div>
            ))}
          </dl>
        </div>
        <Illustration className="hidden w-40 shrink-0 self-end sm:block md:w-44" />
      </div>
    </section>
  );
}

/** An original line-and-glass drawing of a dashboard, in white on the primary. */
function Illustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 180 160" className={className} aria-hidden fill="none">
      <rect x="18" y="22" width="132" height="104" rx="12" fill="#fff" fillOpacity="0.14" stroke="#fff" strokeOpacity="0.35" />
      <rect x="30" y="34" width="44" height="6" rx="3" fill="#fff" fillOpacity="0.55" />
      <rect x="30" y="46" width="28" height="4" rx="2" fill="#fff" fillOpacity="0.3" />
      <rect x="34" y="96" width="12" height="20" rx="3" fill="#fff" fillOpacity="0.35" />
      <rect x="52" y="84" width="12" height="32" rx="3" fill="#fff" fillOpacity="0.45" />
      <rect x="70" y="90" width="12" height="26" rx="3" fill="#fff" fillOpacity="0.35" />
      <rect x="88" y="72" width="12" height="44" rx="3" fill="#fff" fillOpacity="0.7" />
      <path d="M32 80 L50 70 L68 74 L86 58 L104 62" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="104" cy="62" r="4.5" fill="#fff" />
      <circle cx="140" cy="104" r="26" fill="#fff" fillOpacity="0.16" stroke="#fff" strokeOpacity="0.4" />
      <path d="M140 78 A26 26 0 0 1 163.4 115.3" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
      <circle cx="140" cy="104" r="11" fill="#fff" fillOpacity="0.25" />
      <circle cx="128" cy="30" r="14" fill="#fff" fillOpacity="0.2" stroke="#fff" strokeOpacity="0.45" />
      <path d="M122 30 l4.5 4.5 L134 26" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="160" cy="54" r="5" fill="#fff" fillOpacity="0.35" />
      <circle cx="12" cy="120" r="4" fill="#fff" fillOpacity="0.3" />
    </svg>
  );
}
