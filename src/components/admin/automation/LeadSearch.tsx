"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass } from "@/components/admin/ui";

/**
 * Search box for the lead list. It writes `q` into the URL 300 ms after the
 * typing stops, so the list filters as you type without a request per key,
 * and the result is a link that can be shared or reloaded.
 */
export function LeadSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("q") ?? "";
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  // What this box last wrote to the URL, to tell its own updates from a
  // back/forward or a "Clear" link changing the URL under it.
  const [written, setWritten] = useState(current);

  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    if (current !== written) {
      setWritten(current);
      setValue(current);
    }
  }

  useEffect(() => {
    const q = value.trim();
    if (q === current) return;
    const timer = setTimeout(() => {
      setWritten(q);
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, current, params, pathname, router]);

  return (
    <div className="relative w-full sm:w-80">
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-cyan-700" />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      )}
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search leads"
        className={cn(inputClass, "bg-white pl-9 pr-9")}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
