"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Inbox, Loader2, Pencil, PlugZap, Plus, Send } from "lucide-react";
import {
  checkInboxNowAction,
  removeMailboxAction,
  saveMailboxAction,
  saveTransport,
  sendMailboxTestEmail,
  testMailboxConnection,
  type MailboxFormState,
} from "@/app/admin/actions-automation";
import type { Mailbox, Transport } from "@/lib/automation/email/mailbox";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";

/**
 * Lead Automation → Settings → Sending mailboxes: send outreach from real
 * mailboxes (Hostinger Business email) over SMTP, and read their inboxes over
 * IMAP for replies and bounces. Or keep Resend.
 */

function Outcome({ state }: { state: MailboxFormState }) {
  if (!state) return null;
  return (
    <div className="space-y-2">
      <FormError message={state.ok ? undefined : state.error} />
      {state.notes && state.notes.length > 0 && (
        <ul role="status" className={cn("space-y-1 rounded-md px-4 py-3 text-sm", state.ok ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-700")}>
          {state.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Mailboxes or Resend ────────────────────────────────────────────────────

export function TransportForm({ transport, canEdit }: { transport: Transport; canEdit: boolean }) {
  const [state, formAction] = useActionState<MailboxFormState, FormData>(saveTransport, null);
  const [value, setValue] = useState<Transport>(transport);
  const options = [
    { value: "smtp", title: "My mailboxes (Hostinger email)", detail: "Sent from your own addresses over SMTP. Replies and bounces are read from their inboxes." },
    { value: "resend", title: "Resend", detail: "Sent through Resend with RESEND_API_KEY. Replies and bounces need the Resend webhook." },
  ] as const;
  return (
    <form action={formAction} className="space-y-3">
      <fieldset disabled={!canEdit} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border p-4 text-sm transition",
              value === option.value ? "border-cyan-600 bg-cyan-50/50" : "border-slate-200 hover:border-slate-300"
            )}
          >
            <input type="radio" name="transport" value={option.value} checked={value === option.value} onChange={() => setValue(option.value)} className="mt-1" />
            <span>
              <span className="font-semibold text-slate-900">{option.title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{option.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {canEdit && value !== transport && (
        <SubmitButton variant="secondary" pendingText="Saving…">
          Use {value === "smtp" ? "my mailboxes" : "Resend"}
        </SubmitButton>
      )}
      <Outcome state={state} />
    </form>
  );
}

// ─── One mailbox: add or edit ───────────────────────────────────────────────

function MailboxEditor({ mailbox, onCancel }: { mailbox?: Mailbox; onCancel?: () => void }) {
  const [state, formAction, pending] = useActionState<MailboxFormState, FormData>(saveMailboxAction, null);
  const errors = state?.fieldErrors ?? {};
  const key = mailbox?.id ?? "new";
  const [watchInbox, setWatchInbox] = useState(mailbox?.watchInbox ?? true);

  // Submitted by hand rather than through `action`: React resets a form after
  // an action, which would wipe what was typed whenever a field is rejected.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-slate-200 bg-slate-50/60 p-4">
      {mailbox && <input type="hidden" name="id" value={mailbox.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mailbox address" htmlFor={`mb-user-${key}`} error={errors.user} hint="Also the login, and the address emails are sent from.">
          <input id={`mb-user-${key}`} name="user" type="email" autoComplete="off" defaultValue={mailbox?.user ?? ""} placeholder="outreach2@bitsolmarketing.com" className={inputClass} required />
        </Field>
        <Field
          label="Password"
          htmlFor={`mb-pass-${key}`}
          error={errors.password}
          hint={mailbox?.hasPassword ? "A password is saved. Leave empty to keep it." : "Stored encrypted; never shown again."}
        >
          <input
            id={`mb-pass-${key}`}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder={mailbox?.hasPassword ? "••••••••  (saved)" : ""}
            className={inputClass}
            required={!mailbox}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
        <Field label="Sender name" htmlFor={`mb-name-${key}`} error={errors.fromName} hint="Optional. Empty uses the sender name under Sender.">
          <input id={`mb-name-${key}`} name="fromName" defaultValue={mailbox?.fromName ?? ""} placeholder="Sara from BITSOL Marketing" className={inputClass} />
        </Field>
        <Field label="Emails per day" htmlFor={`mb-limit-${key}`} hint="This mailbox, any 24 hours.">
          <input id={`mb-limit-${key}`} name="dailyLimit" type="number" min={1} max={1000} defaultValue={mailbox?.dailyLimit ?? 100} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" name="enabled" defaultChecked={mailbox?.enabled ?? true} />
          <span className="font-semibold text-slate-900">Send from this mailbox</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" name="watchInbox" checked={watchInbox} onChange={(e) => setWatchInbox(e.target.checked)} />
          <span className="font-semibold text-slate-900">Watch its inbox for replies and bounces</span>
        </label>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-slate-600">Server settings (Hostinger by default)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)_110px]">
          <Field label="SMTP server" htmlFor={`mb-smtp-${key}`} error={errors.smtpHost}>
            <input id={`mb-smtp-${key}`} name="smtpHost" defaultValue={mailbox?.smtpHost ?? "smtp.hostinger.com"} className={inputClass} />
          </Field>
          <Field label="Port" htmlFor={`mb-smtpport-${key}`}>
            <input id={`mb-smtpport-${key}`} name="smtpPort" type="number" min={1} max={65535} defaultValue={mailbox?.smtpPort ?? 465} className={inputClass} />
          </Field>
          <Field label="IMAP server" htmlFor={`mb-imap-${key}`} error={errors.imapHost}>
            <input id={`mb-imap-${key}`} name="imapHost" defaultValue={mailbox?.imapHost ?? "imap.hostinger.com"} className={inputClass} disabled={!watchInbox} />
          </Field>
          <Field label="Port" htmlFor={`mb-imapport-${key}`}>
            <input id={`mb-imapport-${key}`} name="imapPort" type="number" min={1} max={65535} defaultValue={mailbox?.imapPort ?? 993} className={inputClass} disabled={!watchInbox} />
          </Field>
        </div>
      </details>
      <Outcome state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving and testing…
            </>
          ) : mailbox ? (
            "Save and test"
          ) : (
            "Add and test"
          )}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className={btn.ghost}>
            Close
          </button>
        )}
      </div>
    </form>
  );
}

// ─── Test one mailbox ───────────────────────────────────────────────────────

function MailboxTools({ id }: { id: string }) {
  const [testState, testAction] = useActionState<MailboxFormState, FormData>(testMailboxConnection, null);
  const [sendState, sendAction] = useActionState<MailboxFormState, FormData>(sendMailboxTestEmail, null);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <form action={testAction}>
          <input type="hidden" name="id" value={id} />
          <SubmitButton variant="secondary" pendingText="Testing…">
            <PlugZap className="h-4 w-4" /> Test connection
          </SubmitButton>
        </form>
        <form action={sendAction} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
          <input type="hidden" name="id" value={id} />
          <Field label="Send a test email to" htmlFor={`mb-to-${id}`} error={sendState?.fieldErrors?.to} className="min-w-0 flex-1">
            <input id={`mb-to-${id}`} name="to" type="email" placeholder="you@gmail.com" className={inputClass} required />
          </Field>
          <SubmitButton variant="secondary" pendingText="Sending…">
            <Send className="h-4 w-4" /> Send test
          </SubmitButton>
        </form>
      </div>
      <Outcome state={testState} />
      <Outcome state={sendState} />
    </div>
  );
}

// ─── The list ───────────────────────────────────────────────────────────────

export function MailboxManager({
  mailboxes,
  sentByMailbox,
  canEdit,
}: {
  mailboxes: Mailbox[];
  sentByMailbox: Record<string, number>;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState<string | null>(mailboxes.length === 0 ? "new" : null);
  const [inboxState, inboxAction] = useActionState<MailboxFormState>(checkInboxNowAction, null);
  const sending = mailboxes.filter((m) => m.enabled && m.hasPassword);
  const capacity = sending.reduce((n, m) => n + m.dailyLimit, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {sending.length} of {mailboxes.length} mailbox{mailboxes.length === 1 ? "" : "es"} sending, up to{" "}
        <span className="font-semibold text-slate-900">{capacity.toLocaleString("en-GB")} emails a day</span> together (also capped by &ldquo;Emails per
        day&rdquo; under Sender). New leads go to the least-used mailbox; each lead&apos;s follow-ups come from the mailbox that emailed it first.
      </p>

      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {mailboxes.map((m) => {
          const sent = sentByMailbox[m.user] ?? 0;
          return (
            <li key={m.id} className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{m.user}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span className={m.enabled && m.hasPassword ? "text-emerald-700" : "text-amber-700"}>
                      {!m.hasPassword ? "No password" : m.enabled ? "Sending" : "Turned off"}
                    </span>
                    {" · "}
                    {sent} of {m.dailyLimit} sent in the last 24 hours
                    {" · "}
                    {m.watchInbox ? "inbox watched" : "inbox not watched"}
                    {m.fromName ? ` · as “${m.fromName}”` : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setOpen(open === m.id ? null : m.id)} className={btn.ghost}>
                      <Pencil className="h-4 w-4" /> {open === m.id ? "Close" : "Edit and test"}
                    </button>
                    <form action={removeMailboxAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <ConfirmButton variant="ghost" message={`Remove ${m.user}? Leads it emailed move to another mailbox for their next email.`}>
                        Remove
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </div>
              {open === m.id && canEdit && (
                <div className="space-y-4">
                  <MailboxEditor mailbox={m} onCancel={() => setOpen(null)} />
                  {m.hasPassword && <MailboxTools id={m.id} />}
                </div>
              )}
            </li>
          );
        })}
        {mailboxes.length === 0 && <li className="p-4 text-sm text-slate-500">No mailbox connected yet.</li>}
      </ul>

      {canEdit &&
        (open === "new" ? (
          <MailboxEditor onCancel={mailboxes.length ? () => setOpen(null) : undefined} />
        ) : (
          <button type="button" onClick={() => setOpen("new")} className={btn.secondary}>
            <Plus className="h-4 w-4" /> Add a mailbox
          </button>
        ))}

      {canEdit && mailboxes.some((m) => m.watchInbox) && (
        <form action={inboxAction} className="space-y-3 border-t border-slate-100 pt-4">
          <SubmitButton variant="secondary" pendingText="Reading the inboxes…">
            <Inbox className="h-4 w-4" /> Check inboxes now
          </SubmitButton>
          <Outcome state={inboxState} />
        </form>
      )}
    </div>
  );
}
