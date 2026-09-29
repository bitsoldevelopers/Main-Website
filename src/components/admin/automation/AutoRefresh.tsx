"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Re-renders the server page around it every few seconds while something
 * is still in progress (an import running, say). Rendered only while that is
 * the case, so a finished page stops polling by itself.
 */
export function AutoRefresh({ seconds = 3, label }: { seconds?: number; label: string }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);

  return (
    <p className="flex items-center gap-2 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-cyan-700" /> {label}
    </p>
  );
}
