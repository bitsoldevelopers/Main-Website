"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// Three.js stays out of the homepage's initial bundle.
const SceneCanvas = dynamic(() => import("@/components/3d/SceneCanvas"), { ssr: false });

function canUseWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * The hero's abstract object: the ink-and-paper constellation from the 3D
 * scene, held at one layout and left to sway. Desktop only, skipped under
 * reduced motion or without WebGL, and paused while off-screen.
 */
export default function HeroObject() {
  const progressRef = useRef(0.2);
  const hostRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 768px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setShow(wide.matches && !reduced.matches && canUseWebGL());
    update();
    wide.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const el = hostRef.current;
    if (!show || !el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [show]);

  return (
    <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {show && (
        <SceneCanvas progressRef={progressRef} paused={!visible} palette="mono" spreadX={2.4} nodeScale={1.6} />
      )}
    </div>
  );
}
