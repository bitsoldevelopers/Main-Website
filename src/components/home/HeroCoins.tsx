import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * The hero's objects: chains of iridescent glass discs that run in from the
 * left and right edges and recede towards the title. Pure CSS (a conic
 * holographic sweep on 3D-rotated circles, a dark glass core, a specular
 * highlight and a thicker rim behind each), so there is no asset to load and
 * no WebGL to fail.
 *
 * Motion: each disc slides in once from its edge of the frame
 * (`hero-coin-in`, staggered from the outermost disc inwards), then drifts on
 * a slow loop (`animate-coin-drift`) while its holographic sweep turns
 * (`animate-coin-sweep`, a different period and direction per disc). All of
 * it is CSS from globals.css and stops under reduced motion there; the
 * pointer and scroll parallax is `HeroLayer`'s job, around this component.
 */

type Coin = {
  /** Diameter in px. */
  size: number;
  /** Position inside the band, in % of its width / height. */
  x: number;
  y: number;
  /** 3D orientation. */
  rx: number;
  ry: number;
  rz: number;
  /** Starting hue of the holographic sweep. */
  hue: number;
  /** Offset into the drift loop, so the discs do not move in unison. */
  delay: number;
};

/** Where a disc enters from (px) and when (s). */
type Entrance = { x: number; y: number; delay: number };

const LEFT: Coin[] = [
  { size: 430, x: -38, y: 2, rx: 56, ry: -26, rz: -10, hue: 255, delay: 0 },
  { size: 410, x: -8, y: 12, rx: 58, ry: -30, rz: -5, hue: 280, delay: 0.6 },
  { size: 380, x: 22, y: 28, rx: 61, ry: -34, rz: 1, hue: 305, delay: 1.2 },
  { size: 340, x: 48, y: 44, rx: 65, ry: -40, rz: 7, hue: 225, delay: 1.8 },
  { size: 290, x: 70, y: 56, rx: 70, ry: -46, rz: 13, hue: 265, delay: 2.4 },
];

const RIGHT: Coin[] = [
  { size: 290, x: -2, y: 54, rx: 70, ry: 46, rz: -13, hue: 215, delay: 2.1 },
  { size: 340, x: 18, y: 40, rx: 65, ry: 40, rz: -7, hue: 300, delay: 1.5 },
  { size: 380, x: 42, y: 24, rx: 61, ry: 34, rz: -1, hue: 250, delay: 0.9 },
  { size: 410, x: 66, y: 8, rx: 58, ry: 30, rz: 5, hue: 285, delay: 0.3 },
  { size: 430, x: 94, y: -2, rx: 56, ry: 26, rz: 10, hue: 235, delay: 0 },
];

const BAND: Coin[] = [
  { size: 220, x: -16, y: 34, rx: 60, ry: -34, rz: -10, hue: 255, delay: 0 },
  { size: 230, x: 16, y: 12, rx: 62, ry: -24, rz: -4, hue: 290, delay: 0.8 },
  { size: 230, x: 48, y: 26, rx: 62, ry: 24, rz: 4, hue: 310, delay: 1.6 },
  { size: 220, x: 80, y: 48, rx: 60, ry: 34, rz: 10, hue: 225, delay: 2.4 },
];

function Disc({ coin, entrance }: { coin: Coin; entrance: Entrance }) {
  const h = coin.hue;
  const sweep = `conic-gradient(from ${h}deg at 50% 50%, hsl(${h} 70% 58%), hsl(${h + 40} 80% 66%), hsl(${h + 95} 75% 68%), hsl(${h + 140} 85% 72%), hsl(${h + 200} 80% 66%), hsl(${h + 270} 70% 60%), hsl(${h + 330} 72% 60%), hsl(${h} 70% 58%))`;
  const entranceVars = {
    "--in-x": `${entrance.x}px`,
    "--in-y": `${entrance.y}px`,
    "--in-delay": `${entrance.delay}s`,
  } as CSSProperties;
  return (
    // entrance: slides in from the frame's edge, once
    <div
      className="hero-coin-in absolute"
      style={{ width: coin.size, height: coin.size, left: `${coin.x}%`, top: `${coin.y}%`, ...entranceVars }}
    >
      {/* the slow drift loop; perspective for the 3D orientation inside */}
      <div className="animate-coin-drift h-full w-full" style={{ animationDelay: `${coin.delay}s`, perspective: "1200px" }}>
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${coin.rx}deg) rotateY(${coin.ry}deg) rotateZ(${coin.rz}deg)`,
          }}
        >
          {/* rim: the disc's thickness, offset back along its normal */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              transform: "translateZ(-34px)",
              background: `conic-gradient(from ${h + 30}deg, #1b1340, #3a2a78, #16235a, #2d1a4f, #1b1340)`,
              boxShadow: "0 70px 90px -40px rgba(30, 15, 80, 0.5)",
            }}
          />
          {/* holographic sweep, turning in the disc's plane at its own pace */}
          <div
            className="animate-coin-sweep absolute inset-0 rounded-full"
            style={{
              background: sweep,
              filter: "saturate(0.95)",
              animationDuration: `${24 + (coin.hue % 5) * 2}s`,
              animationDirection: coin.ry < 0 ? "normal" : "reverse",
            }}
          />
          {/* dark glass core and edge, just above the sweep */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              transform: "translateZ(0.4px)",
              background:
                "radial-gradient(circle at 50% 52%, rgba(22,10,58,0.62) 0%, rgba(22,10,58,0.34) 34%, rgba(22,10,58,0.06) 58%, rgba(255,255,255,0) 72%)",
              boxShadow:
                "inset 0 0 0 2px rgba(255,255,255,0.55), inset 0 -26px 50px rgba(20,8,60,0.45), inset 0 20px 40px rgba(255,255,255,0.28), 0 0 0 1px rgba(30,15,80,0.25)",
            }}
          />
          {/* specular highlights */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              transform: "translateZ(0.8px)",
              background:
                "radial-gradient(ellipse 38% 22% at 30% 22%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 100%), radial-gradient(ellipse 30% 14% at 72% 80%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.3) 100%)",
              mixBlendMode: "screen",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Outermost disc first, each one after it a beat later. */
const STAGGER = 0.09;

export default function HeroCoins({ variant = "sides", className }: { variant?: "sides" | "band"; className?: string }) {
  if (variant === "band") {
    return (
      <div className={cn("pointer-events-none relative h-full w-full overflow-visible", className)} aria-hidden="true">
        {BAND.map((coin, i) => (
          <Disc key={i} coin={coin} entrance={{ x: 0, y: 56, delay: 0.55 + i * STAGGER }} />
        ))}
      </div>
    );
  }
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} aria-hidden="true">
      <div className="absolute left-0 top-[12%] h-[62%] w-[38%]">
        {LEFT.map((coin, i) => (
          <Disc key={i} coin={coin} entrance={{ x: -160, y: 24, delay: 0.25 + i * STAGGER }} />
        ))}
      </div>
      <div className="absolute right-0 top-[12%] h-[62%] w-[38%]">
        {RIGHT.map((coin, i) => (
          <Disc key={i} coin={coin} entrance={{ x: 160, y: 24, delay: 0.25 + (RIGHT.length - 1 - i) * STAGGER }} />
        ))}
      </div>
    </div>
  );
}
