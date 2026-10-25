"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useMotionValueEvent, useScroll } from "framer-motion";
import { services } from "@/lib/services";
import { Tag } from "@/components/home/editorial";
import Sculpture, { SCULPTURES } from "@/components/home/Sculpture";

/**
 * Services, as a pinned scroll: the stage stays fixed while the page scrolls
 * through the list. A dial on the left turns so the current number sits at
 * its rightmost point, the service blocks slide through the centre (the
 * next one waiting below, blurred), and a clay object on the right changes
 * with each service. Below the laptop breakpoint it is a plain list.
 */

const STEP_VH = 70; // scroll distance per service
const ANGLE = 22; // degrees between numbers on the dial
const RADIUS = 575; // px
const DIAL_EDGE = 275; // x of the dial's rightmost point, from the stage's left edge
const ROW = 440; // px between stacked service blocks

const pad = (i: number) => String(i + 1).padStart(2, "0");

export default function ServicesGrid() {
  const n = services.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ["start start", "end end"] });
  const [pos, setPos] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setPos(Math.min(n - 1, Math.max(0, v * (n - 1))));
  });
  const active = Math.round(pos);

  return (
    <section aria-labelledby="services-heading">
      <h2 id="services-heading" className="sr-only">
        Services
      </h2>

      {/* Pinned stage, laptop and up */}
      <div
        ref={stageRef}
        className="relative hidden lg:block"
        style={{ height: `calc(100vh + ${(n - 1) * STEP_VH}vh)` }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          {/* Dial */}
          <div
            aria-hidden="true"
            className="absolute top-1/2 hidden xl:block"
            style={{
              left: DIAL_EDGE - RADIUS * 2,
              width: RADIUS * 2,
              height: RADIUS * 2,
              transform: `translateY(-50%) rotate(${-pos * ANGLE}deg)`,
            }}
          >
            <div className="absolute inset-0 rounded-full border border-black/[0.09]" />
            {services.map((_, i) => {
              const d = Math.abs(i - pos);
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 font-heading text-[30px] leading-none transition-colors duration-300"
                  style={{
                    transform: `translate(-50%,-50%) rotate(${i * ANGLE}deg) translateX(${RADIUS + 46}px)`,
                    color: i === active ? "#141414" : "#a4a4a4",
                    opacity: Math.max(0.25, 1 - d * 0.35),
                  }}
                >
                  {pad(i)}
                </span>
              );
            })}
          </div>
          <span
            aria-hidden="true"
            className="absolute top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--brand-accent)] xl:block"
            style={{ left: DIAL_EDGE - 4 }}
          />

          {/* Service blocks */}
          <div className="absolute left-[72px] top-1/2 w-[520px] xl:left-[35%]">
            {services.map((service, i) => {
              const off = i - pos;
              const d = Math.abs(off);
              if (d > 1.6) return null;
              const current = i === active;
              return (
                <div
                  key={service.slug}
                  className="absolute left-0 top-0 w-full will-change-transform"
                  style={{
                    transform: `translateY(calc(-50% + ${off * ROW}px))`,
                    opacity: Math.max(0, 1 - d * 0.72),
                    filter: `blur(${Math.min(12, d * 10)}px)`,
                    pointerEvents: current ? "auto" : "none",
                  }}
                  aria-hidden={current ? undefined : "true"}
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground xl:hidden">
                    {pad(i)}
                  </span>
                  <h3 className="mt-3 text-[48px] leading-[1.02] xl:mt-0 xl:text-[56px]">
                    <Link href={`/services/${service.slug}`} className="group inline-flex items-start gap-3">
                      <span>{service.title}</span>
                      <ArrowUpRight className="mt-3 h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </h3>
                  <p className="mt-4 max-w-[440px] text-[17px] leading-relaxed text-muted-foreground">{service.desc}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {service.features.slice(0, 3).map((feature) => (
                      <Tag key={feature}>{feature}</Tag>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sculpture */}
          <div className="absolute right-[-140px] top-1/2 h-[520px] w-[520px] -translate-y-1/2">
            {services.map((service, i) => {
              const off = i - pos;
              const d = Math.abs(off);
              if (d > 1.4) return null;
              return (
                <Sculpture
                  key={service.slug}
                  kind={SCULPTURES[i % SCULPTURES.length]}
                  className="absolute inset-0 will-change-transform"
                  style={{
                    opacity: Math.max(0, 1 - d * 1.1),
                    transform: `rotate(${off * 28}deg) scale(${1 - d * 0.14})`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Plain list, tablets and phones */}
      <div className="wrap py-20 lg:hidden">
        <ol className="divide-y divide-border border-y border-border">
          {services.map((service, i) => (
            <li key={service.slug} className="py-9">
              <Link href={`/services/${service.slug}`} className="group block">
                <span className="font-heading text-2xl text-[#a4a4a4]">{pad(i)}</span>
                <h3 className="mt-3 text-[34px] leading-[1.04]">{service.title}</h3>
                <p className="mt-3 text-[16px] leading-relaxed text-muted-foreground">{service.desc}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {service.features.slice(0, 3).map((feature) => (
                    <Tag key={feature}>{feature}</Tag>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
