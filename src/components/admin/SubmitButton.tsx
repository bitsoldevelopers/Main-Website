"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { btn } from "./ui";

type Variant = keyof typeof btn;

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: ReactNode; variant?: Variant }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(btn[variant], className)} {...rest}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** A submit button that asks before it fires. Used for deletes. */
export function ConfirmButton({
  message = "Are you sure? This cannot be undone.",
  children,
  variant = "danger",
  className,
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { message?: string; variant?: Variant }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(btn[variant], className)}
      onClick={(e) => {
        if (!window.confirm(message)) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      {...rest}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}
