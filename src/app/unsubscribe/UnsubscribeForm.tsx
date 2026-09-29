"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export function UnsubscribeForm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");

  async function unsubscribe() {
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setState("done");
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "That did not work. Please try again.");
    } catch {
      setError("We could not reach the server. Please try again.");
    }
    setState("idle");
  }

  if (state === "done") {
    return (
      <div role="status">
        <CheckCircle2 className="mb-4 h-10 w-10 text-emerald-600" />
        <h1 className="text-xl font-semibold">You are unsubscribed</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-900">{email}</span> will not receive any more emails from BITSOL
          Marketing. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold">Unsubscribe from our emails?</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        We will stop emailing <span className="font-semibold text-slate-900">{email}</span>. This takes effect immediately.
      </p>
      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={unsubscribe}
        disabled={state === "sending"}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
        Unsubscribe
      </button>
    </>
  );
}
