"use client";

import { useActionState } from "react";
import { createUser, type FormState } from "@/app/admin/actions";
import { Field, FormError, inputClass, selectClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

const roles = [
  { value: "STUDENT", label: "Student — enrolled in academy courses" },
  { value: "CLIENT", label: "Client — a customer account" },
  { value: "EDITOR", label: "Editor — admin access to content & media" },
  { value: "MANAGER", label: "Business Development Manager — admin access to CRM & campaigns" },
  { value: "ADMIN", label: "Admin — full admin access" },
];

export function UserForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createUser, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state?.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="user-name">
          <input id="user-name" name="name" placeholder="Full name" className={inputClass} autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="user-email" error={errors.email}>
          <input
            id="user-email"
            name="email"
            type="email"
            placeholder="person@company.com"
            className={inputClass}
            autoComplete="off"
            required
          />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Password" htmlFor="user-password" error={errors.password} hint="At least 8 characters. Stored as a scrypt hash.">
          <input
            id="user-password"
            name="password"
            type="password"
            className={inputClass}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        <Field label="Role" htmlFor="user-role" error={errors.role}>
          <select id="user-role" name="role" defaultValue="STUDENT" className={selectClass}>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SubmitButton pendingText="Creating…">Create user</SubmitButton>
    </form>
  );
}
