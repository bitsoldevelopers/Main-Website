import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Small shared pieces of the editorial homepage: the dotted mono label pill
 * that sits above headings, the tag chip, and the heading row with an
 * optional action on the right. Plain components, so server and client
 * sections can both use them.
 */

export function Eyebrow({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-[7px] font-mono text-[11px] font-medium uppercase tracking-[0.08em]",
        tone === "dark"
          ? "border border-white/10 bg-white/[0.06] text-white"
          : "border border-black/[0.06] bg-white text-foreground shadow-[0_1px_2px_rgba(20,20,20,0.04)]",
        className
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--brand-accent)]" />
      {children}
    </span>
  );
}

export function Tag({
  children,
  tone = "light",
  className,
}: {
  children: ReactNode;
  tone?: "light" | "muted" | "dark";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-[7px] text-[13px] font-medium leading-none",
        tone === "light" && "border border-black/[0.06] bg-white text-foreground shadow-[0_1px_2px_rgba(20,20,20,0.04)]",
        tone === "muted" && "bg-black/[0.05] text-foreground",
        tone === "dark" && "border border-white/10 bg-white/[0.06] text-white",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-8",
        align === "left" && action ? "md:flex-row md:items-end md:justify-between" : "",
        className
      )}
    >
      <div className={cn("max-w-[600px]", align === "center" && "mx-auto text-center")}>
        {eyebrow && <Eyebrow className="mb-7">{eyebrow}</Eyebrow>}
        <h2 className="text-[38px] leading-[1.04] sm:text-5xl md:text-[56px]">{title}</h2>
        {description && (
          <p
            className={cn(
              "mt-5 max-w-xl text-[17px] leading-relaxed text-muted-foreground",
              align === "center" && "mx-auto"
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0 md:pb-2">{action}</div>}
    </div>
  );
}
