"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveTestimonial } from "@/app/admin/actions-cms";
import type { FormState } from "@/app/admin/actions";
import { Field, FormError, btn, inputClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface TestimonialFormValues {
  id?: string;
  name: string;
  title: string;
  company: string;
  quote: string;
  order: number;
  published: boolean;
}

export function TestimonialForm({ initial }: { initial?: TestimonialFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveTestimonial, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Client name" htmlFor="t-name" error={errors.name} hint="Shown as the card heading when no company is set.">
          <input id="t-name" name="name" defaultValue={initial?.name ?? ""} placeholder="Ayesha Malik" className={inputClass} required />
        </Field>
        <Field label="Company" htmlFor="t-company">
          <input id="t-company" name="company" defaultValue={initial?.company ?? ""} placeholder="Global Logistics Corp" className={inputClass} />
        </Field>
      </div>

      <Field label="Their role / relationship" htmlFor="t-title">
        <input id="t-title" name="title" defaultValue={initial?.title ?? "Client"} placeholder="CEO, Marketing Director…" className={inputClass} />
      </Field>

      <Field label="Quote" htmlFor="t-quote" error={errors.quote}>
        <textarea id="t-quote" name="quote" rows={4} defaultValue={initial?.quote ?? ""} placeholder="What they said about working with BITSOL." className={inputClass} required />
      </Field>

      <div className="grid items-end gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Order" htmlFor="t-order" hint="Lower numbers show first.">
          <input id="t-order" name="order" type="number" defaultValue={initial?.order ?? 0} className={inputClass} />
        </Field>
        <label className="flex items-center gap-3 pb-1 text-sm text-slate-900">
          <input
            type="checkbox"
            name="published"
            defaultChecked={initial ? initial.published : true}
            className="h-4 w-4 rounded border-slate-400 bg-slate-100 accent-[#00D9FF]"
          />
          Published — shown in the homepage card stack
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save testimonial" : "Add testimonial"}</SubmitButton>
        <Link href="/admin/testimonials" className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
