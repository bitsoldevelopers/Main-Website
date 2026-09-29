"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Clock, Mail, Plus, Trash2 } from "lucide-react";
import { saveSequence } from "@/app/admin/actions-automation";
import type { FormState } from "@/app/admin/actions";
import { Callout, Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export interface SequenceStepValue {
  /** Stable key for React; `id` is only set for steps that exist in the database. */
  key: string;
  id?: string;
  name: string;
  delayDays: number;
  templateId: string;
}

export interface SequenceFormValues {
  id?: string;
  name: string;
  description: string;
  steps: SequenceStepValue[];
}

let counter = 0;
const newKey = () => `new-${++counter}`;

/** Day on which each email goes out, counted from the day a lead is enrolled. */
function timeline(steps: SequenceStepValue[]): number[] {
  let day = 0;
  return steps.map((step) => {
    day += Math.max(0, step.delayDays);
    return day;
  });
}

export function SequenceForm({
  initial,
  templates,
  activeRuns = 0,
}: {
  initial?: SequenceFormValues;
  templates: { id: string; name: string; subject: string }[];
  activeRuns?: number;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(saveSequence, null);
  const [steps, setSteps] = useState<SequenceStepValue[]>(
    // A fixed key: the same on the server and in the browser.
    initial?.steps.length ? initial.steps : [{ key: "first", name: "Email 1", delayDays: 0, templateId: templates[0]?.id ?? "" }]
  );
  const days = timeline(steps);

  const update = (key: string, patch: Partial<SequenceStepValue>) => setSteps((list) => list.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  const move = (index: number, by: number) =>
    setSteps((list) => {
      const target = index + by;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  return (
    <form action={formAction} className="space-y-6">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="steps" value={JSON.stringify(steps.map(({ id, name, delayDays, templateId }) => ({ id, name, delayDays, templateId })))} />
      <FormError message={state?.error} />

      {activeRuns > 0 && (
        <Callout tone="amber" title={`${activeRuns} lead${activeRuns === 1 ? " is" : "s are"} in this sequence right now`}>
          Changes apply to the emails they have not received yet. Nothing already sent is sent again, and a wait that is
          already running keeps its date.
        </Callout>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Sequence name" htmlFor="sequence-name" error={state?.fieldErrors?.name}>
          <input id="sequence-name" name="name" defaultValue={initial?.name ?? ""} placeholder="BITSOL Lead Outreach" className={inputClass} required />
        </Field>
        <Field label="Description" htmlFor="sequence-description">
          <input id="sequence-description" name="description" defaultValue={initial?.description ?? ""} placeholder="Who it is for and what it says" className={inputClass} />
        </Field>
      </div>

      {templates.length === 0 ? (
        <Callout tone="amber" title="There are no templates yet">
          A sequence is a series of templates.{" "}
          <Link href="/admin/automation/templates/new" className="font-semibold text-cyan-700 underline">
            Create a template
          </Link>{" "}
          first.
        </Callout>
      ) : (
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.key}>
              {i > 0 && (
                <div className="mb-3 ml-6 flex items-center gap-3 border-l-2 border-dashed border-slate-300 py-1 pl-6">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  <label htmlFor={`delay-${step.key}`} className="text-sm text-slate-600">
                    Wait
                  </label>
                  <input
                    id={`delay-${step.key}`}
                    type="number"
                    min={1}
                    max={365}
                    value={step.delayDays}
                    onChange={(e) => update(step.key, { delayDays: Math.max(0, Number.parseInt(e.target.value, 10) || 0) })}
                    className={`${inputClass} w-24 bg-white py-2`}
                  />
                  <span className="text-sm text-slate-600">day{step.delayDays === 1 ? "" : "s"} after the previous email, then check for a reply</span>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                  <span className="flex shrink-0 items-center gap-3 lg:w-40">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-100 text-cyan-700">
                      <Mail className="h-5 w-5" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold text-slate-900">Email {i + 1}</span>
                      <span className="block text-xs text-slate-500">{days[i] === 0 ? "Immediately" : `Day ${days[i]}`}</span>
                    </span>
                  </span>

                  <Field label="Name" htmlFor={`name-${step.key}`} className="min-w-0 flex-1">
                    <input id={`name-${step.key}`} value={step.name} onChange={(e) => update(step.key, { name: e.target.value })} placeholder="Introduction" className={inputClass} />
                  </Field>

                  <Field label="Template" htmlFor={`template-${step.key}`} className="min-w-0 flex-1">
                    <select id={`template-${step.key}`} value={step.templateId} onChange={(e) => update(step.key, { templateId: e.target.value })} className={selectClass}>
                      <option value="">Choose a template…</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={btn.icon} aria-label={`Move email ${i + 1} up`}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === steps.length - 1} className={btn.icon} aria-label={`Move email ${i + 1} down`}>
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSteps((list) => list.filter((s) => s.key !== step.key))}
                      disabled={steps.length === 1}
                      className={`${btn.icon} hover:bg-red-50 hover:text-red-600`}
                      aria-label={`Remove email ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {step.templateId && (
                  <p className="mt-3 truncate text-xs text-slate-500">
                    Subject: {templates.find((t) => t.id === step.templateId)?.subject}{" "}
                    <Link href={`/admin/automation/templates/${step.templateId}`} className="font-semibold text-cyan-700 hover:underline">
                      Edit template
                    </Link>
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {templates.length > 0 && steps.length < 12 && (
        <button
          type="button"
          onClick={() =>
            setSteps((list) => [...list, { key: newKey(), name: `Email ${list.length + 1}`, delayDays: list.length === 0 ? 0 : 3, templateId: templates[0]?.id ?? "" }])
          }
          className={btn.secondary}
        >
          <Plus className="h-4 w-4" /> Add an email
        </button>
      )}

      <p className="text-sm text-slate-500">
        {steps.length} email{steps.length === 1 ? "" : "s"} over {days[days.length - 1] ?? 0} days. A reply, a bounce or an unsubscribe ends the
        sequence for that lead at once.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText="Saving…" disabled={templates.length === 0}>
          {initial?.id ? "Save sequence" : "Create sequence"}
        </SubmitButton>
        <Link href="/admin/automation/sequences" className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
