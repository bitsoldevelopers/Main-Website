"use client";

import { useRef, useState } from "react";
import GlassSpheres from "@/components/home/GlassSpheres";

/**
 * The reel panel and its mirrored reflection. With a video source it plays
 * muted on loop and a click pauses it; without one it shows the glass
 * spheres so the section still reads as a showreel slot.
 */
export default function ReelMedia({ src, poster }: { src: string | null; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);

  const toggle = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  const panel = (reflection: boolean) =>
    src ? (
      <video
        ref={reflection ? undefined : videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden={reflection ? "true" : undefined}
        className="h-full w-full object-cover"
      />
    ) : (
      <GlassSpheres label={reflection ? undefined : "Showreel"} />
    );

  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      <button
        type="button"
        onClick={src ? toggle : undefined}
        aria-label={src ? (paused ? "Play the reel" : "Pause the reel") : undefined}
        tabIndex={src ? 0 : -1}
        className={`relative block aspect-[16/8.6] w-full overflow-hidden rounded-[24px] bg-[#111] shadow-[0_40px_80px_-40px_rgba(20,20,20,0.5)] ${
          src ? "cursor-pointer" : "cursor-default"
        }`}
      >
        {panel(false)}
        {src && paused && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 font-mono text-[11px] uppercase tracking-[0.1em] text-white">
            Paused
          </span>
        )}
      </button>

      {/* reflection */}
      <div
        aria-hidden="true"
        className="pointer-events-none mt-3 aspect-[16/8.6] w-full overflow-hidden rounded-[24px] opacity-60 blur-[6px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.55),transparent_60%)]"
        style={{ transform: "scaleY(-1)" }}
      >
        {panel(true)}
      </div>
    </div>
  );
}
