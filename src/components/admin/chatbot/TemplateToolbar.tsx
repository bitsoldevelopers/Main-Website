"use client";

import { useActionState, useState, useTransition } from "react";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { submitWhatsAppTemplate, syncWhatsAppTemplates, type TemplateFormState } from "@/app/admin/actions-broadcasts";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

/**
 * Sync templates from Meta, and submit new ones for approval. The two belong
 * together because they are two halves of the same fact: Meta owns the
 * template list. Sync reads it; submit adds to it and waits. Nothing here can
 * make a template usable, only Meta's review does that, which is why the
 * button says "Submit for approval" rather than "Create".
 */

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "en_US", label: "English (US)" },
  { code: "en_GB", label: "English (UK)" },
  { code: "ur", label: "Urdu" },
  { code: "pa", label: "Punjabi" },
  { code: "ar", label: "Arabic" },
] as const;

const CATEGORIES = [
  { value: "UTILITY", label: "Utility", hint: "Reminders, confirmations, account notices: anything the customer asked for." },
  { value: "MARKETING", label: "Marketing", hint: "Offers, announcements, invitations. Priced higher and reviewed more strictly." },
  { value: "AUTHENTICATION", label: "Authentication", hint: "One-time passcodes only." },
] as const;

/** Count `{{n}}` placeholders the same way the server and Meta do. */
function countPlaceholders(text: string): number {
  const found = text.match(/\{\{\s*(\d+)\s*\}\}/g);
  if (!found) return 0;
  return Math.max(...found.map((token) => Number(token.replace(/\D/g, "")) || 0));
}

/** `Consultation reminder` → `consultation_reminder`, the only shape Meta accepts. */
function suggestMetaName(display: string): string {
  return display
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function TemplateToolbar({ canSync }: { canSync: boolean }) {
  const [syncing, startSync] = useTransition();
  const [syncResult, setSyncResult] = useState<{ ok: boolean; text: string } | null>(null);

  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [name, setName] = useState("");
  const [metaName, setMetaName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"]>("UTILITY");
  const [body, setBody] = useState("");
  const placeholders = countPlaceholders(body);

  const [state, formAction] = useActionState<TemplateFormState, FormData>(async (prev, formData) => {
    const result = await submitWhatsAppTemplate(prev, formData);
    if (result?.ok) {
      setOpen(false);
      setName("");
      setMetaName("");
      setBody("");
      setFormKey((key) => key + 1);
    }
    return result;
  }, null);

  function sync() {
    setSyncResult(null);
    startSync(async () => {
      const result = await syncWhatsAppTemplates();
      setSyncResult({ ok: result.ok, text: result.ok ? (result.message ?? "Synced.") : (result.error ?? "Sync failed.") });
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={sync}
          disabled={!canSync || syncing}
          className={btn.secondary}
          title={canSync ? "Read the template list from the WhatsApp Business Account" : "Enter the WhatsApp Business Account ID and token on the Setup page first"}
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Sync from Meta
        </button>
        <button type="button" onClick={() => setOpen((value) => !value)} disabled={!canSync} className={btn.primary}>
          <Plus className="h-4 w-4" /> New template
        </button>
      </div>

      {syncResult && (
        <p className={cn("rounded-md px-4 py-3 text-[0.9375rem]", syncResult.ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>{syncResult.text}</p>
      )}
      {state?.ok && state.message && <p className="rounded-md bg-emerald-100 px-4 py-3 text-[0.9375rem] text-emerald-700">{state.message}</p>}

      {open && (
        <form key={formKey} action={formAction} className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-5">
          <FormError message={state && !state.ok ? state.error : undefined} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name in the panel" htmlFor="tpl-name" error={state?.fieldErrors?.name}>
              <input
                id="tpl-name"
                name="name"
                value={name}
                onChange={(e) => {
                  const next = e.target.value;
                  // Only auto-fill the Meta name while the person has not typed their own.
                  if (metaName === suggestMetaName(name)) setMetaName(suggestMetaName(next));
                  setName(next);
                }}
                placeholder="Consultation reminder"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Template name in Meta" htmlFor="tpl-meta" hint="Lowercase letters, numbers and underscores only." error={state?.fieldErrors?.metaName}>
              <input
                id="tpl-meta"
                name="metaName"
                value={metaName}
                onChange={(e) => setMetaName(e.target.value)}
                pattern="[a-z0-9_]+"
                placeholder="consultation_reminder"
                required
                className={inputClass}
              />
            </Field>
            <Field label="Language" htmlFor="tpl-lang">
              <select id="tpl-lang" name="languageCode" defaultValue="en" className={selectClass}>
                {LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label} ({language.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category" htmlFor="tpl-cat" hint={CATEGORIES.find((c) => c.value === category)?.hint} error={state?.fieldErrors?.category}>
              <select id="tpl-cat" name="category" value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={selectClass}>
                {CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Header" htmlFor="tpl-header" hint="Optional, one line, up to 60 characters.">
            <input id="tpl-header" name="headerText" maxLength={60} placeholder="BITSOL Marketing" className={inputClass} />
          </Field>

          <Field label="Message body" htmlFor="tpl-body" hint="Use {{1}}, {{2}} for values filled in per recipient. Up to 1024 characters." error={state?.fieldErrors?.body}>
            <textarea
              id="tpl-body"
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1024}
              rows={5}
              placeholder="Hi {{1}}, your consultation with our team is confirmed for {{2}} at {{3}}."
              required
              className={inputClass}
            />
          </Field>

          {placeholders > 0 && (
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <p className="mb-3 text-[0.8125rem] text-slate-500">
                Meta needs one example value per placeholder to review the template. Examples are never sent to anyone. The label is what the broadcast composer
                shows for each slot.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: placeholders }, (_, index) => (
                  <div key={index} className="grid gap-2 rounded-md bg-slate-50 p-3">
                    <p className="font-mono text-xs text-slate-500">{`{{${index + 1}}}`}</p>
                    <input name="variables" placeholder={index === 0 ? "Label, e.g. name" : "Label"} maxLength={60} className={inputClass} />
                    <input name="examples" placeholder={index === 0 ? "Example, e.g. Ali" : "Example"} maxLength={200} className={inputClass} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <Field label="Footer" htmlFor="tpl-footer" hint="Optional, up to 60 characters.">
            <input id="tpl-footer" name="footerText" maxLength={60} placeholder="Reply STOP to unsubscribe" className={inputClass} />
          </Field>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={() => setOpen(false)} className={btn.ghost}>
              Cancel
            </button>
            <SubmitButton pendingText="Submitting…">Submit for approval</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
