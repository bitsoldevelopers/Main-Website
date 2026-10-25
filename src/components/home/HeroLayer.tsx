"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

type Props = {
  children: React.ReactNode;
  className?: string;
  /**
   * Cursor parallax: how far (px) the layer sits away from the cursor when it
   * is at the frame's edge. Desktop with a fine pointer only.
   */
  drift?: number;
  /** Scroll parallax: how far (px) the layer has moved once `range` px are scrolled. */
  scrollShift?: number;
  /** Fade the layer out over the first `range` px of scroll. */
  fade?: boolean;
  /** The scroll distance the shift and fade play over. */
  range?: number;
};

/**
 * A hero layer that answers the cursor and the scroll. The entrances are CSS
 * (see `.hero-rise` in globals.css); this only adds the two things CSS cannot
 * do: lean the layer away from the pointer and parallax it as the page
 * leaves the hero. Both are off under reduced motion, and the pointer
 * listener is only attached while the layer is on screen.
 */
export default function HeroLayer({
  children,
  className,
  drift = 0,
  scrollShift = 0,
  fade = false,
  range = 600,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref);
  const { scrollY } = useScroll();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 55, damping: 18, mass: 0.7 });
  const sy = useSpring(py, { stiffness: 55, damping: 18, mass: 0.7 });

  useEffect(() => {
    if (!drift || reduce || !inView) return;
    const fine = window.matchMedia("(pointer: fine) and (min-width: 768px)");
    if (!fine.matches) return;

    const move = (event: PointerEvent) => {
      // -0.5 … 0.5 from the viewport centre, so the layer leans away from the cursor.
      const nx = event.clientX / window.innerWidth - 0.5;
      const ny = event.clientY / window.innerHeight - 0.5;
      px.set(-nx * 2 * drift);
      py.set(-ny * 2 * drift);
    };
    const rest = () => {
      px.set(0);
      py.set(0);
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", rest);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", rest);
    };
  }, [drift, reduce, inView, px, py]);

  const shift = useTransform(scrollY, [0, range], [0, scrollShift]);
  const opacity = useTransform(scrollY, [0, range], [1, 0]);
  const y = useTransform<number, number>([shift, sy], ([a, b]) => a + b);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: reduce ? 0 : sx, y: reduce ? 0 : y, opacity: fade && !reduce ? opacity : 1 }}
    >
      {children}
    </motion.div>
  );
}
