"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Loader2, RotateCcw, Send, Trash2 } from "lucide-react";
import { deleteBroadcast, sendBroadcast, unscheduleBroadcast } from "@/app/admin/actions-broadcasts";
import { cn } from "@/lib/utils";
import { btn } from "@/components/admin/ui";

/**
 * Start, retry, unschedule or delete one broadcast.
 *
 * The confirmation is not politeness. This is the only control in the panel
 * that messages hundreds of real phones, it cannot be undone once it starts,
 * and every message costs money, so the count is spelled out and the button
 * has to be pressed twice.
 */
export function BroadcastActions({
  id,
  status,
  pending,
  title,
  canSend,
}: {
  id: string;
  status: string;
  /** Recipients still to be messaged: what Send and Retry act on. */
  pending: number;
  title: string;
  /** False until a phone number ID and access token are set. */
  canSend: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sending = status === "SENDING";
  const finished = status === "SENT" && pending === 0;
  // A failed run with recipients still waiting is a resume, not a fresh send:
  // everyone already messaged is skipped by the recipient table.
  const isRetry = status === "FAILED" || (status === "SENT" && pending > 0);

  // While a run is in progress the page is the progress report, so keep it current.
  useEffect(() => {
    if (!sending) return;
    const timer = setInterval(() => router.refresh(), 5_000);
    return () => clearInterval(timer);
  }, [sending, router]);

  function act(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await action();
      if (!result.ok) setError(result.error ?? "That did not work.");
      setConfirming(false);
    });
  }

  if (sending) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap text-[0.875rem] text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Sending…
      </span>
    );
  }

  if (finished) {
    return <span className="whitespace-nowrap text-[0.875rem] text-slate-500">Sent</span>;
  }

  if (confirming) {
    return (
      <div className="min-w-[14rem] rounded-md bg-amber-100 p-3">
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-amber-800">
          Send &ldquo;{title}&rdquo; to <span className="font-semibold">{pending.toLocaleString()}</span> WhatsApp number{pending === 1 ? "" : "s"}? This cannot be
          stopped once it starts, and Meta charges for every conversation it opens.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={busy} className={btn.ghost}>
            Not yet
          </button>
          <button type="button" onClick={() => act(() => sendBroadcast(id, { refresh: status === "SCHEDULED" }))} disabled={busy} className={btn.primary}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send now
          </button>
        </div>
        {error && <p className="mt-2 text-[0.8125rem] text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={busy || !canSend || pending === 0}
        className={cn(isRetry ? btn.secondary : btn.primary, "px-3 py-1.5 text-[0.875rem]")}
        title={!canSend ? "WhatsApp is not connected on this server" : pending === 0 ? "Everyone on this broadcast has already been messaged" : undefined}
      >
        {isRetry ? <RotateCcw className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        {isRetry ? `Retry ${pending.toLocaleString()}` : "Send"}
      </button>

      {status === "SCHEDULED" && (
        <button type="button" onClick={() => act(() => unscheduleBroadcast(id))} disabled={busy} className={btn.icon} aria-label={`Unschedule ${title}`} title="Unschedule">
          <CalendarOff className="h-4 w-4" />
        </button>
      )}

      {(status === "DRAFT" || status === "SCHEDULED") && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete the unsent broadcast "${title}"?`)) act(() => deleteBroadcast(id));
          }}
          disabled={busy}
          className={cn(btn.icon, "hover:text-red-700")}
          aria-label={`Delete ${title}`}
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {busy && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
      {error && <span className="text-[0.8125rem] text-red-700">{error}</span>}
    </div>
  );
}
