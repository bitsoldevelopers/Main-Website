"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveLead } from "@/app/admin/actions-crm";
import type { FormState } from "@/app/admin/actions";
import {
  LEAD_PRIORITIES,
  LEAD_PRIORITY_META,
  LEAD_STATUSES,
  LEAD_STATUS_META,
  SERVICE_LABELS,
} from "@/lib/admin/leads";
import { Field, FormError, btn, inputClass, selectClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface LeadFormValues {
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  city: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
}

export function LeadForm({ initial }: { initial?: LeadFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveLead, null);
  const errors = state?.fieldErrors ?? {};
  const backHref = initial?.id ? `/admin/leads/${initial.id}` : "/admin/leads";

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="lead-name" error={errors.name}>
          <input id="lead-name" name="name" defaultValue={initial?.name ?? ""} placeholder="Jane Khan" className={inputClass} required />
        </Field>
        <Field label="Email" htmlFor="lead-email" error={errors.email}>
          <input
            id="lead-email"
            name="email"
            type="email"
            defaultValue={initial?.email ?? ""}
            placeholder="jane@company.com"
            className={inputClass}
            required
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone / WhatsApp" htmlFor="lead-phone">
          <input id="lead-phone" name="phone" defaultValue={initial?.phone ?? ""} placeholder="+92 300 1234567" className={inputClass} />
        </Field>
        <Field label="Company" htmlFor="lead-company">
          <input id="lead-company" name="company" defaultValue={initial?.company ?? ""} placeholder="Company name" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="City" htmlFor="lead-city">
          <input id="lead-city" name="city" defaultValue={initial?.city ?? ""} placeholder="Lahore" className={inputClass} />
        </Field>
        <Field label="Country" htmlFor="lead-country">
          <input id="lead-country" name="country" defaultValue={initial?.country ?? ""} placeholder="Pakistan" className={inputClass} />
        </Field>
      </div>

      <Field
        label="Service / topic"
        htmlFor="lead-subject"
        hint="Free text; the service codes used by the contact form are shown for consistency."
      >
        <input
          id="lead-subject"
          name="subject"
          defaultValue={initial?.subject ?? ""}
          placeholder={`e.g. ${Object.values(SERVICE_LABELS).slice(0, 3).join(", ")}…`}
          className={inputClass}
          list="lead-subject-options"
        />
        <datalist id="lead-subject-options">
          {Object.entries(SERVICE_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </datalist>
      </Field>

      <Field label="Message / context" htmlFor="lead-message">
        <textarea
          id="lead-message"
          name="message"
          rows={4}
          defaultValue={initial?.message ?? ""}
          placeholder="Where this lead came from and what they need."
          className={inputClass}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Status" htmlFor="lead-status" error={errors.status}>
          <select id="lead-status" name="status" defaultValue={initial?.status ?? "NEW"} className={selectClass}>
            {LEAD_STATUSES.map((status) => (
              <option key={status} value={status}>
                {LEAD_STATUS_META[status].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority" htmlFor="lead-priority" error={errors.priority}>
          <select id="lead-priority" name="priority" defaultValue={initial?.priority ?? "NORMAL"} className={selectClass}>
            {LEAD_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {LEAD_PRIORITY_META[priority].label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save lead" : "Add lead"}</SubmitButton>
        <Link href={backHref} className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
