import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, CheckSquare, Circle, Clock, Mail, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/admin/ui";
import { validityBadge } from "@/lib/automation/labels";

/**
 * Server-safe pieces shared by the automation and lead-profile screens.
 * Same rule as components/admin/ui.tsx: no hooks here.
 */

/** The dark header card that opens a profile or an overview. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  avatar,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  avatar?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b1230] via-[#0f1b45] to-[#1b1147] text-white shadow-lg shadow-slate-900/10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between md:p-7">
        <div className="flex min-w-0 items-start gap-4">
          {avatar}
          <div className="min-w-0">
            {eyebrow && <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">{eyebrow}</p>}
            <h1 className="break-words text-2xl font-bold leading-tight md:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-slate-200">{subtitle}</p>}
            {meta && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 md:max-w-[52%] md:justify-end">{actions}</div>}
      </div>
      {children && <div className="relative border-t border-white/10 px-6 py-4 md:px-7">{children}</div>}
    </section>
  );
}

/** Buttons that sit on the dark hero. */
export const heroBtn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-cyan px-3.5 py-2 text-sm font-bold text-brand-dark transition hover:bg-brand-cyan/90 disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-50",
};

export function HeroStat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white">{value}</p>
      {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function ValidityBadge({ validity, className }: { validity: string | null | undefined; className?: string }) {
  const badge = validityBadge(validity);
  return (
    <Pill tone={badge.tone} className={cn("normal-case tracking-normal", className)}>
      {badge.label}
    </Pill>
  );
}

export function Tag({ children, href }: { children: ReactNode; href?: string }) {
  const className = "inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600";
  return href ? (
    <Link href={href} className={cn(className, "transition hover:bg-slate-200 hover:text-slate-900")}>
      {children}
    </Link>
  ) : (
    <span className={className}>{children}</span>
  );
}

// ─── Workflow ───────────────────────────────────────────────────────────────

export interface WorkflowNode {
  key: string;
  type: "TRIGGER" | "CHECK" | "SEND_EMAIL" | "WAIT" | "CREATE_TASK" | "STOP";
  title: ReactNode;
  detail?: ReactNode;
  href?: string;
  /** Where a run currently stands. */
  state?: "done" | "current" | "upcoming";
}

const NODE_STYLE: Record<WorkflowNode["type"], { icon: LucideIcon; className: string }> = {
  TRIGGER: { icon: Circle, className: "bg-slate-900 text-white" },
  CHECK: { icon: CheckCircle2, className: "bg-slate-100 text-slate-600" },
  SEND_EMAIL: { icon: Mail, className: "bg-cyan-100 text-cyan-700" },
  WAIT: { icon: Clock, className: "bg-amber-100 text-amber-700" },
  CREATE_TASK: { icon: CheckSquare, className: "bg-violet-100 text-violet-700" },
  STOP: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" },
};

/** A workflow as a column of nodes joined by a line. */
export function Workflow({ nodes }: { nodes: WorkflowNode[] }) {
  return (
    <ol className="relative">
      {nodes.map((node, i) => {
        const style = NODE_STYLE[node.type];
        const Icon = style.icon;
        const last = i === nodes.length - 1;
        const body = (
          <>
            <p className={cn("text-sm font-semibold", node.state === "upcoming" ? "text-slate-500" : "text-slate-900")}>
              {node.title}
              {node.state === "current" && (
                <span className="ml-2 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Next</span>
              )}
            </p>
            {node.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{node.detail}</p>}
          </>
        );
        return (
          <li key={node.key} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-slate-200" />}
            <span
              className={cn(
                "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full",
                style.className,
                node.state === "done" && "bg-emerald-100 text-emerald-700",
                node.state === "upcoming" && "opacity-60"
              )}
            >
              {node.state === "done" ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 pt-1">
              {node.href ? (
                <Link href={node.href} className="block rounded-lg transition hover:text-cyan-700">
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Wizard chrome ──────────────────────────────────────────────────────────

export function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-semibold">
      {steps.map((step, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        return (
          <li key={step} className="flex items-center gap-2">
            <span
              aria-current={state === "current" ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5",
                state === "current" && "border-cyan-600 bg-cyan-600 text-white",
                state === "done" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                state === "upcoming" && "border-slate-200 bg-white text-slate-400"
              )}
            >
              <span className="tabular-nums">{state === "done" ? "✓" : i + 1}</span>
              {step}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-slate-300" />}
          </li>
        );
      })}
    </ol>
  );
}

/** One figure in a row of results. Not a chart: the number is the point. */
export function Figure({
  label,
  value,
  hint,
  tone = "slate",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "slate" | "green" | "cyan" | "amber" | "red" | "purple";
  href?: string;
}) {
  const bar = {
    slate: "bg-slate-300",
    green: "bg-emerald-500",
    cyan: "bg-cyan-600",
    amber: "bg-amber-500",
    red: "bg-red-500",
    purple: "bg-violet-600",
  }[tone];
  const body = (
    <div className="relative h-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", bar)} />
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}
