"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Megaphone, Upload, Users } from "lucide-react";
import { countBroadcastAudience, createBroadcast, inspectBroadcastNumbers } from "@/app/admin/actions-broadcasts";
import type { NumberListReport } from "@/lib/whatsapp/broadcast";
import type { ComposerTemplate } from "@/lib/whatsapp/broadcast-queries";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";

/**
 * =============================================================================
 *  Broadcast composer
 * =============================================================================
 *
 *  Four decisions, in the order they matter: which approved template, what
 *  fills its placeholders, who receives it, and, separately on the
 *  broadcast's own row, whether to send.
 *
 *  Creating never sends. The audience count is fetched live as the filter
 *  changes, from the server rather than estimated here, because opt-outs and
 *  blocks are applied in the same query that builds the recipient list.
 * =============================================================================
 */

type ParameterKind = "contactName" | "static" | "contactPhone";

interface ParameterDraft {
  kind: ParameterKind;
  value: string;
  fallback: string;
}

const PARAMETER_LABELS: Record<ParameterKind, string> = {
  contactName: "Contact's WhatsApp name",
  static: "The same text for everyone",
  contactPhone: "Contact's phone number",
};

const MEDIA_HEADERS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

function countPlaceholders(text: string): number {
  const found = text.match(/\{\{\s*(\d+)\s*\}\}/g);
  if (!found) return 0;
  return Math.max(...found.map((token) => Number(token.replace(/\D/g, "")) || 0));
}

/** Mirrors the server's preview so the composer and the saved row agree. */
function render(body: string, values: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => {
    const value = values[Number(index) - 1];
    return value?.trim() ? value : match;
  });
}

function emptyParameters(count: number, current: ParameterDraft[] = []): ParameterDraft[] {
  return Array.from({ length: count }, (_, index) => current[index] ?? { kind: "contactName" as ParameterKind, value: "", fallback: "there" });
}

export function BroadcastComposer({
  templates,
  canSend,
  cronConfigured,
}: {
  /** Approved templates only: nothing else can be broadcast. */
  templates: ComposerTemplate[];
  /** False until a phone number ID and access token are set. */
  canSend: boolean;
  /** Whether the follow-up cron secret is set, which scheduled sends depend on. */
  cronConfigured: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [parameters, setParameters] = useState<ParameterDraft[]>([]);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [audienceKind, setAudienceKind] = useState<"segment" | "list">("segment");
  const [numbers, setNumbers] = useState("");
  const [report, setReport] = useState<NumberListReport | null>(null);
  const [activeWithinDays, setActiveWithinDays] = useState("");
  const [limit, setLimit] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [reach, setReach] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const template = templates.find((t) => t.id === templateId) ?? null;
  const placeholders = template ? countPlaceholders(template.body) : 0;
  const needsMedia = Boolean(template?.headerFormat && MEDIA_HEADERS.has(template.headerFormat.toUpperCase()));

  // Live audience count for a segment. Debounced because the day and limit
  // fields fire on every keystroke, and each change is a database count.
  useEffect(() => {
    if (!open || audienceKind !== "segment") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const result = await countBroadcastAudience({
          activeWithinDays: activeWithinDays ? Number(activeWithinDays) : null,
          limit: limit ? Number(limit) : null,
        });
        if (!cancelled) setReach(result.ok ? (result.count ?? 0) : null);
      } catch {
        if (!cancelled) setReach(null);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, audienceKind, activeWithinDays, limit]);

  // The same parse the create action will run, so what the report says is
  // what will happen. Debounced harder: this one is fired by pasting
  // thousands of lines.
  useEffect(() => {
    if (!open || audienceKind !== "list") return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!numbers.trim()) {
        setReport(null);
        setReach(null);
        return;
      }
      setBusy(true);
      try {
        const result = await inspectBroadcastNumbers(numbers);
        if (cancelled) return;
        setReport(result.ok ? (result.report ?? null) : null);
        setReach(result.ok && result.report ? result.report.sendable : null);
      } catch {
        if (!cancelled) {
          setReport(null);
          setReach(null);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, audienceKind, numbers]);

  const previewValues = parameters.map((parameter) =>
    parameter.kind === "static" ? parameter.value.trim() || "…" : parameter.kind === "contactPhone" ? "+923001234567" : "Ali"
  );

  function updateParameter(index: number, patch: Partial<ParameterDraft>) {
    setParameters((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!template) return;
    setError(null);
    setNotice(null);
    startSave(async () => {
      const result = await createBroadcast({
        title: title.trim(),
        templateId: template.id,
        headerMediaUrl: needsMedia ? headerMediaUrl.trim() : undefined,
        parameters: parameters.map((parameter) =>
          parameter.kind === "static"
            ? { kind: "static" as const, value: parameter.value.trim() }
            : parameter.kind === "contactPhone"
              ? { kind: "contactPhone" as const }
              : { kind: "contactName" as const, fallback: parameter.fallback.trim() || undefined }
        ),
        numbers: audienceKind === "list" ? numbers : undefined,
        audience: {
          kind: audienceKind,
          activeWithinDays: activeWithinDays ? Number(activeWithinDays) : null,
          limit: limit ? Number(limit) : null,
        },
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        result.scheduled
          ? `${result.reference} is scheduled for ${result.recipients} contacts. The follow-up cron sends it at the chosen time; Send now on its row sends it sooner.`
          : `Draft ${result.reference} created for ${result.recipients} contacts. Nothing has been sent: press Send on its row when you are ready.`
      );
      setTitle("");
      setTemplateId("");
      setParameters([]);
      setNumbers("");
      setReport(null);
      setScheduledAt("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setOpen(true)} className={btn.primary}>
          <Megaphone className="h-4 w-4" /> New broadcast
        </button>
        {notice && <p className="rounded-md bg-emerald-100 px-4 py-3 text-[0.9375rem] text-emerald-700">{notice}</p>}
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-5">
        <p className="text-[0.9375rem] text-slate-600">
          No approved templates yet. A broadcast reaches people outside the 24-hour reply window, so Meta only allows it through a template it has approved. Sync or
          submit one on the Templates page first.
        </p>
        <button type="button" onClick={() => setOpen(false)} className={cn(btn.ghost, "mt-3")}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-md border border-slate-200 bg-slate-50 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Broadcast name" htmlFor="bc-title" hint="Internal only. Recipients never see it.">
          <input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="November offer: WhatsApp automation" required className={inputClass} />
        </Field>
        <Field label="Approved template" htmlFor="bc-template">
          <select
            id="bc-template"
            value={templateId}
            onChange={(e) => {
              const next = templates.find((t) => t.id === e.target.value) ?? null;
              setTemplateId(e.target.value);
              setParameters((current) => emptyParameters(next ? countPlaceholders(next.body) : 0, current));
            }}
            required
            className={selectClass}
          >
            <option value="">Choose a template…</option>
            {templates.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.languageCode})
              </option>
            ))}
          </select>
        </Field>
      </div>

      {template && (
        <>
          {needsMedia && (
            <Field
              label={`${template.headerFormat?.toLowerCase() ?? "media"} header`}
              htmlFor="bc-media"
              hint="Meta approves the format of a media header but never keeps the file, so it must be sent with every message. Paste a public https URL, or the id of media already uploaded to the account."
            >
              <input
                id="bc-media"
                value={headerMediaUrl}
                onChange={(e) => setHeaderMediaUrl(e.target.value)}
                placeholder="https://bitsolmarketing.com/images/offer.png"
                required
                className={inputClass}
              />
            </Field>
          )}

          {placeholders > 0 && (
            <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
              <p className="text-[0.8125rem] font-medium text-slate-900">Fill the template&apos;s values</p>
              {parameters.map((parameter, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[9rem_1fr_1fr]">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-cyan-100 px-2 py-0.5 font-mono text-xs text-cyan-700">{`{{${index + 1}}}`}</span>
                    <span className="truncate text-[0.8125rem] text-slate-500">{template.variables[index] ?? ""}</span>
                  </div>
                  <select
                    value={parameter.kind}
                    onChange={(e) => updateParameter(index, { kind: e.target.value as ParameterKind })}
                    aria-label={`Source for placeholder ${index + 1}`}
                    className={selectClass}
                  >
                    {Object.entries(PARAMETER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  {parameter.kind === "static" ? (
                    <input
                      value={parameter.value}
                      onChange={(e) => updateParameter(index, { value: e.target.value })}
                      placeholder="Text sent to everyone"
                      required
                      className={inputClass}
                    />
                  ) : parameter.kind === "contactName" ? (
                    <input
                      value={parameter.fallback}
                      onChange={(e) => updateParameter(index, { fallback: e.target.value })}
                      placeholder="Fallback when they have no profile name"
                      className={inputClass}
                    />
                  ) : (
                    <p className="self-center text-[0.8125rem] text-slate-500">Filled from each contact.</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <Field label="What each person receives" htmlFor="bc-preview" hint="Shown with a sample contact's values. Each recipient gets their own.">
            <textarea
              id="bc-preview"
              readOnly
              rows={5}
              value={
                (template.headerText ? `${template.headerText}\n\n` : "") +
                render(template.body, previewValues) +
                (template.footerText ? `\n\n${template.footerText}` : "")
              }
              className={cn(inputClass, "bg-white")}
            />
          </Field>
        </>
      )}

      <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
        <p className="text-[0.8125rem] font-medium text-slate-900">Audience</p>

        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          {(
            [
              ["segment", "Known contacts"],
              ["list", "Paste numbers"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setAudienceKind(value);
                setReach(null);
              }}
              className={cn(
                "flex-1 rounded px-3 py-1.5 text-[0.875rem] font-medium transition",
                audienceKind === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {audienceKind === "segment" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Only contacts active in the last…"
              htmlFor="bc-days"
              hint="Days. Leave blank for everyone this number knows. A number silent for a year is the one most likely to report the message."
            >
              <input id="bc-days" type="number" min={1} max={3650} value={activeWithinDays} onChange={(e) => setActiveWithinDays(e.target.value)} placeholder="90" className={inputClass} />
            </Field>
            <Field label="Cap the number of recipients" htmlFor="bc-limit" hint="Blank means no cap, up to 5,000 per broadcast.">
              <input id="bc-limit" type="number" min={1} max={5000} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="500" className={inputClass} />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className={cn(btn.secondary, "cursor-pointer")}>
                <Upload className="h-4 w-4" />
                Choose a CSV or text file
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setNumbers(await file.text());
                    // Let the same file be picked again after an edit.
                    e.target.value = "";
                  }}
                />
              </label>
              {numbers && (
                <button
                  type="button"
                  onClick={() => {
                    setNumbers("");
                    setReport(null);
                    setReach(null);
                  }}
                  className={btn.ghost}
                >
                  Clear
                </button>
              )}
            </div>
            <Field
              label="Numbers"
              htmlFor="bc-numbers"
              hint="One per line, or a CSV with the number first and a name second. 0300…, +92 300…, 92300… and 300… are all understood; duplicates and opt-outs are removed."
            >
              <textarea
                id="bc-numbers"
                value={numbers}
                onChange={(e) => setNumbers(e.target.value)}
                rows={6}
                placeholder={"03001234567, Ali Raza\n+92 321 9876543, Sadia Khan\n03339998877"}
                className={cn(inputClass, "font-mono text-sm")}
              />
            </Field>
            {report && (
              <div className="space-y-1 rounded-md bg-slate-50 p-3 text-[0.8125rem] text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">{report.valid}</span> number{report.valid === 1 ? "" : "s"} read
                  {report.known > 0 && ` · ${report.known} already known`}
                  {report.valid - report.known > 0 && ` · ${report.valid - report.known} new`}
                </p>
                {(report.duplicates > 0 || report.invalid > 0 || report.optedOut > 0 || report.blocked > 0) && (
                  <p>
                    Skipped:
                    {report.duplicates > 0 && ` ${report.duplicates} duplicate`}
                    {report.invalid > 0 && ` · ${report.invalid} not a number`}
                    {report.optedOut > 0 && ` · ${report.optedOut} opted out`}
                    {report.blocked > 0 && ` · ${report.blocked} blocked`}
                  </p>
                )}
                {report.preview.length > 0 && (
                  <p className="font-mono text-xs">
                    {report.preview.map((row) => `${row.phone}${row.name ? ` (${row.name})` : ""}`).join(" · ")}
                    {report.valid > report.preview.length && " …"}
                  </p>
                )}
                {report.samples.length > 0 && <p className="text-amber-700">Ignored: {report.samples.map((s) => `"${s.raw}" (${s.reason})`).join(", ")}</p>}
              </div>
            )}
          </div>
        )}

        <p className="flex items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-[0.9375rem]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Users className="h-4 w-4 text-slate-400" />}
          {reach === null ? (
            <span className="text-slate-500">{audienceKind === "list" ? "Paste or upload numbers to see how many can be messaged." : "Counting the audience…"}</span>
          ) : (
            <span>
              <span className="font-semibold">{reach.toLocaleString()}</span> contact{reach === 1 ? "" : "s"} will be messaged. Opted-out and blocked numbers are already
              excluded.
            </span>
          )}
        </p>
      </div>

      <Field
        label="Send at (optional)"
        htmlFor="bc-when"
        hint={
          cronConfigured
            ? "Leave empty to send by hand from the broadcast's row. A scheduled broadcast goes out on the next follow-up cron run after this time."
            : "Scheduling needs the follow-up cron line from Chatbot Setup to be installed on the server. Until then, leave this empty and press Send when ready."
        }
      >
        <input id="bc-when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={cn(inputClass, "sm:max-w-xs")} />
      </Field>

      {!canSend && (
        <p className="rounded-md bg-amber-100 px-4 py-3 text-[0.9375rem] text-amber-700">
          WhatsApp is not connected yet, so this can be drafted but not sent. Enter the phone number ID and access token on Chatbot Setup.
        </p>
      )}
      <FormError message={error ?? undefined} />

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
        <button type="button" onClick={() => setOpen(false)} className={btn.ghost}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !template || !title.trim() || reach === 0 || (audienceKind === "list" && !report?.sendable) || (needsMedia && !headerMediaUrl.trim())}
          className={btn.primary}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} {scheduledAt ? "Schedule" : "Save as draft"}
        </button>
      </div>
    </form>
  );
}
