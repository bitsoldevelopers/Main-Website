import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Grey "clay" objects for the services showcase, one shape per service,
 * drawn with gradients and shadows at a fixed 520px box. They stand in for
 * the rendered 3D illustrations the reference uses.
 */

export const SCULPTURES = ["pinwheel", "stack", "torus", "orbs", "fan", "cone", "knot", "pills"] as const;
export type SculptureKind = (typeof SCULPTURES)[number];

const SIZE = 520;

const clay =
  "absolute bg-[linear-gradient(145deg,#f8f7f4_0%,#e3e1db_52%,#cfcdc6_100%)] shadow-[inset_-16px_-20px_36px_rgba(20,20,20,0.10),inset_12px_14px_28px_rgba(255,255,255,0.9),30px_44px_80px_-28px_rgba(20,20,20,0.34)]";

const sphere =
  "absolute rounded-full bg-[radial-gradient(circle_at_34%_30%,#fbfaf8_0%,#e6e4de_42%,#c6c4bd_100%)] shadow-[30px_44px_80px_-28px_rgba(20,20,20,0.34),inset_-10px_-14px_30px_rgba(20,20,20,0.08)]";

function Pinwheel() {
  return (
    <>
      {Array.from({ length: 6 }, (_, k) => (
        <div
          key={k}
          className={cn(clay, "rounded-[55%_45%_45%_55%/50%]")}
          style={{
            left: "50%",
            top: "50%",
            width: SIZE * 0.46,
            height: SIZE * 0.22,
            marginTop: -SIZE * 0.11,
            transformOrigin: "0% 50%",
            transform: `rotate(${k * 60}deg) translateX(${SIZE * 0.05}px)`,
          }}
        />
      ))}
      <div className={cn(sphere)} style={{ left: "50%", top: "50%", width: SIZE * 0.16, height: SIZE * 0.16, transform: "translate(-50%,-50%)" }} />
    </>
  );
}

function Stack() {
  return (
    <>
      {Array.from({ length: 4 }, (_, k) => (
        <div
          key={k}
          className={cn(clay, "rounded-[26%]")}
          style={{
            left: `${16 + k * 7}%`,
            top: `${30 - k * 7}%`,
            width: SIZE * 0.56,
            height: SIZE * 0.56,
            transform: `rotate(${k * 5}deg)`,
            zIndex: k,
          }}
        />
      ))}
    </>
  );
}

function Torus() {
  return (
    <>
      <div className={cn(clay, "rounded-full")} style={{ left: "13%", top: "13%", width: SIZE * 0.74, height: SIZE * 0.74 }} />
      <div
        className="absolute rounded-full bg-[#f9f8f6] shadow-[inset_14px_18px_30px_rgba(20,20,20,0.16),inset_-8px_-10px_20px_rgba(255,255,255,0.8)]"
        style={{ left: "33%", top: "33%", width: SIZE * 0.34, height: SIZE * 0.34 }}
      />
    </>
  );
}

function Orbs() {
  return (
    <>
      <div className={sphere} style={{ left: "8%", top: "22%", width: SIZE * 0.52, height: SIZE * 0.52 }} />
      <div className={sphere} style={{ left: "46%", top: "14%", width: SIZE * 0.38, height: SIZE * 0.38, zIndex: 2 }} />
      <div className={sphere} style={{ left: "52%", top: "56%", width: SIZE * 0.28, height: SIZE * 0.28, zIndex: 3 }} />
    </>
  );
}

function Fan() {
  return (
    <>
      {Array.from({ length: 5 }, (_, k) => (
        <div
          key={k}
          className={cn(clay, "rounded-full")}
          style={{
            left: "22%",
            top: "62%",
            width: SIZE * 0.6,
            height: SIZE * 0.15,
            transformOrigin: "8% 50%",
            transform: `rotate(${-k * 17}deg)`,
            zIndex: 5 - k,
          }}
        />
      ))}
    </>
  );
}

function Cone() {
  return (
    <>
      {Array.from({ length: 5 }, (_, k) => (
        <div
          key={k}
          className={cn(clay, "rounded-full")}
          style={{
            left: `${12 + k * 9}%`,
            top: `${12 + k * 5}%`,
            width: SIZE * (0.72 - k * 0.12),
            height: SIZE * (0.72 - k * 0.12),
            zIndex: k,
          }}
        />
      ))}
    </>
  );
}

function Knot() {
  const ring = (style: CSSProperties, z: number) => (
    <div
      className="absolute rounded-full border-[52px] border-[#e4e2dc] shadow-[30px_44px_80px_-28px_rgba(20,20,20,0.34),inset_10px_12px_24px_rgba(255,255,255,0.9),inset_-14px_-16px_30px_rgba(20,20,20,0.10)]"
      style={{ ...style, zIndex: z }}
    />
  );
  return (
    <>
      {ring({ left: "10%", top: "14%", width: SIZE * 0.66, height: SIZE * 0.66, transform: "rotate(-20deg) scaleX(0.78)" }, 1)}
      {ring({ left: "30%", top: "26%", width: SIZE * 0.6, height: SIZE * 0.6, transform: "rotate(35deg) scaleX(0.66)" }, 2)}
    </>
  );
}

function Pills() {
  return (
    <>
      {Array.from({ length: 4 }, (_, k) => (
        <div
          key={k}
          className={cn(clay, "rounded-full")}
          style={{
            left: `${12 + k * 4}%`,
            top: `${16 + k * 17}%`,
            width: SIZE * 0.72,
            height: SIZE * 0.14,
            transform: "rotate(-22deg)",
            zIndex: k,
          }}
        />
      ))}
    </>
  );
}

const RENDER: Record<SculptureKind, () => React.JSX.Element> = {
  pinwheel: Pinwheel,
  stack: Stack,
  torus: Torus,
  orbs: Orbs,
  fan: Fan,
  cone: Cone,
  knot: Knot,
  pills: Pills,
};

export default function Sculpture({ kind, className, style }: { kind: SculptureKind; className?: string; style?: CSSProperties }) {
  const Shape = RENDER[kind];
  return (
    <div
      aria-hidden="true"
      className={cn("relative", className)}
      style={{ width: SIZE, height: SIZE, ...style }}
    >
      <Shape />
    </div>
  );
}
