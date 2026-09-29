"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveCourse, type FormState } from "@/app/admin/actions";
import { Field, FormError, btn, inputClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface CourseFormValues {
  id?: string;
  title: string;
  description: string;
  price: number;
  image: string;
}

export function CourseForm({ initial }: { initial?: CourseFormValues }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveCourse, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <FormError message={state?.error} />

      <Field label="Title" htmlFor="course-title" error={errors.title}>
        <input
          id="course-title"
          name="title"
          defaultValue={initial?.title ?? ""}
          placeholder="Digital Marketing Mastery"
          className={inputClass}
          required
        />
      </Field>

      <Field label="Description" htmlFor="course-description" error={errors.description}>
        <textarea
          id="course-description"
          name="description"
          defaultValue={initial?.description ?? ""}
          rows={4}
          placeholder="What the student will be able to do after the course."
          className={inputClass}
          required
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-[140px_minmax(0,1fr)]">
        <Field label="Price (USD)" htmlFor="course-price" error={errors.price}>
          <input
            id="course-price"
            name="price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={initial ? initial.price : ""}
            placeholder="299"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Cover image URL" htmlFor="course-image" error={errors.image}>
          <input
            id="course-image"
            name="image"
            defaultValue={initial?.image ?? ""}
            placeholder="https://images.unsplash.com/…"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <SubmitButton pendingText="Saving…">{initial?.id ? "Save course" : "Add course"}</SubmitButton>
        {initial?.id && (
          <Link href="/admin/courses" className={btn.secondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
