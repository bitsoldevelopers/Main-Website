"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { btn } from "@/components/admin/ui";

export default function AdminError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const retry = unstable_retry ?? reset;

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-red-500/5 p-8 text-center">
      <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-sm text-slate-500">
        The action could not be completed. If this keeps happening, check the database connection on the Settings page.
      </p>
      {error.message && (
        <p className="mt-4 break-words rounded-lg bg-slate-100 px-3 py-2 text-left font-mono text-xs text-red-200/80">
          {error.message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {retry && (
          <button type="button" onClick={() => retry()} className={btn.primary}>
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        )}
        <Link href="/admin" className={btn.secondary}>
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
