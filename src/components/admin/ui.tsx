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
  "w-full rounded-md border border-slate-300 bg-transparent px-3.5 py-2 text-[0.9375rem] text-slate-900 placeholder:text-slate-400 outline-none transition-[border-color,box-shadow] focus:border-cyan-600 focus:shadow-[0_0.125rem_0.375rem_0_rgb(47_43_61/0.14)] disabled:opacity-50";

export const selectClass = cn(inputClass, "bg-white pr-9");

// Vuexy-style buttons: solid primary with a soft coloured shadow, "label"
// (tinted) secondary and danger, and a text-only ghost.
export const btn = {
  primary:
    "adm-shadow-primary inline-flex items-center justify-center gap-2 rounded-md bg-adm-primary px-5 py-2 text-[0.9375rem] font-medium text-white transition hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-md bg-slate-200/70 px-5 py-2 text-[0.9375rem] font-medium text-slate-700 transition hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[0.9375rem] font-medium text-cyan-700 transition hover:bg-cyan-50 disabled:pointer-events-none disabled:opacity-60",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-md bg-red-100 px-5 py-2 text-[0.9375rem] font-medium text-red-700 transition hover:bg-red-200 disabled:pointer-events-none disabled:opacity-60",
  icon: "inline-grid h-8 w-8 place-items-center rounded-full text-slate-500 transition hover:bg-adm-hover hover:text-slate-900",
};

export const thClass =
  "border-b border-slate-200 px-5 py-3 text-start text-[0.8125rem] font-medium uppercase tracking-[0.03em] text-slate-900";
export const tdClass = "px-5 py-3 align-middle text-[0.9375rem]";
export const trClass = "border-t border-slate-200 transition-colors first:border-t-0 hover:bg-slate-50";

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
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[0.8125rem] text-slate-400">{eyebrow}</p>}
        <h1 className="text-[1.375rem] leading-snug text-slate-900 md:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[0.9375rem] leading-relaxed text-slate-500">{description}</p>}
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
    <section id={id} className={cn("adm-card", className)}>
      {(title || actions) && (
        <header className="flex flex-col gap-2 px-6 pb-4 pt-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="text-[1.125rem] leading-snug text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[0.8125rem] text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(title || actions ? "px-6 pb-6" : "p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

// ─── Data display ───────────────────────────────────────────────────────────

/** Tinted "label" colours: avatars, icon tiles and badges. */
export const toneLabel: Record<PillTone, string> = {
  cyan: "bg-cyan-100 text-cyan-700",
  purple: "bg-violet-100 text-violet-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  slate: "bg-slate-200/70 text-slate-600",
};

// Statistic cards carry a tinted bottom edge that turns solid on hover.
const statEdges: Record<PillTone, string> = {
  cyan: "border-b-cyan-300 hover:border-b-cyan-600",
  purple: "border-b-violet-300 hover:border-b-violet-500",
  green: "border-b-emerald-300 hover:border-b-emerald-500",
  amber: "border-b-amber-300 hover:border-b-amber-500",
  red: "border-b-red-300 hover:border-b-red-500",
  slate: "border-b-slate-300 hover:border-b-slate-500",
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
    <div
      className={cn(
        "adm-card h-full border-b-2 px-5 pb-4 pt-5 transition-[border-color,box-shadow] duration-200 hover:shadow-[0_0.25rem_1.125rem_0_rgb(47_43_61/0.16)]",
        statEdges[tone]
      )}
    >
      <div className="mb-2 flex items-center gap-4">
        {Icon && (
          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-md", toneLabel[tone])}>
            <Icon className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
          </span>
        )}
        <p className="text-2xl font-medium text-slate-900">{value}</p>
      </div>
      <p className="text-[0.9375rem] text-slate-900">{label}</p>
      {hint && <p className="mt-1 text-[0.8125rem] text-slate-500">{hint}</p>}
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

/** A Vuexy "label" badge: tinted background, coloured text. */
export function Pill({ tone = "slate", children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[0.8125rem] font-medium leading-5",
        toneLabel[tone],
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
          <dt className="text-[0.9375rem] font-medium text-slate-900">{item.label}</dt>
          <dd className="min-w-0 break-words text-[0.9375rem] text-slate-600">{item.value}</dd>
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
  // Vuexy alert: tinted panel, solid icon tile, title in the tone's colour.
  const tones = {
    cyan: { box: "bg-cyan-100 text-cyan-700", icon: "bg-cyan-600" },
    amber: { box: "bg-amber-100 text-amber-700", icon: "bg-amber-500" },
    red: { box: "bg-red-100 text-red-700", icon: "bg-red-500" },
    green: { box: "bg-emerald-100 text-emerald-700", icon: "bg-emerald-500" },
  };
  return (
    <div className={cn("flex items-start gap-3 rounded-md p-4 text-[0.9375rem]", tones[tone].box, className)}>
      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md text-white", tones[tone].icon)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 pt-0.5">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn("text-slate-600", title && "mt-1")}>{children}</div>}
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
        <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-cyan-100 text-cyan-700">
          <Icon className="h-6 w-6" strokeWidth={1.75} />
        </span>
      )}
      <p className="text-[1.0625rem] font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[0.9375rem] text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function DbUnavailable({ error, className }: { error?: string; className?: string }) {
  return (
    <div className={cn("rounded-md bg-amber-100 p-5 text-[0.9375rem]", className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-amber-500 text-white">
          <Database className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-amber-700">Database unreachable</p>
          <p className="mt-1 text-slate-600">
            This module reads live data from the site&apos;s MySQL database, which could not be reached from this
            server. The public site keeps serving its cached pages meanwhile.
          </p>
          {error && (
            <p className="mt-3 break-words rounded bg-adm-paper/70 px-3 py-2 font-mono text-xs text-amber-800">{error}</p>
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
      <label htmlFor={htmlFor} className="block text-[0.8125rem] font-medium text-slate-900">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[0.8125rem] text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-[0.8125rem] text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-red-100 px-4 py-3 text-[0.9375rem] text-red-700">
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
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4 border-t border-slate-200 px-5 py-4 text-[0.9375rem]">
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
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <Link
            key={tab.value}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[0.9375rem] font-medium transition",
              active ? "adm-shadow-primary bg-adm-primary text-white" : "text-slate-900 hover:bg-cyan-50 hover:text-cyan-700"
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-white/20" : "bg-slate-200")}>
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
