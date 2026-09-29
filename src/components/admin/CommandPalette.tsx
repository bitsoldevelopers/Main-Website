"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminNavGroup } from "@/lib/admin/nav";

interface Hit {
  group: string;
  label: string;
  hint?: string;
  href: string;
}

/**
 * Ctrl/Cmd+K palette. Navigation entries match instantly on the client;
 * records (leads, posts, campaigns, users) come from /api/admin/search,
 * debounced. Plain fetch + listbox semantics, no extra dependency.
 */
export function CommandPalette({ nav, open, onClose }: { nav: AdminNavGroup[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);

  const navHits: Hit[] = nav.flatMap((group) =>
    group.items.map((item) => ({ group: "Go to", label: item.label, hint: item.description, href: item.href }))
  );

  const q = query.trim().toLowerCase();
  const localMatches = q
    ? navHits.filter((h) => h.label.toLowerCase().includes(q) || h.hint?.toLowerCase().includes(q))
    : navHits;
  const hits = [...localMatches, ...remote];

  // Reset on open and on query change during render (the React-recommended
  // pattern), keeping effects for the DOM focus and the debounced fetch only.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setRemote([]);
      setActive(0);
      setLoading(false);
    }
  }
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setActive(0);
    if (q.length < 2) {
      setRemote([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || q.length < 2) return;
    const id = ++requestId.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { hits?: Hit[] };
        if (requestId.current === id) setRemote(body.hits ?? []);
      } catch {
        if (requestId.current === id) setRemote([]);
      } finally {
        if (requestId.current === id) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-label="Admin search"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl shadow-slate-900/20"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-cyan-700" /> : <Search className="h-4 w-4 text-slate-500" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && hits[active]) {
                e.preventDefault();
                go(hits[active].href);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search leads, posts, campaigns, pages…"
            className="w-full bg-transparent py-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <kbd className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {hits.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {q.length >= 2 && !loading ? "Nothing matches that." : "Type to search the admin."}
            </p>
          )}
          {hits.map((hit, i) => {
            const firstOfGroup = i === 0 || hits[i - 1].group !== hit.group;
            return (
              <div key={`${hit.href}-${i}`}>
                {firstOfGroup && (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{hit.group}</p>
                )}
                <button
                  type="button"
                  onClick={() => go(hit.href)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                    i === active ? "bg-cyan-50 text-cyan-700" : "text-slate-600"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{hit.label}</span>
                    {hit.hint && <span className="block truncate text-xs text-slate-500">{hit.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
