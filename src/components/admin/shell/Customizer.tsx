"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Check, Monitor, Moon, PanelLeft, PanelLeftClose, RotateCcw, Settings2, Sun, X, Maximize2, Minimize2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PREFS, PRIMARY_OPTIONS, type AdminPrefs } from "@/lib/admin/prefs";
import { usePrefs } from "./usePrefs";

/**
 * The theme customizer: a drawer from the right edge with the look-and-feel
 * options. Changes apply instantly and are remembered in this browser.
 */
export function Customizer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [prefs, setPrefs] = usePrefs();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const isDefault = (Object.keys(DEFAULT_PREFS) as (keyof AdminPrefs)[]).every((k) => prefs[k] === DEFAULT_PREFS[k]);

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Open the theme customizer"
        title="Theme customizer"
        className={cn(
          "adm-shadow-primary fixed end-0 top-1/2 z-40 grid h-9 w-10 -translate-y-1/2 place-items-center rounded-s-md bg-adm-primary text-white transition hover:w-11",
          open && "hidden"
        )}
      >
        <Settings2 className="h-[1.125rem] w-[1.125rem] motion-safe:animate-[spin_6s_linear_infinite]" />
      </button>

      {open && (
        <button
          type="button"
          aria-label="Close the theme customizer"
          onClick={() => onOpenChange(false)}
          className="fixed inset-0 z-[60] bg-[var(--adm-backdrop)] animate-in fade-in-0"
        />
      )}

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Theme customizer"
        tabIndex={-1}
        className={cn(
          "adm-scroll fixed inset-y-0 end-0 z-[61] flex w-[min(23rem,100vw)] flex-col overflow-y-auto bg-adm-paper text-adm-text outline-none transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full rtl:-translate-x-full"
        )}
        style={{ boxShadow: open ? "var(--adm-shadow-lg)" : "none" }}
        inert={!open}
      >
        <div className="flex items-start gap-2 border-b border-adm-border px-6 py-5">
          <div className="min-w-0 flex-1">
            <p className="text-[1.0625rem] font-medium text-adm-heading">Theme customizer</p>
            <p className="text-[0.8125rem]">Customize and preview in real time</p>
          </div>
          <button
            type="button"
            onClick={() => setPrefs(DEFAULT_PREFS)}
            disabled={isDefault}
            className="relative grid h-8 w-8 place-items-center rounded-full text-adm-heading transition-colors hover:bg-adm-hover disabled:opacity-40"
            aria-label="Reset to defaults"
            title="Reset to defaults"
          >
            <RotateCcw className="h-[1.125rem] w-[1.125rem]" />
            {!isDefault && <span className="absolute end-1 top-1 h-2 w-2 rounded-full bg-adm-danger" />}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 place-items-center rounded-full text-adm-heading transition-colors hover:bg-adm-hover"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-7 px-6 py-6">
          <Section title="Theming">
            <Label>Primary color</Label>
            <div className="flex flex-wrap gap-3">
              {PRIMARY_OPTIONS.map((option) => {
                const active = prefs.primary === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPrefs({ primary: option.key })}
                    aria-pressed={active}
                    aria-label={option.label}
                    title={option.label}
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-md border transition",
                      active ? "border-adm-primary" : "border-adm-border hover:border-slate-300"
                    )}
                    style={active ? { boxShadow: "var(--adm-shadow-xs)" } : undefined}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-md text-white" style={{ backgroundColor: option.hex }}>
                      {active && <Check className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>

            <Label>Theme</Label>
            <OptionGrid
              value={prefs.theme}
              onChange={(theme) => setPrefs({ theme })}
              options={[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ]}
            />

            <label className="mt-1 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-adm-border px-4 py-3">
              <span>
                <span className="block text-[0.9375rem] text-adm-heading">Semi-dark menu</span>
                <span className="block text-[0.8125rem]">Dark sidebar on a light page</span>
              </span>
              <Switch checked={prefs.semiDark} onChange={(semiDark) => setPrefs({ semiDark })} />
            </label>
          </Section>

          <Section title="Layout">
            <Label>Menu</Label>
            <OptionGrid
              value={prefs.menu}
              onChange={(menu) => setPrefs({ menu })}
              options={[
                { value: "expanded", label: "Expanded", icon: PanelLeft },
                { value: "collapsed", label: "Collapsed", icon: PanelLeftClose },
              ]}
            />
            <Label>Content</Label>
            <OptionGrid
              value={prefs.content}
              onChange={(content) => setPrefs({ content })}
              options={[
                { value: "compact", label: "Compact", icon: Minimize2 },
                { value: "wide", label: "Wide", icon: Maximize2 },
              ]}
            />
          </Section>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="mb-4 inline-block rounded bg-cyan-100 px-2 py-0.5 text-[0.8125rem] font-medium text-cyan-700">{title}</p>
      {children}
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="pt-1 text-[0.8125rem] font-medium text-adm-heading">{children}</p>;
}

function OptionGrid<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon: LucideIcon }[];
}) {
  return (
    <div className={cn("grid gap-3", options.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center gap-2 rounded-md border px-2 py-3 text-[0.8125rem] transition",
              active ? "border-adm-primary bg-cyan-50 text-cyan-700" : "border-adm-border text-adm-heading hover:border-slate-300"
            )}
          >
            <option.icon className="h-6 w-6" strokeWidth={1.5} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-adm-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-adm-primary"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute start-0.5 top-0.5 h-5 w-5 rounded-full bg-[#ffffff] shadow transition-transform peer-checked:translate-x-5"
      />
    </span>
  );
}
