import { cn } from "@/lib/utils";

/**
 * A dark panel with three glass spheres and one lit from inside: the
 * reference's closing visual, drawn with gradients so it ships without a
 * video file. Used by the footer and as the reel's stand-in.
 */

type Sphere = { size: number; x: number; y: number; lit?: boolean; delay: number };

const spheres: Sphere[] = [
  { size: 42, x: 30, y: 18, delay: 0 },
  { size: 36, x: 52, y: 44, lit: true, delay: 1.1 },
  { size: 30, x: 66, y: 14, delay: 2.2 },
  { size: 16, x: 84, y: 70, delay: 0.5 },
];

export default function GlassSpheres({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[radial-gradient(120%_90%_at_60%_40%,#262626_0%,#121212_55%,#0a0a0a_100%)]",
        className
      )}
      aria-hidden="true"
    >
      {/* faint drifting shapes behind the glass */}
      <div className="absolute -left-[10%] top-[10%] h-[60%] w-[50%] rounded-full bg-white/[0.04] blur-3xl" />
      <div className="absolute -right-[10%] bottom-[-20%] h-[70%] w-[50%] rounded-full bg-white/[0.05] blur-3xl" />

      {spheres.map((s, i) => (
        <div
          key={i}
          className="animate-coin absolute rounded-full"
          style={{
            width: `${s.size}%`,
            paddingTop: `${s.size}%`,
            left: `${s.x}%`,
            top: `${s.y}%`,
            animationDelay: `${s.delay}s`,
            background: s.lit
              ? "radial-gradient(circle at 45% 45%, #ffffff 0%, #f4f4f4 28%, rgba(255,255,255,0.75) 48%, rgba(255,255,255,0.15) 70%, rgba(255,255,255,0) 72%)"
              : "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.18) 22%, rgba(255,255,255,0.03) 48%, rgba(0,0,0,0.0) 60%)",
            boxShadow: s.lit
              ? "0 0 80px 20px rgba(255,255,255,0.35), inset 0 0 0 1px rgba(255,255,255,0.4)"
              : "inset 0 0 0 1px rgba(255,255,255,0.28), inset -20px -24px 50px rgba(0,0,0,0.6), inset 14px 10px 30px rgba(255,255,255,0.12), 0 40px 60px -30px rgba(0,0,0,0.8)",
          }}
        />
      ))}

      {label && (
        <span className="absolute bottom-5 left-6 font-mono text-[11px] uppercase tracking-[0.08em] text-white/60">
          {label}
        </span>
      )}
    </div>
  );
}
