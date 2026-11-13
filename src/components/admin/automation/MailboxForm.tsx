"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { Inbox, Loader2, PlugZap, Send } from "lucide-react";
import {
  checkInboxNowAction,
  saveMailboxSettings,
  sendMailboxTestEmail,
  testMailboxConnection,
  type MailboxFormState,
} from "@/app/admin/actions-automation";
import type { MailboxConfig } from "@/lib/automation/email/mailbox";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

/**
 * Lead Automation → Settings → Sending mailbox: send outreach from a real
 * mailbox (Hostinger Business email) over SMTP, and read its inbox over IMAP
 * for replies and bounces. Or keep Resend.
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

export function MailboxSettingsForm({ config, canEdit, fromEmail }: { config: MailboxConfig; canEdit: boolean; fromEmail: string }) {
  const [state, formAction, pending] = useActionState<MailboxFormState, FormData>(saveMailboxSettings, null);
  const [transport, setTransport] = useState(config.transport);
  const [watchInbox, setWatchInbox] = useState(config.watchInbox);
  const errors = state?.fieldErrors ?? {};
  const viaMailbox = transport === "smtp";

  // Submitted by hand rather than through `action`: React resets a form after
  // an action, which would wipe what was typed whenever a field is rejected.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "smtp", title: "My mailbox (Hostinger email)", detail: "Sent from your own address over SMTP. Business Starter allows 1,000 a day per mailbox. Replies and bounces are read from its inbox." },
              { value: "resend", title: "Resend", detail: "Sent through Resend with RESEND_API_KEY. Replies and bounces need the Resend webhook." },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-4 text-sm transition",
                transport === option.value ? "border-cyan-600 bg-cyan-50/50" : "border-slate-200 hover:border-slate-300"
              )}
            >
              <input type="radio" name="transport" value={option.value} checked={transport === option.value} onChange={() => setTransport(option.value)} className="mt-1" />
              <span>
                <span className="font-semibold text-slate-900">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{option.detail}</span>
              </span>
            </label>
          ))}
        </div>

        {viaMailbox && (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Mailbox address" htmlFor="mailbox-user" error={errors.user} hint="Also the login. Outreach is sent as this address.">
                <input id="mailbox-user" name="user" type="email" autoComplete="off" defaultValue={config.user || fromEmail} placeholder="hello@bitsolmarketing.com" className={inputClass} required />
              </Field>
              <Field
                label="Mailbox password"
                htmlFor="mailbox-password"
                error={errors.password}
                hint={config.hasPassword ? "A password is saved. Leave empty to keep it." : "Stored encrypted; never shown again."}
              >
                <input
                  id="mailbox-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={config.hasPassword ? "••••••••  (saved)" : ""}
                  className={inputClass}
                  required={!config.hasPassword}
                />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
              <Field label="SMTP server" htmlFor="smtp-host" error={errors.smtpHost} hint="Hostinger: smtp.hostinger.com, port 465 (SSL).">
                <input id="smtp-host" name="smtpHost" defaultValue={config.smtpHost} className={inputClass} />
              </Field>
              <Field label="Port" htmlFor="smtp-port">
                <input id="smtp-port" name="smtpPort" type="number" min={1} max={65535} defaultValue={config.smtpPort} className={inputClass} />
              </Field>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" name="watchInbox" checked={watchInbox} onChange={(e) => setWatchInbox(e.target.checked)} className="mt-1" />
              <span>
                <span className="font-semibold text-slate-900">Watch the inbox for replies and bounces</span>
                <span className="block text-xs leading-relaxed text-slate-500">
                  Every 5 minutes the inbox is read (nothing is marked read, moved or deleted). A lead who replies is taken out of the sequence before the next
                  follow-up; an address that bounces is never emailed again. Out-of-office replies are ignored.
                </span>
              </span>
            </label>
            {watchInbox && (
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_120px]">
                <Field label="IMAP server" htmlFor="imap-host" error={errors.imapHost} hint="Hostinger: imap.hostinger.com, port 993 (SSL).">
                  <input id="imap-host" name="imapHost" defaultValue={config.imapHost} className={inputClass} />
                </Field>
                <Field label="Port" htmlFor="imap-port">
                  <input id="imap-port" name="imapPort" type="number" min={1} max={65535} defaultValue={config.imapPort} className={inputClass} />
                </Field>
              </div>
            )}
          </>
        )}
      </fieldset>

      <Outcome state={state} />
      {canEdit ? (
        <button type="submit" disabled={pending} className={btn.primary}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> {viaMailbox ? "Saving and testing…" : "Saving…"}
            </>
          ) : viaMailbox ? (
            "Save and test"
          ) : (
            "Save"
          )}
        </button>
      ) : (
        <p className="text-sm text-slate-500">Only an admin can change the sending mailbox.</p>
      )}
    </form>
  );
}

/** Test connection, send a test email, read the inbox now. Shown once the mailbox is the sender. */
export function MailboxTools() {
  const [testState, testAction] = useActionState<MailboxFormState>(testMailboxConnection, null);
  const [sendState, sendAction] = useActionState<MailboxFormState, FormData>(sendMailboxTestEmail, null);
  const [inboxState, inboxAction] = useActionState<MailboxFormState>(checkInboxNowAction, null);

  return (
    <div className="space-y-5 border-t border-slate-100 pt-5">
      <div className="flex flex-wrap gap-3">
        <form action={testAction}>
          <SubmitButton variant="secondary" pendingText="Testing…">
            <PlugZap className="h-4 w-4" /> Test connection
          </SubmitButton>
        </form>
        <form action={inboxAction}>
          <SubmitButton variant="secondary" pendingText="Reading the inbox…">
            <Inbox className="h-4 w-4" /> Check inbox now
          </SubmitButton>
        </form>
      </div>
      <Outcome state={testState} />
      <Outcome state={inboxState} />

      <form action={sendAction} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Send a test email to" htmlFor="test-to" error={sendState?.fieldErrors?.to} className="min-w-0 flex-1" hint="Use an address outside your domain (a Gmail address) to see where it lands: inbox or spam.">
            <input id="test-to" name="to" type="email" placeholder="you@gmail.com" className={inputClass} required />
          </Field>
          <div className="sm:pb-6">
            <SubmitButton variant="secondary" pendingText="Sending…">
              <Send className="h-4 w-4" /> Send test
            </SubmitButton>
          </div>
        </div>
        <Outcome state={sendState} />
      </form>
    </div>
  );
}
