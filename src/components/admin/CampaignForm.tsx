"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCampaign } from "@/app/admin/actions-crm";
import type { FormState } from "@/app/admin/actions";
import { Field, FormError, btn, inputClass, selectClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

const PLATFORMS = ["META", "GOOGLE", "LINKEDIN", "TIKTOK", "OTHER"] as const;
const STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;

export interface CampaignFormValues {
  id?: string;
  name: string;
  platform: string;
  objective: string;
  budget: string;
  startDate: string;
  endDate: string;
  status: string;
  landingPage: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  notes: string;
}

export function CampaignForm({ initial }: { initial?: CampaignFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveCampaign, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="Campaign name" htmlFor="c-name" error={errors.name}>
          <input id="c-name" name="name" defaultValue={initial?.name ?? ""} placeholder="Ramadan lead gen — Lahore" className={inputClass} required />
        </Field>
        <Field label="Platform" htmlFor="c-platform">
          <select id="c-platform" name="platform" defaultValue={initial?.platform ?? "META"} className={selectClass}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p === "META" ? "Meta (FB/IG)" : p.charAt(0) + p.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Objective" htmlFor="c-objective">
          <input id="c-objective" name="objective" defaultValue={initial?.objective ?? ""} placeholder="Leads / Traffic / Sales" className={inputClass} />
        </Field>
        <Field label="Budget (USD)" htmlFor="c-budget" error={errors.budget}>
          <input id="c-budget" name="budget" type="number" min={0} step="0.01" defaultValue={initial?.budget ?? ""} placeholder="500" className={inputClass} />
        </Field>
        <Field label="Status" htmlFor="c-status">
          <select id="c-status" name="status" defaultValue={initial?.status ?? "DRAFT"} className={selectClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Start date" htmlFor="c-start" error={errors.startDate}>
          <input id="c-start" name="startDate" type="date" defaultValue={initial?.startDate ?? ""} className={inputClass} />
        </Field>
        <Field label="End date" htmlFor="c-end" error={errors.endDate}>
          <input id="c-end" name="endDate" type="date" defaultValue={initial?.endDate ?? ""} className={inputClass} />
        </Field>
      </div>

      <Field label="Landing page" htmlFor="c-landing" error={errors.landingPage} hint="Where the ads send people, e.g. /services/seo-optimization.">
        <input id="c-landing" name="landingPage" defaultValue={initial?.landingPage ?? ""} placeholder="/services/seo-optimization" className={inputClass} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="UTM source" htmlFor="c-utm-source">
          <input id="c-utm-source" name="utmSource" defaultValue={initial?.utmSource ?? ""} placeholder="facebook" className={inputClass} />
        </Field>
        <Field label="UTM medium" htmlFor="c-utm-medium">
          <input id="c-utm-medium" name="utmMedium" defaultValue={initial?.utmMedium ?? ""} placeholder="cpc" className={inputClass} />
        </Field>
        <Field
          label="UTM campaign"
          htmlFor="c-utm-campaign"
          hint="Leads whose utm_campaign matches this value are attributed to this campaign."
        >
          <input id="c-utm-campaign" name="utmCampaign" defaultValue={initial?.utmCampaign ?? ""} placeholder="ramadan-leadgen-2027" className={inputClass} />
        </Field>
      </div>

      <Field label="Notes" htmlFor="c-notes">
        <textarea id="c-notes" name="notes" rows={3} defaultValue={initial?.notes ?? ""} placeholder="Audiences, creatives, learnings…" className={inputClass} />
      </Field>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save campaign" : "Create campaign"}</SubmitButton>
        <Link href={initial?.id ? `/admin/campaigns/${initial.id}` : "/admin/campaigns"} className={btn.secondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
