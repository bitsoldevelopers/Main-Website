import React from "react";
import { cn } from "@/lib/utils";

interface GlowingCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Flat editorial card: white on paper with a hairline border and a soft
 * shadow on hover. The name is historical (it used to animate a conic glow)
 * and stays because sections across the site import it.
 */
export function GlowingCard({ children, className }: GlowingCardProps) {
  return (
    <div
      className={cn(
        "group relative h-full rounded-[1.25rem] border border-border bg-card shadow-[0_1px_2px_rgba(20,20,20,0.04)] transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(20,20,20,0.08)]",
        className
      )}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[1.25rem]">{children}</div>
    </div>
  );
}
