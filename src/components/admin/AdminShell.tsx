"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, History, Menu, Search, Settings, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { breadcrumbsFor, navForRole, shortcutsForRole } from "@/lib/admin/nav";
import { hasPermission, type AdminRole } from "@/lib/admin/rbac";
import type { ShellStatus } from "@/lib/admin/queries";
import type { ShellNotification } from "@/lib/admin/queries-dashboard";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { Sidebar } from "@/components/admin/shell/Sidebar";
import { navIconBtn } from "@/components/admin/shell/Dropdown";
import { NotificationsMenu, ShortcutsMenu, ThemeMenu, UserMenu } from "@/components/admin/shell/NavbarMenus";
import { Customizer } from "@/components/admin/shell/Customizer";

export interface ShellIdentity {
  name: string;
  role: AdminRole;
}

/**
 * The frame around every admin page: vertical menu, floating navbar
 * (search, theme, shortcuts, notifications, account), content column and
 * footer, plus the ⌘K palette and the theme customizer. A client component
 * for the menu, dropdown and drawer state only; the pages it wraps stay
 * Server Components.
 */
export function AdminShell({
  status,
  identity,
  notifications,
  children,
}: {
  status: ShellStatus;
  identity: ShellIdentity;
  notifications: ShellNotification[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const nav = navForRole(identity.role);

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
    setMenuOpen(false);
  }

  const crumbs = breadcrumbsFor(pathname);
  const userLinks = (
    [
      hasPermission(identity.role, "activity.read") && { label: "Activity log", href: "/admin/activity", icon: History },
      hasPermission(identity.role, "users.manage") && { label: "Users", href: "/admin/users", icon: Users },
      hasPermission(identity.role, "settings.view") && { label: "Settings", href: "/admin/settings", icon: Settings },
    ] as const
  ).filter((link): link is { label: string; href: string; icon: LucideIcon } => Boolean(link));

  return (
    <div className="min-h-screen">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-[var(--adm-backdrop)] animate-in fade-in-0 lg:hidden"
        />
      )}

      <Sidebar
        nav={nav}
        badges={{ newLeads: status.newLeads, drafts: status.drafts, handoffs: status.handoffs }}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className="adm-layout flex min-h-screen min-w-0 flex-col">
        <header className="adm-navbar-band sticky top-0 z-30 px-4 pt-4 sm:px-6">
          <div className="adm-container">
            <div
              className="relative flex h-14 items-center gap-1 rounded-md bg-adm-paper/90 px-2 backdrop-blur-md sm:px-4"
              style={{ boxShadow: "var(--adm-shadow-xs)" }}
            >
              <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className={cn(navIconBtn, "lg:hidden")}>
                <Menu className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
              </button>

              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search the admin"
                className="flex min-w-0 items-center gap-2.5 rounded-md px-2 py-2 text-adm-muted transition-colors hover:text-adm-text"
              >
                <Search className="h-[1.375rem] w-[1.375rem] shrink-0 text-adm-heading" strokeWidth={1.75} />
                <span className="hidden text-[0.9375rem] sm:inline">Search</span>
                <kbd className="hidden rounded border border-adm-border px-1.5 py-0.5 font-sans text-[0.6875rem] font-medium md:inline">Ctrl K</kbd>
              </button>

              <div className="ms-auto flex items-center gap-0.5 sm:gap-1">
                <ThemeMenu />
                <ShortcutsMenu shortcuts={shortcutsForRole(identity.role)} />
                <NotificationsMenu items={notifications} canReadLeads={hasPermission(identity.role, "leads.read")} />
                <UserMenu name={identity.name} role={identity.role} links={userLinks} onCustomize={() => setCustomizerOpen(true)} />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 pb-8 pt-6 sm:px-6">
          <div className="adm-container">
            {crumbs.length > 1 && (
              <nav aria-label="Breadcrumb" className="mb-4">
                <ol className="flex min-w-0 flex-wrap items-center gap-1 text-[0.8125rem]">
                  {crumbs.map((crumb, i) => {
                    const last = i === crumbs.length - 1;
                    return (
                      <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
                        {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-adm-muted" />}
                        {crumb.href && !last ? (
                          <Link href={crumb.href} className="truncate text-adm-muted transition-colors hover:text-adm-primary">
                            {crumb.label}
                          </Link>
                        ) : (
                          <span className={cn("truncate", last ? "text-adm-heading" : "text-adm-muted")} aria-current={last ? "page" : undefined}>
                            {crumb.label}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </nav>
            )}
            {children}
          </div>
        </main>

        <footer className="px-4 pb-5 sm:px-6">
          <div className="adm-container flex flex-col gap-2 text-[0.8125rem] text-adm-text sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {new Date().getFullYear()} <span className="font-medium text-adm-heading">BITSOL Marketing</span> · Admin console
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", status.dbOk ? "bg-adm-success" : "animate-pulse bg-adm-warning")} />
                {status.dbOk ? "Database connected" : "Database unreachable"}
              </span>
              <a href="/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-adm-primary">
                Website
              </a>
              <a href="/blog" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-adm-primary">
                Blog
              </a>
            </div>
          </div>
        </footer>
      </div>

      <CommandPalette nav={nav} open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Customizer open={customizerOpen} onOpenChange={setCustomizerOpen} />
    </div>
  );
}
