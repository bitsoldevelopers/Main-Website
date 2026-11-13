"use client";

import { useActionState } from "react";
import { saveSocialSetup, type SetupState } from "@/app/admin/actions-social";
import type { SetupGroup } from "@/lib/admin/social/config";
import { Field, FormError, inputClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface SetupFieldView {
  key: string;
  label: string;
  hint: string;
  secret: boolean;
  numeric: boolean;
  /** Whether a value exists already. */
  saved: boolean;
  /** The current value, for fields that are not secret. */
  current: string;
}

/** Ids and secrets of one app. Saved secrets are never sent back to the browser. */
export function SocialSetupForm({ group, fields }: { group: SetupGroup; fields: SetupFieldView[] }) {
  const [state, formAction] = useActionState<SetupState, FormData>(saveSocialSetup, null);

  return (
    <form action={formAction} className="space-y-4" autoComplete="off">
      <input type="hidden" name="group" value={group} />
      <FormError message={state?.error} />

      {fields.map((field) => {
        const id = `setup-${field.key}`;
        return (
          <Field
            key={field.key}
            label={field.label}
            htmlFor={id}
            hint={field.secret && field.saved ? "Saved. Leave empty to keep it, or type a new one to replace it." : field.hint}
          >
            <input
              id={id}
              name={field.key}
              type={field.secret ? "password" : "text"}
              inputMode={field.numeric ? "numeric" : undefined}
              defaultValue={field.secret ? "" : field.current}
              placeholder={field.secret && field.saved ? "••••••••••••" : ""}
              required={!field.saved}
              autoComplete="off"
              spellCheck={false}
              className={inputClass}
            />
          </Field>
        );
      })}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Checking…">Save and check</SubmitButton>
        {state?.ok && <p className="text-sm text-emerald-700">{state.message}</p>}
      </div>
    </form>
  );
}
