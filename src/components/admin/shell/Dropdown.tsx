"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Round icon button used across the navbar. */
export const navIconBtn =
  "relative grid h-10 w-10 shrink-0 place-items-center rounded-full text-adm-heading transition-colors hover:bg-adm-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-adm-primary";

/**
 * A navbar dropdown: a trigger button and a floating panel. Closes on a
 * click outside, on Escape (focus returns to the trigger) and when the route
 * changes. `children` may be a function that receives `close`.
 */
export function Dropdown({
  label,
  trigger,
  children,
  panelClassName,
  triggerClassName = navIconBtn,
  wide = false,
}: {
  label: string;
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  panelClassName?: string;
  triggerClassName?: string;
  /** On phones, span the whole navbar instead of hanging off the trigger. */
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div ref={rootRef} className={wide ? "sm:relative" : "relative"}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute end-0 top-full z-50 mt-3 overflow-hidden rounded-md bg-adm-paper text-adm-text animate-in fade-in-0 zoom-in-95 slide-in-from-top-1",
            wide && "max-sm:start-0 max-sm:w-auto",
            panelClassName
          )}
          style={{ boxShadow: "var(--adm-shadow-lg)" }}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
