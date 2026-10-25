"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveKnowledge } from "@/app/admin/actions-chatbot";
import { KNOWLEDGE_KINDS, KNOWLEDGE_STATES } from "@/lib/chatbot/constants";
import type { FormState } from "@/app/admin/actions";
import { Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export interface KnowledgeFormValues {
  id?: string;
  slug: string;
  question: string;
  answer: string;
  category: string;
  kind: string;
  state: string;
  keywords: string[];
  sortOrder: number;
}

export function KnowledgeForm({ initial, categories }: { initial?: KnowledgeFormValues; categories: string[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveKnowledge, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <Field label="Question" htmlFor="k-question" error={errors.question} hint="Written the way a customer would ask it.">
        <textarea id="k-question" name="question" rows={2} defaultValue={initial?.question ?? ""} className={inputClass} required />
      </Field>

      <Field
        label="Answer"
        htmlFor="k-answer"
        error={errors.answer}
        hint="What the assistant may say. Keep it factual: it never invents prices, clients or guarantees beyond what is written here and in Chatbot Studio."
      >
        <textarea id="k-answer" name="answer" rows={10} defaultValue={initial?.answer ?? ""} className={inputClass} required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Category" htmlFor="k-category" hint="Groups the entry in the list and tells the assistant its scope.">
          <input id="k-category" name="category" list="k-categories" defaultValue={initial?.category ?? ""} className={inputClass} placeholder="Services" />
          <datalist id="k-categories">
            {categories.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
        </Field>
        <Field label="Kind" htmlFor="k-kind" error={errors.kind}>
          <select id="k-kind" name="kind" defaultValue={initial?.kind ?? "FAQ"} className={selectClass}>
            {KNOWLEDGE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {kind.charAt(0) + kind.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
        <Field label="State" htmlFor="k-state" error={errors.state} hint="Only published entries are used in answers.">
          <select id="k-state" name="state" defaultValue={initial?.state ?? "PUBLISHED"} className={selectClass}>
            {KNOWLEDGE_STATES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Keywords"
        htmlFor="k-keywords"
        hint="Comma-separated words and phrases that should find this entry — include misspellings and Roman Urdu phrasings."
      >
        <textarea id="k-keywords" name="keywords" rows={2} defaultValue={initial?.keywords.join(", ") ?? ""} className={inputClass} />
      </Field>

      <div className="grid items-end gap-5 sm:grid-cols-[minmax(0,1fr)_140px]">
        <Field label="Slug" htmlFor="k-slug" error={errors.slug} hint="Stable id for the entry; generated from the question when left empty.">
          <input id="k-slug" name="slug" defaultValue={initial?.slug ?? ""} className={inputClass} />
        </Field>
        <Field label="Order" htmlFor="k-order" hint="Lower shows first.">
          <input id="k-order" name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save entry" : "Add entry"}</SubmitButton>
        <Link href="/admin/chatbot/knowledge" className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
