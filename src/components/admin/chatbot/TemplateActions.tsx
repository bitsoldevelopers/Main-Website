"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteWhatsAppTemplate } from "@/app/admin/actions-broadcasts";
import { btn } from "@/components/admin/ui";

/** Per-template controls: deleting it, with a confirmation that says what goes with it. */
export function TemplateActions({ id, metaName, inMeta }: { id: string; metaName: string; inMeta: boolean }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove() {
    setError(null);
    start(async () => {
      const result = await deleteWhatsAppTemplate(id);
      if (!result.ok) {
        setError(result.error ?? "Could not delete that template.");
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="rounded-md bg-red-100 p-3">
        <p className="mb-3 text-[0.8125rem] leading-relaxed text-red-700">
          {inMeta ? (
            <>
              Delete <span className="font-mono">{metaName}</span> from Meta? Every language variant of this name goes with it, and any broadcast still using it will stop
              sending.
            </>
          ) : (
            <>
              Delete <span className="font-mono">{metaName}</span>? It was never submitted, so this only removes it from here.
            </>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={btn.ghost}>
            Keep it
          </button>
          <button type="button" onClick={remove} disabled={pending} className={btn.danger}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[0.8125rem] text-slate-500">{error ?? (inMeta ? "Managed in Meta" : "Only in this panel")}</span>
      <button type="button" onClick={() => setConfirming(true)} disabled={pending} className={btn.ghost} aria-label={`Delete ${metaName}`}>
        <Trash2 className="h-4 w-4" /> Delete
      </button>
    </div>
  );
}
