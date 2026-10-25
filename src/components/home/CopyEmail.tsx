"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** The studio email as a copy-to-clipboard button, with a mailto fallback. */
export default function CopyEmail({ email, className }: { email: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const [user, domain] = email.split("@");

  const copy = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!navigator.clipboard) return; // let the mailto: link do its job
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <a
      href={`mailto:${email}`}
      onClick={copy}
      title="Copy to clipboard"
      className={cn(
        "group relative inline-flex items-center font-mono text-[11px] uppercase tracking-[0.08em] transition-colors",
        className
      )}
    >
      <span className={cn("transition-opacity", copied && "opacity-0")}>
        <span className="text-muted-foreground">{user}</span>
        <span className="text-muted-foreground">@</span>
        <span className="text-foreground">{domain}</span>
      </span>
      <span
        aria-live="polite"
        className={cn(
          "absolute inset-0 flex items-center justify-end text-foreground transition-opacity",
          copied ? "opacity-100" : "opacity-0"
        )}
      >
        {copied ? "Copied!" : ""}
      </span>
    </a>
  );
}
