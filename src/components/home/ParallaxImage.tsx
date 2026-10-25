"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

/** An image that drifts a few percent against the scroll while it crosses the viewport. */
export default function ParallaxImage({
  src,
  alt,
  sizes,
  className,
  unoptimized,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  unoptimized?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);

  return (
    <div ref={ref} className={cn("relative overflow-hidden", className)}>
      <motion.div style={{ y: reduce ? 0 : y }} className="absolute inset-x-0 -top-[8%] h-[116%]">
        <Image src={src} alt={alt} fill sizes={sizes} unoptimized={unoptimized} className="object-cover" />
      </motion.div>
    </div>
  );
}
