"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { SplineScene } from "@/components/ui/splite";
import { Spotlight } from "@/components/ui/spotlight";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useHasMounted } from "@/components/navbar/NavPortal";

export function SplineSceneBasic() {
  const { theme } = useTheme();
  const mounted = useHasMounted();
  const [showSpline, setShowSpline] = useState(false);

  useEffect(() => {
    // Skip the heavy 3D scene on small screens — saves ~800KB of JS + the scene file
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1024px)").matches) {
      return;
    }
    // Defer Spline until the browser is idle so it doesn't block first paint / LCP
    const w = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    const idle = w.requestIdleCallback
      ? w.requestIdleCallback(() => setShowSpline(true), { timeout: 2500 })
      : window.setTimeout(() => setShowSpline(true), 1500);
    return () => {
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle as number);
      else window.clearTimeout(idle as number);
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden bg-transparent">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill={mounted && theme === "light" ? "#656565" : "white"}
      />
      
      <div className="flex h-full flex-col md:flex-row container mx-auto px-6 relative z-10">
        {/* Left content */}
        <div className="flex-1 px-6 pb-12 pt-[calc(var(--nav-height)+2rem)] md:p-12 relative z-10 flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-cyan mb-4">
            Result-Driven Digital Marketing Agency in Pakistan
          </p>
          <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500 dark:from-neutral-50 dark:to-neutral-400 mb-6">
            Grow Your Business with{" "}
            <span className="text-brand-cyan">BITSOL Marketing</span>
          </h1>
          <p className="mt-4 text-black dark:text-neutral-300 max-w-lg text-lg leading-relaxed mb-10">
            Result-driven SEO, social media marketing, and web solutions that help brands rank higher, generate leads, and increase revenue.
          </p>

          <div className="flex flex-wrap gap-4">
            <Link href="/contact">
              <Button variant="brand" size="lg" className="rounded-full px-8">
                Get Free Consultation <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-slate-200 dark:border-white/10 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full px-8">
                View Packages
              </Button>
            </Link>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 relative">
          {showSpline && (
            <SplineScene
              scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
              className="w-full h-full"
            />
          )}
        </div>
      </div>
    </div>
  )
}
