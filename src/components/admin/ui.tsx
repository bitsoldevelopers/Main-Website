import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Database, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PillTone } from "@/lib/admin/leads";

/**
 * Server-safe building blocks for the admin. No hooks here, so every piece
 * can be rendered from a Server Component; the interactive bits live in
 * their own "use client" files.
 */

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-cyan-400 focus:bg-white disabled:opacity-50";

export const selectClass = cn(inputClass, "bg-white pr-9");

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-xl bg-brand-cyan px-4 py-2.5 text-sm font-bold text-brand-dark transition hover:bg-brand-cyan/90 disabled:pointer-events-none disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50",
  icon: "inline-grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-200 hover:text-slate-900",
};

export const thClass = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500";
export const tdClass = "px-4 py-3.5 align-top text-sm";
export const trClass = "border-t border-slate-100 transition-colors hover:bg-slate-50";

// ─── Layout ─────────────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-700">{eyebrow}</p>}
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("rounded-2xl border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

// ─── Data display ───────────────────────────────────────────────────────────

const statTones: Record<PillTone, string> = {
  cyan: "bg-cyan-50 text-cyan-700",
  purple: "bg-violet-100 text-violet-700",
  green: "bg-emerald-100 text-emerald-600",
  amber: "bg-amber-100 text-amber-600",
  red: "bg-red-100 text-red-600",
  slate: "bg-slate-100 text-slate-500",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "cyan",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: PillTone;
  href?: string;
}) {
  const body = (
    <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
        {Icon && (
          <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", statTones[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
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

const pillTones: Record<PillTone, string> = {
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  purple: "border-violet-200 bg-violet-100 text-violet-700",
  green: "border-emerald-200 bg-emerald-100 text-emerald-700",
  amber: "border-amber-300 bg-amber-100 text-amber-700",
  red: "border-red-200 bg-red-100 text-red-600",
  slate: "border-slate-300 bg-slate-100 text-slate-500",
};

export function Pill({ tone = "slate", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        pillTones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function KeyValue({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-slate-100", className)}>
      {items.map((item, i) => (
        <div key={i} className="grid gap-1 py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-bold uppercase tracking-widest text-slate-500">{item.label}</dt>
          <dd className="min-w-0 break-words text-sm text-slate-900">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Callout({
  tone = "cyan",
  icon: Icon = Info,
  title,
  children,
  className,
}: {
  tone?: "cyan" | "amber" | "red" | "green";
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const tones = {
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
    amber: "border-amber-300 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-400/5 text-red-600",
    green: "border-emerald-200 bg-emerald-400/5 text-emerald-700",
  };
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-4 text-sm", tones[tone], className)}>
      <Icon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
      <div className="min-w-0 text-slate-800">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn("text-slate-500", title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <p className="font-bold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function DbUnavailable({ error, className }: { error?: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm", className)}>
      <div className="flex items-start gap-3">
        <Database className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="font-bold text-amber-700">Database unreachable</p>
          <p className="mt-1 text-slate-500">
            This module reads live data from the site&apos;s MySQL database, which could not be reached from this
            server. The public site keeps serving its cached pages meanwhile.
          </p>
          {error && (
            <p className="mt-3 break-words rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-amber-800">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Forms ──────────────────────────────────────────────────────────────────

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-bold uppercase tracking-widest text-slate-500">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
      {message}
    </p>
  );
}

// ─── Navigation ─────────────────────────────────────────────────────────────

export function Pagination({
  page,
  totalPages,
  total,
  noun,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  total: number;
  noun: string;
  hrefFor: (page: number) => string;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-slate-100 px-5 py-4 text-sm">
      <p className="text-slate-500">
        {total.toLocaleString()} {noun}
        {totalPages > 1 && (
          <>
            {" "}
            · page {page} of {totalPages}
          </>
        )}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefFor(page - 1)} rel="prev" className={btn.secondary}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Link>
          ) : (
            <span className={cn(btn.secondary, "opacity-40")}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </span>
          )}
          {page < totalPages ? (
            <Link href={hrefFor(page + 1)} rel="next" className={btn.secondary}>
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className={cn(btn.secondary, "opacity-40")}>
              Next <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}

/** Horizontal tab strip driven by links, so it works without JavaScript. */
export function LinkTabs({
  tabs,
  current,
}: {
  tabs: { label: string; value: string; href: string; count?: number }[];
  current: string;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition",
              active ? "bg-cyan-100 text-cyan-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", active ? "bg-cyan-200" : "bg-slate-200")}>
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
