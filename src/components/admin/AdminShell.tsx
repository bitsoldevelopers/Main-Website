"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ExternalLink, LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { breadcrumbsFor, isNavActive, navForRole } from "@/lib/admin/nav";
import type { AdminRole } from "@/lib/admin/rbac";
import type { ShellStatus } from "@/lib/admin/queries";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { logout } from "@/app/admin/actions";

export interface ShellIdentity {
  name: string;
  role: AdminRole;
}

/**
 * Sidebar + top bar around every admin page. Client component only for the
 * mobile drawer state, the ⌘K palette and the active-link highlight; the
 * pages it wraps stay Server Components.
 */
export function AdminShell({ status, identity, children }: { status: ShellStatus; identity: ShellIdentity; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const adminNav = navForRole(identity.role);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close the mobile drawer after a navigation. State is adjusted during
  // render (the React-recommended pattern) rather than in an effect.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  const crumbs = breadcrumbsFor(pathname);
  const badges: Record<"newLeads" | "drafts", number> = { newLeads: status.newLeads, drafts: status.drafts };

  // Only the most specific matching item is highlighted, so /admin/leads/board
  // lights up "Pipeline Board" without also lighting up "Leads & Applications".
  const activeHref = adminNav
    .flatMap((group) => group.items)
    .filter((item) => isNavActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="flex min-h-screen">
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-cyan to-brand-purple font-black text-brand-dark">
              B
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold">
                BITSOL<span className="text-cyan-700">.</span>
              </span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Admin</span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {adminNav.map((group) => (
            <div key={group.heading} className="mb-6">
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{group.heading}</p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const count = item.badge ? badges[item.badge] : 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.description}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                          active
                            ? "bg-cyan-50 text-cyan-700 shadow-[inset_2px_0_0_0_#0891B2]"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}
                      >
                        <item.icon
                          className={cn("h-4.5 w-4.5 shrink-0", active ? "text-cyan-700" : "text-slate-500 group-hover:text-slate-900")}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                              item.badge === "newLeads" ? "bg-brand-cyan text-brand-dark" : "bg-slate-200 text-slate-900"
                            )}
                          >
                            {count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", status.dbOk ? "bg-emerald-400" : "animate-pulse bg-amber-400")} />
              <span className="truncate">{status.dbOk ? "Database connected" : "Database unreachable"}</span>
            </span>
            <span className="shrink-0 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" title={`Signed in as ${identity.name}`}>
              {identity.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              View site <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <form action={logout}>
              <button
                type="submit"
                title="Sign out"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-300 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <ol className="flex min-w-0 items-center gap-1 text-sm">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500/60" />}
                  {crumb.href && !last ? (
                    <Link href={crumb.href} className="truncate text-slate-500 transition hover:text-slate-900">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className={cn("truncate", last ? "font-semibold text-slate-900" : "text-slate-500")}>{crumb.label}</span>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-900"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden rounded border border-slate-300 px-1 text-[10px] font-bold md:inline">⌘K</kbd>
            </button>
            {status.newLeads > 0 && (
              <Link
                href="/admin/leads?status=NEW"
                className="hidden items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 transition hover:bg-cyan-200 sm:inline-flex"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                {status.newLeads} new {status.newLeads === 1 ? "lead" : "leads"}
              </Link>
            )}
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:inline-flex"
            >
              bitsolmarketing.com <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>

      <CommandPalette nav={adminNav} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
