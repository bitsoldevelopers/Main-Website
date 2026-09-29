"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveFaq } from "@/app/admin/actions-cms";
import type { FormState } from "@/app/admin/actions";
import { Field, FormError, btn, inputClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface FaqFormValues {
  id?: string;
  question: string;
  answer: string;
  page: string;
  order: number;
  published: boolean;
}

export function FaqForm({ initial }: { initial?: FaqFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveFaq, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      {/* Only the homepage consumes FAQs today; the column exists for future pages. */}
      <input type="hidden" name="page" value={initial?.page ?? "home"} />
      <FormError message={state?.error} />

      <Field label="Question" htmlFor="f-question" error={errors.question}>
        <textarea id="f-question" name="question" rows={2} defaultValue={initial?.question ?? ""} className={inputClass} required />
      </Field>

      <Field
        label="Answer"
        htmlFor="f-answer"
        error={errors.answer}
        hint="Written for visitors and emitted as FAQPage schema for Google, so keep it factual and complete."
      >
        <textarea id="f-answer" name="answer" rows={5} defaultValue={initial?.answer ?? ""} className={inputClass} required />
      </Field>

      <div className="grid items-end gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Order" htmlFor="f-order" hint="Lower numbers show first.">
          <input id="f-order" name="order" type="number" defaultValue={initial?.order ?? 0} className={inputClass} />
        </Field>
        <label className="flex items-center gap-3 pb-1 text-sm text-slate-900">
          <input
            type="checkbox"
            name="published"
            defaultChecked={initial ? initial.published : true}
            className="h-4 w-4 rounded border-slate-400 bg-slate-100 accent-[#00D9FF]"
          />
          Published — shown on the homepage and in its schema
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save FAQ" : "Add FAQ"}</SubmitButton>
        <Link href="/admin/faqs" className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
