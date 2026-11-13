"use client";

import Link from "next/link";
import {
  Bell,
  Briefcase,
  CalendarClock,
  Check,
  ExternalLink,
  Hand,
  LayoutGrid,
  LogOut,
  Mail,
  MailOpen,
  Monitor,
  Moon,
  Palette,
  Sun,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { initials, timeAgo } from "@/lib/admin/format";
import type { AdminShortcut } from "@/lib/admin/nav";
import type { AdminRole } from "@/lib/admin/rbac";
import type { ThemeMode } from "@/lib/admin/prefs";
import type { ShellNotification } from "@/lib/admin/queries-dashboard";
import { logout } from "@/app/admin/actions";
import { Dropdown } from "./Dropdown";
import { useNotificationsSeen, usePrefs } from "./usePrefs";

const itemClass =
  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-start text-[0.9375rem] text-adm-heading transition-colors hover:bg-adm-hover";

// ─── Theme ──────────────────────────────────────────────────────────────────

const THEMES: { value: ThemeMode; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeMenu() {
  const [prefs, setPrefs] = usePrefs();
  const current = THEMES.find((t) => t.value === prefs.theme) ?? THEMES[0];
  return (
    <Dropdown label="Theme" trigger={<current.icon className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />} panelClassName="w-44 p-2">
      {(close) =>
        THEMES.map((theme) => {
          const active = theme.value === prefs.theme;
          return (
            <button
              key={theme.value}
              type="button"
              onClick={() => {
                setPrefs({ theme: theme.value });
                close();
              }}
              className={cn(itemClass, active && "bg-cyan-50 text-cyan-700 hover:bg-cyan-50")}
              aria-pressed={active}
            >
              <theme.icon className="h-5 w-5" strokeWidth={1.75} />
              <span className="flex-1">{theme.label}</span>
              {active && <Check className="h-4 w-4" />}
            </button>
          );
        })
      }
    </Dropdown>
  );
}

// ─── Shortcuts ──────────────────────────────────────────────────────────────

export function ShortcutsMenu({ shortcuts }: { shortcuts: AdminShortcut[] }) {
  if (shortcuts.length === 0) return null;
  // An even number of tiles keeps the two-column grid square.
  const tiles = shortcuts.slice(0, shortcuts.length - (shortcuts.length % 2) || 1);
  return (
    <Dropdown
      label="Shortcuts"
      trigger={<LayoutGrid className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />}
      panelClassName="w-[min(24rem,calc(100vw-2rem))]"
      wide
    >
      <div className="flex items-center justify-between border-b border-adm-border px-5 py-3.5">
        <p className="text-[1.0625rem] font-medium text-adm-heading">Shortcuts</p>
      </div>
      <div className="grid max-h-[60vh] grid-cols-2 overflow-y-auto">
        {tiles.map((s, i) => (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "flex flex-col items-center gap-1.5 px-3 py-5 text-center transition-colors hover:bg-adm-hover",
              i % 2 === 0 && "border-e border-adm-border",
              i < tiles.length - 2 && "border-b border-adm-border"
            )}
          >
            <span className="mb-1 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-adm-heading">
              <s.icon className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
            </span>
            <span className="text-[0.9375rem] font-medium text-adm-heading">{s.label}</span>
            <span className="text-[0.8125rem] text-adm-text">{s.hint}</span>
          </Link>
        ))}
      </div>
    </Dropdown>
  );
}

// ─── Notifications ──────────────────────────────────────────────────────────

const NOTIFICATION_STYLE: Record<ShellNotification["kind"], { icon: LucideIcon; className: string }> = {
  lead: { icon: Mail, className: "bg-cyan-100 text-cyan-700" },
  application: { icon: Briefcase, className: "bg-violet-100 text-violet-700" },
  handoff: { icon: Hand, className: "bg-amber-100 text-amber-700" },
  ticket: { icon: Ticket, className: "bg-red-100 text-red-700" },
  meeting: { icon: CalendarClock, className: "bg-emerald-100 text-emerald-700" },
};

export function NotificationsMenu({ items, canReadLeads }: { items: ShellNotification[]; canReadLeads: boolean }) {
  const [seenAt, markAllRead] = useNotificationsSeen();
  const unread = items.filter((n) => n.at > seenAt).length;
  const footer = canReadLeads
    ? { href: "/admin/leads?status=NEW", label: "View all new leads" }
    : { href: "/admin/chatbot/conversations", label: "View conversations" };

  return (
    <Dropdown
      label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      trigger={
        <>
          <Bell className="h-[1.375rem] w-[1.375rem]" strokeWidth={1.75} />
          {unread > 0 && (
            <span className="absolute end-1 top-1 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full bg-adm-danger px-1 text-[0.6875rem] font-medium leading-none text-white ring-2 ring-adm-paper">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </>
      }
      panelClassName="w-[min(23rem,calc(100vw-2rem))]"
      wide
    >
      <div className="flex items-center gap-2 border-b border-adm-border px-5 py-3.5">
        <p className="flex-1 text-[1.0625rem] font-medium text-adm-heading">Notifications</p>
        {unread > 0 && <span className="rounded bg-cyan-100 px-2 py-0.5 text-[0.8125rem] font-medium text-cyan-700">{unread} new</span>}
        <button
          type="button"
          onClick={markAllRead}
          disabled={unread === 0}
          className="grid h-8 w-8 place-items-center rounded-full text-adm-heading transition-colors hover:bg-adm-hover disabled:opacity-40"
          aria-label="Mark all as read"
          title="Mark all as read"
        >
          <MailOpen className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
        </button>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="h-5 w-5" />
          </span>
          <p className="font-medium text-adm-heading">You are all caught up</p>
          <p className="mt-1 text-[0.8125rem]">New inquiries and chat handovers show up here.</p>
        </div>
      ) : (
        <ul className="adm-scroll max-h-[min(24rem,60vh)] overflow-y-auto">
          {items.map((n) => {
            const style = NOTIFICATION_STYLE[n.kind];
            const isNew = n.at > seenAt;
            return (
              <li key={n.id} className="border-b border-adm-border last:border-b-0">
                <Link href={n.href} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-adm-hover">
                  <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", style.className)}>
                    <style.icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-medium text-adm-heading">{n.title}</span>
                    <span className="block truncate text-[0.8125rem]">{n.detail}</span>
                    <span className="mt-0.5 block text-xs text-adm-muted">{timeAgo(n.at)}</span>
                  </span>
                  {isNew && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-adm-primary" aria-label="Unread" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-adm-border p-3">
        <Link
          href={footer.href}
          className="adm-shadow-primary flex w-full items-center justify-center rounded-md bg-adm-primary px-4 py-2 text-[0.9375rem] font-medium text-white transition hover:brightness-95"
        >
          {footer.label}
        </Link>
      </div>
    </Dropdown>
  );
}

// ─── User ───────────────────────────────────────────────────────────────────

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("relative grid h-[2.375rem] w-[2.375rem] shrink-0 place-items-center rounded-full bg-cyan-100 text-sm font-medium text-cyan-700", className)}>
      {initials(name)}
      <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full bg-adm-success ring-2 ring-adm-paper" aria-hidden />
    </span>
  );
}

const ROLE_LABEL: Record<AdminRole, string> = { ADMIN: "Administrator", EDITOR: "Editor", MANAGER: "Manager" };

export function UserMenu({
  name,
  role,
  links,
  onCustomize,
}: {
  name: string;
  role: AdminRole;
  links: { label: string; href: string; icon: LucideIcon }[];
  onCustomize: () => void;
}) {
  return (
    <Dropdown
      label="Account"
      trigger={<UserAvatar name={name} />}
      triggerClassName="ms-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-primary"
      panelClassName="w-60 p-2"
    >
      {(close) => (
        <>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <UserAvatar name={name} />
            <div className="min-w-0">
              <p className="truncate text-[0.9375rem] font-medium text-adm-heading">{name}</p>
              <p className="text-[0.8125rem] text-adm-muted">{ROLE_LABEL[role]}</p>
            </div>
          </div>
          <div className="my-1.5 h-px bg-adm-border" />
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={itemClass}>
              <link.icon className="h-5 w-5" strokeWidth={1.75} />
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              close();
              onCustomize();
            }}
          >
            <Palette className="h-5 w-5" strokeWidth={1.75} />
            Customize theme
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer" className={itemClass}>
            <ExternalLink className="h-5 w-5" strokeWidth={1.75} />
            View website
          </a>
          <div className="my-1.5 h-px bg-adm-border" />
          <form action={logout} className="px-1 pb-1 pt-1">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-adm-danger px-3 py-2 text-[0.9375rem] font-medium text-white transition hover:brightness-95"
            >
              Log out <LogOut className="h-4 w-4" />
            </button>
          </form>
        </>
      )}
    </Dropdown>
  );
}
