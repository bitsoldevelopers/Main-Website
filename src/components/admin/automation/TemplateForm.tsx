"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { saveTemplate } from "@/app/admin/actions-automation";
import type { FormState } from "@/app/admin/actions";
import { SAMPLE_VALUES, TEMPLATE_VARIABLES, composeEmail, type TemplateValues } from "@/lib/automation/email/render";
import { Field, FormError, btn, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export interface TemplateFormValues {
  id?: string;
  name: string;
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

export interface PreviewFooter {
  companyName: string;
  companyAddress: string;
  signature: string;
  senderName: string;
}

const BARE: TemplateValues = {
  ...SAMPLE_VALUES,
  first_name: "",
  last_name: "",
  title: "",
  company_name: "",
  website: "",
  linkedin_url: "",
  contact_location: "",
  company_description: "",
};

/**
 * Template editor with a live preview. The preview is rendered by the same
 * function that renders the real email, against a complete sample lead and
 * against a lead with almost nothing on file, because the second one is
 * where templates break.
 */
export function TemplateForm({ initial, footer }: { initial?: TemplateFormValues; footer: PreviewFooter }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveTemplate, null);
  const errors = state?.fieldErrors ?? {};

  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl] = useState(initial?.ctaUrl ?? "");
  const [sample, setSample] = useState<"full" | "bare">("full");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  const preview = useMemo(() => {
    const values = { ...(sample === "full" ? SAMPLE_VALUES : BARE), sender_name: footer.senderName, sender_company: footer.companyName };
    return composeEmail({
      subject,
      body,
      ctaLabel,
      ctaUrl,
      values,
      footer: {
        companyName: footer.companyName,
        companyAddress: footer.companyAddress,
        signature: footer.signature,
        unsubscribeUrl: "https://bitsolmarketing.com/unsubscribe?token=…",
      },
    });
  }, [subject, body, ctaLabel, ctaUrl, sample, footer]);

  function insert(variable: string) {
    const token = `{{${variable}}}`;
    if (lastField.current === "subject") {
      setSubject((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}${token}`);
      return;
    }
    const area = bodyRef.current;
    if (!area) {
      setBody((value) => value + token);
      return;
    }
    const start = area.selectionStart ?? body.length;
    const end = area.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <form action={formAction} className="space-y-5">
        {initial?.id && <input type="hidden" name="id" value={initial.id} />}
        <FormError message={state?.error} />

        <Field label="Template name" htmlFor="template-name" error={errors.name} hint="Only you see this.">
          <input id="template-name" name="name" defaultValue={initial?.name ?? ""} placeholder="Outreach 1 — Introduction" className={inputClass} required />
        </Field>

        <Field label="Subject" htmlFor="template-subject" error={errors.subject}>
          <input
            id="template-subject"
            name="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onFocus={() => (lastField.current = "subject")}
            placeholder="A growth idea for {{company_name}}"
            className={inputClass}
            required
          />
        </Field>

        <Field
          label="Email body"
          htmlFor="template-body"
          error={errors.body}
          hint="Plain text. Blank lines separate paragraphs; links become clickable. The signature, address and unsubscribe link are added for you."
        >
          <textarea
            id="template-body"
            name="body"
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onFocus={() => (lastField.current = "body")}
            rows={16}
            className={`${inputClass} font-mono text-[13px] leading-relaxed`}
            required
          />
        </Field>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">Insert a variable</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable.name}
                type="button"
                onClick={() => insert(variable.name)}
                title={`${variable.label} — from: ${variable.source}`}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-700 transition hover:border-cyan-400 hover:bg-cyan-50"
              >
                {`{{${variable.name}}}`}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            <li>
              <code className="rounded bg-slate-100 px-1">{"{{first_name|there}}"}</code> uses &quot;there&quot; when the lead has no first name.
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">{"{{#title}} as {{title}}{{/title}}"}</code> appears only when the lead has a title.
            </li>
          </ul>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Call to action (optional)" htmlFor="template-cta-label">
            <input id="template-cta-label" name="ctaLabel" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="See our services" className={inputClass} />
          </Field>
          <Field label="Link" htmlFor="template-cta-url" error={errors.ctaUrl}>
            <input id="template-cta-url" name="ctaUrl" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://bitsolmarketing.com/services" className={inputClass} />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <SubmitButton pendingText="Saving…">{initial?.id ? "Save template" : "Create template"}</SubmitButton>
          <Link href="/admin/automation/templates" className={btn.secondary}>
            Cancel
          </Link>
        </div>
      </form>

      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Preview</p>
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-semibold">
            {(
              [
                ["full", "Complete lead"],
                ["bare", "Lead with little data"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sample === value}
                onClick={() => setSample(value)}
                className={`rounded-md px-2.5 py-1 transition ${sample === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm">
            <p className="text-xs text-slate-500">
              To: {sample === "full" ? "john@abctechnologies.com" : "lead@example-company.com"}
            </p>
            <p className="mt-1 font-semibold text-slate-900">{preview.subject || <span className="font-normal text-slate-400">No subject</span>}</p>
          </div>
          {/* Rendered by composeEmail, which escapes every value it inserts. */}
          <div className="px-5 py-5" dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>

        {preview.unknown.length > 0 && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            Unknown variable{preview.unknown.length === 1 ? "" : "s"}: {preview.unknown.map((v) => `{{${v}}}`).join(", ")}. The template cannot be saved
            with them.
          </p>
        )}
        {preview.empty.length > 0 && (
          <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            For this lead {preview.empty.map((v) => `{{${v}}}`).join(", ")} {preview.empty.length === 1 ? "is" : "are"} empty and
            {preview.empty.length === 1 ? " has" : " have"} no fallback, so the sentence is printed without it. Add one like{" "}
            <code>{`{{${preview.empty[0]}|fallback}}`}</code> or wrap the sentence in <code>{`{{#${preview.empty[0]}}}…{{/${preview.empty[0]}}}`}</code>.
          </p>
        )}
      </aside>
    </div>
  );
}
