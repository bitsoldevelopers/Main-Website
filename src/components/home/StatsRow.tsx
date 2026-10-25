"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

// The figures the homepage already showed; they are the owner's claims.
const stats = [
  { value: "150+", label: "Successful projects" },
  { value: "25+", label: "AI and marketing experts" },
  { value: "98%", label: "Satisfied clients" },
];

function parse(value: string): { n: number; suffix: string } {
  const m = value.match(/^([\d,.]+)(.*)$/);
  if (!m) return { n: 0, suffix: value };
  return { n: Number(m[1].replace(/,/g, "")), suffix: m[2] };
}

function Counter({ n }: { n: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduce = useReducedMotion();
  // Starts at the final figure so the markup is right without JS; the
  // count-up replays from zero once the row scrolls into view.
  const [shown, setShown] = useState(n);

  useEffect(() => {
    if (!inView || reduce) return;
    let raf = 0;
    const start = performance.now();
    const duration = 1500;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(n * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, n]);

  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString("en-US")}
    </span>
  );
}

/** Three figures in a centred row with hairlines between them; the suffix takes the accent. */
export default function StatsRow() {
  return (
    <section className="pb-24 md:pb-32">
      <div className="wrap">
        <dl className="mx-auto flex max-w-[900px] flex-col items-stretch justify-center divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
          {stats.map((stat) => {
            const { n, suffix } = parse(stat.value);
            return (
              <div key={stat.label} className="flex flex-1 flex-col items-center px-8 py-7 text-center sm:py-2">
                <dd className="flex items-baseline gap-1.5 font-heading text-[52px] leading-none md:text-[60px]">
                  <Counter n={n} />
                  <span className="text-[34px] text-[var(--brand-accent)] md:text-[38px]">{suffix}</span>
                </dd>
                <dt className="mt-3 text-[15px] text-muted-foreground">{stat.label}</dt>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
