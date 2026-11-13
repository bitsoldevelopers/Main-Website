"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Circle, CircleDot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { isNavActive, type AdminNavGroup, type AdminNavItem } from "@/lib/admin/nav";
import { usePrefs } from "./usePrefs";

export type BadgeCounts = Record<NonNullable<AdminNavItem["badge"]>, number>;

const BADGE_TONE: Record<NonNullable<AdminNavItem["badge"]>, string> = {
  newLeads: "bg-adm-danger text-white",
  handoffs: "bg-adm-warning text-white",
  drafts: "bg-slate-200 text-slate-700",
};

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-cyan to-brand-purple text-base font-extrabold text-white adm-shadow-primary",
        className
      )}
    >
      B
    </span>
  );
}

function CountBadge({ kind, count, className }: { kind: NonNullable<AdminNavItem["badge"]>; count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-xs font-medium tabular-nums",
        BADGE_TONE[kind],
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * The vertical menu. On desktop it can be pinned open or collapsed to icons
 * (it then expands over the page on hover; the CSS lives in
 * admin-theme.css). Below lg it is an off-canvas drawer.
 */
export function Sidebar({
  nav,
  badges,
  open,
  onClose,
}: {
  nav: AdminNavGroup[];
  badges: BadgeCounts;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const [prefs, setPrefs] = usePrefs();
  const collapsed = prefs.menu === "collapsed";

  // Only the most specific match lights up, so /admin/leads/board highlights
  // "Pipeline Board" without also highlighting "Leads & Applications".
  const activeHref = nav
    .flatMap((group) => group.items)
    .filter((item) => isNavActive(item.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const activeMenu = nav.find((g) => g.menu && g.items.some((i) => i.href === activeHref))?.heading;
  const [expanded, setExpanded] = useState<string[]>(activeMenu ? [activeMenu] : []);
  // Opening a page inside a collapsible group unfolds that group.
  const [lastActiveMenu, setLastActiveMenu] = useState(activeMenu);
  if (activeMenu !== lastActiveMenu) {
    setLastActiveMenu(activeMenu);
    if (activeMenu && !expanded.includes(activeMenu)) setExpanded([...expanded, activeMenu]);
  }

  function toggle(heading: string) {
    setExpanded((list) => (list.includes(heading) ? list.filter((h) => h !== heading) : [...list, heading]));
  }

  return (
    <aside
      aria-label="Admin menu"
      className={cn(
        "adm-menu fixed inset-y-0 start-0 z-50 flex w-[var(--adm-menu-w)] flex-col bg-adm-paper text-adm-heading transition-transform duration-300 lg:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full"
      )}
      style={{ boxShadow: "var(--adm-shadow-xs)" }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 ps-[1.6rem] pe-4">
        <Link href="/admin" className="flex min-w-0 items-center gap-2.5" aria-label="BITSOL admin home">
          <BrandMark />
          <span className="adm-when-open truncate text-[1.375rem] font-semibold tracking-tight text-adm-heading">bitsol</span>
        </Link>
        <button
          type="button"
          onClick={() => setPrefs({ menu: collapsed ? "expanded" : "collapsed" })}
          aria-label={collapsed ? "Keep the menu open" : "Collapse the menu to icons"}
          title={collapsed ? "Keep the menu open" : "Collapse the menu to icons"}
          className="adm-when-open hidden h-8 w-8 shrink-0 place-items-center rounded-full text-adm-heading transition-colors hover:bg-adm-hover lg:grid"
        >
          {collapsed ? <Circle className="h-[1.15rem] w-[1.15rem]" /> : <CircleDot className="h-[1.15rem] w-[1.15rem]" />}
        </button>
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-adm-heading hover:bg-adm-hover lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="adm-scroll flex-1 overflow-y-auto overflow-x-hidden pb-6 pt-1">
        {nav.map((group) => {
          const header = group.section === undefined ? group.heading : group.section;
          return (
            <div key={group.heading}>
              {header && (
                <div className="mx-3.5 mb-1.5 mt-5 flex h-5 items-center px-3.5">
                  <span className="adm-when-open truncate text-[0.8125rem] uppercase tracking-[0.025em] text-adm-muted">{header}</span>
                  <span className="adm-when-closed h-px w-5 bg-adm-muted/60" aria-hidden />
                </div>
              )}
              <ul>
                {group.menu ? (
                  <MenuParent
                    group={group}
                    activeHref={activeHref}
                    badges={badges}
                    isOpen={expanded.includes(group.heading)}
                    onToggle={() => toggle(group.heading)}
                  />
                ) : (
                  group.items.map((item) => (
                    <li key={item.href} className="mx-3.5 mb-0.5">
                      <MenuLink item={item} active={item.href === activeHref} badges={badges} />
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

function MenuLink({ item, active, badges }: { item: AdminNavItem; active: boolean; badges: BadgeCounts }) {
  return (
    <Link
      href={item.href}
      title={item.description}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md px-3.5 py-2 text-[0.9375rem] leading-[1.375rem] transition-colors",
        active ? "adm-active" : "text-adm-heading hover:bg-adm-hover"
      )}
    >
      <item.icon className="h-[1.375rem] w-[1.375rem] shrink-0" strokeWidth={1.75} />
      <span className="adm-when-open min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge && <CountBadge kind={item.badge} count={badges[item.badge]} className="adm-when-open" />}
    </Link>
  );
}

function MenuParent({
  group,
  activeHref,
  badges,
  isOpen,
  onToggle,
}: {
  group: AdminNavGroup;
  activeHref: string | undefined;
  badges: BadgeCounts;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const menu = group.menu!;
  const hasActive = group.items.some((i) => i.href === activeHref);
  const badged = group.items.find((i) => i.badge && badges[i.badge] > 0);
  const listId = `adm-menu-${group.heading.toLowerCase().replace(/\W+/g, "-")}`;

  return (
    <li className="mx-3.5 mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={listId}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3.5 py-2 text-start text-[0.9375rem] leading-[1.375rem] text-adm-heading transition-colors hover:bg-adm-hover",
          (isOpen || hasActive) && "bg-adm-hover",
          hasActive && "adm-parent-active"
        )}
      >
        <menu.icon className="h-[1.375rem] w-[1.375rem] shrink-0" strokeWidth={1.75} />
        <span className="adm-when-open min-w-0 flex-1 truncate">{menu.label}</span>
        {!isOpen && badged?.badge && <CountBadge kind={badged.badge} count={badges[badged.badge]} className="adm-when-open" />}
        <ChevronRight className={cn("adm-when-open h-4 w-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
      </button>
      {isOpen && (
        <ul id={listId} className="adm-when-open mt-0.5 space-y-0.5">
          {group.items.map((item) => {
            const active = item.href === activeHref;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.description}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3.5 py-2 text-[0.9375rem] leading-[1.375rem] transition-colors",
                    active ? "adm-active" : "text-adm-heading hover:bg-adm-hover"
                  )}
                >
                  <span className="grid h-[1.375rem] w-[1.375rem] shrink-0 place-items-center" aria-hidden>
                    <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-white" : "border border-current opacity-70")} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.badge && <CountBadge kind={item.badge} count={badges[item.badge]} />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
