"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, prefsAttributes, type AdminPrefs } from "@/lib/admin/prefs";

/**
 * Tiny localStorage-backed stores for the admin shell. useSyncExternalStore
 * renders the defaults on the server and during hydration, then the saved
 * value, so there is never a hydration mismatch; the visual state was
 * already applied before paint by PREFS_SCRIPT.
 */

function makeStore<T>(key: string, parse: (raw: string | null) => T, fallback: T) {
  let cache: { value: T } | null = null;
  const listeners = new Set<() => void>();

  function read(): T {
    if (cache) return cache.value;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      // Storage blocked (private mode, policy): run on defaults.
    }
    cache = { value: parse(raw) };
    return cache.value;
  }

  function write(value: T) {
    cache = { value };
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Not persisted; still applied for this page view.
    }
    listeners.forEach((fn) => fn());
  }

  function subscribe(fn: () => void) {
    listeners.add(fn);
    // Another tab changed it.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      cache = { value: parse(e.newValue) };
      listeners.forEach((l) => l());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener("storage", onStorage);
    };
  }

  return { read, write, subscribe, serverValue: () => fallback };
}

// ─── Look and feel ──────────────────────────────────────────────────────────

const prefsStore = makeStore<AdminPrefs>(PREFS_KEY, parsePrefs, DEFAULT_PREFS);

function systemDark(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
}

function applyPrefs(prefs: AdminPrefs) {
  const root = document.querySelector<HTMLElement>("[data-admin-root]");
  if (!root) return;
  for (const [name, value] of Object.entries(prefsAttributes(prefs, systemDark()))) {
    root.setAttribute(`data-${name}`, value);
  }
}

export function usePrefs() {
  const prefs = useSyncExternalStore(prefsStore.subscribe, prefsStore.read, prefsStore.serverValue);

  const update = useCallback((patch: Partial<AdminPrefs>) => {
    const next = { ...prefsStore.read(), ...patch };
    prefsStore.write(next);
    applyPrefs(next);
  }, []);

  // Keep the root in sync when another tab changes the prefs, and follow the
  // operating system while the theme is "system".
  useEffect(() => {
    applyPrefs(prefs);
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyPrefs(prefsStore.read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs]);

  return [prefs, update] as const;
}

// ─── Notifications read marker ──────────────────────────────────────────────

const seenStore = makeStore<string>(
  "bitsol-admin-notifications-seen",
  (raw) => {
    try {
      const value = raw ? JSON.parse(raw) : "";
      return typeof value === "string" ? value : "";
    } catch {
      return "";
    }
  },
  // Server render: treat everything as read, so no badge flashes before the
  // saved marker is known.
  "9999"
);

/** ISO time of the last "mark all as read" ("" when never). */
export function useNotificationsSeen() {
  const seenAt = useSyncExternalStore(seenStore.subscribe, seenStore.read, seenStore.serverValue);
  const markAllRead = useCallback(() => seenStore.write(new Date().toISOString()), []);
  return [seenAt, markAllRead] as const;
}
