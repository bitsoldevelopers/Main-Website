"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HOMEPAGE_SCENES, sceneIndexForProgress, type HomeScene, type SceneCta } from "@/config/homepage-scenes";

// Three.js and R3F stay out of the homepage's initial bundle.
const SceneCanvas = dynamic(() => import("@/components/3d/SceneCanvas"), { ssr: false });

/** Total scroll length of the sticky stage, in viewport heights. */
const STAGE_HEIGHT_VH = HOMEPAGE_SCENES.length * 100;

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Sends a CTA click to the existing GTM/GA4 dataLayer. No form data or personal information. */
function trackCta(id: string) {
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: "homepage_cta_click", cta_id: id });
  } catch {
    // Analytics is best-effort.
  }
}

function SceneCta({ cta }: { cta: SceneCta }) {
  const label = (
    <Button variant={cta.variant} size="lg" className="rounded-full px-8">
      {cta.label}
      <ArrowRight className="ml-2 h-4 w-4" />
    </Button>
  );
  const onClick = () => trackCta(cta.id);

  if (cta.href.startsWith("http")) {
    return (
      <a href={cta.href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {label}
      </a>
    );
  }
  return (
    <Link href={cta.href} onClick={onClick}>
      {label}
    </Link>
  );
}

function SceneCopy({
  scene,
  isFirst,
  sticky,
  active,
}: {
  scene: HomeScene;
  isFirst: boolean;
  sticky: boolean;
  active: boolean;
}) {
  const headingId = `scene-${scene.id}-heading`;
  const Heading = isFirst ? "h1" : "h2";

  const wrapperClass = sticky
    ? `absolute inset-x-0 top-[var(--nav-height)] bottom-0 flex items-center transition-opacity duration-700 ${
        active ? "opacity-100" : "pointer-events-none opacity-0"
      }`
    : "relative";

  return (
    <section
      aria-labelledby={headingId}
      className={wrapperClass}
      // Inactive scenes are visually hidden in the sticky stage, so keep them out of the tab order.
      inert={sticky && !active ? true : undefined}
    >
      <div className={sticky ? "w-full max-w-2xl px-6 lg:px-16" : "container mx-auto max-w-3xl px-6 py-16"}>
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-brand-cyan">{scene.eyebrow}</p>
        <Heading
          id={headingId}
          className="mb-6 text-4xl font-bold leading-tight text-slate-900 md:text-6xl dark:text-white"
        >
          {scene.heading}
        </Heading>
        <p className="mb-6 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">{scene.body}</p>
        {scene.points && (
          <ul className="mb-8 grid max-w-xl gap-2 text-base text-slate-700 dark:text-slate-200">
            {scene.points.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-cyan" />
                {point}
              </li>
            ))}
          </ul>
        )}
        {scene.ctas && scene.ctas.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {scene.ctas.map((cta) => (
              <SceneCta key={cta.id} cta={cta} />
            ))}
          </div>
        )}
        <p className="sr-only">{scene.visualDescription}</p>
      </div>
    </section>
  );
}

export default function ImmersiveHomepage() {
  // Server and first client render both use the static layout, so markup matches and all copy is in the HTML for search engines.
  const [sticky, setSticky] = useState(false);
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(true);
  const outerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);

  // Choose the layout after mount: desktop, motion allowed and WebGL available.
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSticky(desktop.matches && !reduced.matches && canUseWebGL());
    update();
    desktop.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  // Scroll progress is written to a ref. React state only changes when the active scene changes.
  useEffect(() => {
    const el = outerRef.current;
    if (!sticky || !el) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const progress = total > 0 ? Math.min(Math.max(-rect.top / total, 0), 1) : 0;
      progressRef.current = progress;
      setActive(sceneIndexForProgress(progress));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sticky]);

  // Pause rendering when the stage is off-screen.
  useEffect(() => {
    const el = outerRef.current;
    if (!sticky || !el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [sticky]);

  return (
    <div
      ref={outerRef}
      className="relative w-full"
      style={sticky ? { height: `${STAGE_HEIGHT_VH}vh` } : undefined}
    >
      <div className={sticky ? "sticky top-0 h-screen w-full overflow-hidden" : "relative w-full"}>
        {sticky && (
          <div
            className="absolute right-0 bottom-0 top-[var(--nav-height)] w-full lg:w-3/5"
            aria-hidden="true"
            data-homepage-stage="3d"
          >
            <SceneCanvas progressRef={progressRef} paused={!visible} />
          </div>
        )}
        <div className={sticky ? "relative h-full" : "relative bg-transparent pt-[var(--nav-height)]"}>
          {HOMEPAGE_SCENES.map((scene, i) => (
            <SceneCopy key={scene.id} scene={scene} isFirst={i === 0} sticky={sticky} active={i === active} />
          ))}
        </div>
      </div>
    </div>
  );
}
