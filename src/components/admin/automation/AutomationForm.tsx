"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock, Plus, Trash2 } from "lucide-react";
import { saveAutomation } from "@/app/admin/actions-automation";
import type { FormState } from "@/app/admin/actions";
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  MANDATORY_STOP_CONDITIONS,
  operatorNeedsValue,
  type ConditionField,
  type ConditionOperator,
} from "@/lib/automation/conditions";
import { TRIGGER_LABELS } from "@/lib/automation/labels";
import { Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

export interface ConditionValue {
  key: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface AutomationFormValues {
  id?: string;
  name: string;
  description: string;
  sequenceId: string;
  trigger: string;
  createTask: boolean;
  taskTitle: string;
  taskNote: string;
  taskDueDays: number;
  conditions: ConditionValue[];
}

let counter = 0;
const newKey = () => `c-${++counter}`;

export function AutomationForm({ initial, sequences }: { initial?: AutomationFormValues; sequences: { id: string; name: string; steps: number }[] }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveAutomation, null);
  const errors = state?.fieldErrors ?? {};
  const [conditions, setConditions] = useState<ConditionValue[]>(initial?.conditions ?? []);
  const [createTask, setCreateTask] = useState(initial?.createTask ?? true);

  const update = (key: string, patch: Partial<ConditionValue>) => setConditions((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  return (
    <form action={formAction} className="space-y-8">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="conditions" value={JSON.stringify(conditions.map(({ field, operator, value }) => ({ field, operator, value })))} />
      <FormError message={state?.error} />

      <section className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Automation name" htmlFor="automation-name" error={errors.name}>
            <input id="automation-name" name="name" defaultValue={initial?.name ?? ""} placeholder="BITSOL Cold Outreach" className={inputClass} required />
          </Field>
          <Field label="Sequence" htmlFor="automation-sequence" error={errors.sequenceId} hint="The emails this automation sends, and the waits between them.">
            <select id="automation-sequence" name="sequenceId" defaultValue={initial?.sequenceId ?? sequences[0]?.id ?? ""} className={selectClass} required>
              {sequences.length === 0 && <option value="">No sequence exists yet</option>}
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.name} ({sequence.steps} email{sequence.steps === 1 ? "" : "s"})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="automation-description">
          <textarea id="automation-description" name="description" rows={2} defaultValue={initial?.description ?? ""} className={inputClass} />
        </Field>
        <Field label="Who can be enrolled" htmlFor="automation-trigger">
          <select id="automation-trigger" name="trigger" defaultValue={initial?.trigger ?? "IMPORT"} className={selectClass}>
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-900">Entry conditions</h3>
        <p className="mb-3 mt-1 text-sm text-slate-500">
          A lead is enrolled only if it meets all of these. Every lead also needs an address that may be emailed, and
          must not have replied, opted out or been taken over by a person.
        </p>
        {conditions.length === 0 && <p className="mb-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">No extra conditions: every eligible lead can be enrolled.</p>}
        <ul className="space-y-2">
          {conditions.map((condition) => (
            <li key={condition.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center">
              <select value={condition.field} onChange={(e) => update(condition.key, { field: e.target.value as ConditionField })} className={`${selectClass} sm:w-48`} aria-label="Field">
                {(Object.keys(CONDITION_FIELDS) as ConditionField[]).map((field) => (
                  <option key={field} value={field}>
                    {CONDITION_FIELDS[field]}
                  </option>
                ))}
              </select>
              <select
                value={condition.operator}
                onChange={(e) => update(condition.key, { operator: e.target.value as ConditionOperator })}
                className={`${selectClass} sm:w-52`}
                aria-label="Comparison"
              >
                {(Object.keys(CONDITION_OPERATORS) as ConditionOperator[]).map((operator) => (
                  <option key={operator} value={operator}>
                    {CONDITION_OPERATORS[operator]}
                  </option>
                ))}
              </select>
              {operatorNeedsValue(condition.operator) ? (
                <input value={condition.value} onChange={(e) => update(condition.key, { value: e.target.value })} placeholder="Value" className={`${inputClass} min-w-0 flex-1`} aria-label="Value" />
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                onClick={() => setConditions((list) => list.filter((c) => c.key !== condition.key))}
                className={`${btn.icon} shrink-0 hover:bg-red-50 hover:text-red-600`}
                aria-label="Remove condition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {conditions.length < 10 && (
          <button type="button" onClick={() => setConditions((list) => [...list, { key: newKey(), field: "tag", operator: "equals", value: "" }])} className={`${btn.secondary} mt-3`}>
            <Plus className="h-4 w-4" /> Add a condition
          </button>
        )}
      </section>

      <section>
        <h3 className="text-sm font-bold text-slate-900">Stop conditions</h3>
        <p className="mb-3 mt-1 text-sm text-slate-500">
          Always on. They are checked the moment they happen and again before every email, so nobody is emailed after
          any of them.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {MANDATORY_STOP_CONDITIONS.map((rule) => (
            <li key={rule.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" /> {rule.label}
            </li>
          ))}
          <li className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" /> A person moves the lead on (contacted, qualified, meeting, proposal…)
          </li>
        </ul>
      </section>

      <section className="space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-900">After the last email</h3>
          <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="createTask" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} className="mt-1" />
            <span>
              <span className="font-semibold text-slate-900">Create a manual follow-up task</span>
              <span className="block text-xs text-slate-500">For whoever the lead is assigned to. A lead that replies gets a task straight away, whatever this is set to.</span>
            </span>
          </label>
        </div>
        {createTask && (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
            <Field label="Task title" htmlFor="task-title" error={errors.taskTitle} hint="Variables work here too.">
              <input id="task-title" name="taskTitle" defaultValue={initial?.taskTitle ?? "Follow up personally with {{first_name|this lead}}"} className={inputClass} />
            </Field>
            <Field label="Due after (days)" htmlFor="task-due">
              <input id="task-due" name="taskDueDays" type="number" min={0} max={60} defaultValue={initial?.taskDueDays ?? 1} className={inputClass} />
            </Field>
            <Field label="Internal note" htmlFor="task-note" className="sm:col-span-2">
              <textarea
                id="task-note"
                name="taskNote"
                rows={3}
                defaultValue={initial?.taskNote ?? "The outreach sequence finished without a reply. Try a call or a LinkedIn message."}
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText="Saving…" disabled={sequences.length === 0}>
          {initial?.id ? "Save automation" : "Create automation"}
        </SubmitButton>
        <Link href={initial?.id ? `/admin/automation/automations/${initial.id}` : "/admin/automation/automations"} className={btn.secondary}>
          Cancel
        </Link>
        {!initial?.id && <span className="text-xs text-slate-500">It is created as a draft. Nothing is sent until you activate it.</span>}
      </div>
    </form>
  );
}
