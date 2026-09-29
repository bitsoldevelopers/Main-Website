"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveRedirect } from "@/app/admin/actions-cms";
import type { FormState } from "@/app/admin/actions";
import { Field, FormError, inputClass, selectClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export function RedirectForm() {
  const [state, formAction] = useActionState<FormState, FormData>(saveRedirect, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful save so rules can be added rapidly.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormError message={state?.error} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_auto] lg:items-end">
        <Field label="Old URL" htmlFor="r-from" hint="Path on this site, e.g. /old-page">
          <input id="r-from" name="fromPath" placeholder="/old-page" className={inputClass} required />
        </Field>
        <Field label="Redirects to" htmlFor="r-to" hint="A path or a full https:// URL">
          <input id="r-to" name="toPath" placeholder="/services/seo-optimization" className={inputClass} required />
        </Field>
        <Field label="Type" htmlFor="r-kind" hint="301 for moved pages">
          <select id="r-kind" name="kind" className={selectClass} defaultValue="permanent">
            <option value="permanent">301 — permanent</option>
            <option value="temporary">302 — temporary</option>
          </select>
        </Field>
        <div className="pb-6">
          <SubmitButton pendingText="Adding…">Add rule</SubmitButton>
        </div>
      </div>
      {state?.ok && <p className="text-sm text-emerald-700">Rule saved. It goes live within a minute.</p>}
    </form>
  );
}
