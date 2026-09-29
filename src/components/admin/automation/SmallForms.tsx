"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Play, Sparkles } from "lucide-react";
import { addSuppression, createTask, runQueueNow, saveSenderSettings, startLeadAutomation } from "@/app/admin/actions-automation";
import { draftLeadPersonalization, savePersonalization } from "@/app/admin/actions-leads";
import type { FormState } from "@/app/admin/actions";
import type { OutreachSettings } from "@/lib/automation/settings";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass, selectClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";

/** The small interactive forms of the automation area and the lead profile. */

function Saved({ state, children }: { state: FormState; children: string }) {
  if (!state?.ok) return null;
  return (
    <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
      <Check className="h-4 w-4" /> {children}
    </p>
  );
}

// ─── Sender settings ────────────────────────────────────────────────────────

export function SenderSettingsForm({ settings, canEdit }: { settings: OutreachSettings; canEdit: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveSenderSettings, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state?.ok ? undefined : state?.error} />
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Sender name" htmlFor="from-name" error={errors.fromName} hint="What the recipient sees as the sender.">
            <input id="from-name" name="fromName" defaultValue={settings.fromName} placeholder="Adnan from BITSOL Marketing" className={inputClass} required />
          </Field>
          <Field label="Sender address" htmlFor="from-email" error={errors.fromEmail} hint="On a domain that is verified with the email provider.">
            <input id="from-email" name="fromEmail" type="email" defaultValue={settings.fromEmail} placeholder="adnan@outreach.bitsolmarketing.com" className={inputClass} required />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Reply-to address" htmlFor="reply-to" error={errors.replyTo} hint="Where replies go. Empty: the sender address.">
            <input id="reply-to" name="replyTo" type="email" defaultValue={settings.replyTo} className={inputClass} />
          </Field>
          <Field label="Company name" htmlFor="company-name" hint="First line of the footer.">
            <input id="company-name" name="companyName" defaultValue={settings.companyName} className={inputClass} />
          </Field>
        </div>
        <Field
          label="Postal address"
          htmlFor="company-address"
          error={errors.companyAddress}
          hint="Shown in the footer of every outreach email. Anti-spam laws (CAN-SPAM and others) require a real postal address."
        >
          <input id="company-address" name="companyAddress" defaultValue={settings.companyAddress} className={inputClass} required />
        </Field>
        <Field label="Signature" htmlFor="signature" hint="Optional. Added under every email, above the footer. Plain text.">
          <textarea id="signature" name="signature" rows={3} defaultValue={settings.signature} placeholder={"Muhammad Adnan Bashir\nBITSOL Marketing · +92 310 3175175"} className={inputClass} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Emails per day, at most" htmlFor="daily-limit" hint="Across all automations, in any 24 hours. Start low on a new sending domain and raise it over weeks.">
            <input id="daily-limit" name="dailyLimit" type="number" min={1} max={2000} defaultValue={settings.dailyLimit} className={inputClass} />
          </Field>
          <Field label="Emails per minute, at most" htmlFor="batch-limit" hint="The scheduler runs once a minute; this spaces the sends out.">
            <input id="batch-limit" name="batchLimit" type="number" min={1} max={100} defaultValue={settings.batchLimit} className={inputClass} />
          </Field>
        </div>
      </fieldset>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
          <Saved state={state}>Saved</Saved>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Only an admin can change who outreach is sent as.</p>
      )}
    </form>
  );
}

// ─── Suppression list ───────────────────────────────────────────────────────

export function SuppressionForm() {
  const [state, formAction] = useActionState<FormState, FormData>(addSuppression, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="space-y-3">
      <FormError message={state?.ok ? undefined : state?.error} />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
        <Field label="Email or domain" htmlFor="suppress-value" error={state?.fieldErrors?.value} className="min-w-0 flex-1" hint="An address, or a whole domain as @example.com.">
          <input id="suppress-value" name="value" placeholder="person@company.com or @company.com" className={inputClass} required />
        </Field>
        <Field label="Note" htmlFor="suppress-note" className="min-w-0 flex-1">
          <input id="suppress-note" name="note" placeholder="Why (optional)" className={inputClass} />
        </Field>
        <div className="lg:pt-6">
          <SubmitButton variant="secondary" pendingText="Adding…">
            Never email this
          </SubmitButton>
        </div>
      </div>
      <Saved state={state}>Added to the suppression list</Saved>
    </form>
  );
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

export function TaskForm({ leadId, assignees, compact = false }: { leadId?: string; assignees: { id: string; name: string }[]; compact?: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(createTask, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={formAction} className="space-y-3">
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      <FormError message={state?.ok ? undefined : state?.error} />
      <Field label="Task" htmlFor={`task-title-${leadId ?? "new"}`} error={state?.fieldErrors?.title}>
        <input id={`task-title-${leadId ?? "new"}`} name="title" placeholder="Call about the proposal" className={inputClass} required />
      </Field>
      <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
        <Field label="Due" htmlFor={`task-due-${leadId ?? "new"}`} error={state?.fieldErrors?.dueAt}>
          <input id={`task-due-${leadId ?? "new"}`} name="dueAt" type="date" className={inputClass} />
        </Field>
        <Field label="For" htmlFor={`task-for-${leadId ?? "new"}`}>
          <select id={`task-for-${leadId ?? "new"}`} name="assignedToId" defaultValue="" className={selectClass}>
            <option value="">Nobody in particular</option>
            {assignees.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {!compact && (
        <Field label="Details" htmlFor={`task-notes-${leadId ?? "new"}`}>
          <textarea id={`task-notes-${leadId ?? "new"}`} name="description" rows={2} className={inputClass} />
        </Field>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary" pendingText="Adding…">
          Add task
        </SubmitButton>
        <Saved state={state}>Task added</Saved>
      </div>
    </form>
  );
}

// ─── Start an automation for one lead ───────────────────────────────────────

export function StartAutomationForm({
  leadId,
  automations,
  disabledReason,
}: {
  leadId: string;
  automations: { id: string; name: string; status: string }[];
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(startLeadAutomation, null);
  const active = automations.filter((a) => a.status === "ACTIVE");

  if (automations.length === 0) return <p className="text-sm text-slate-500">There are no automations yet.</p>;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <FormError message={state?.ok ? undefined : state?.error} />
      <select name="automationId" defaultValue={active[0]?.id ?? ""} className={selectClass} aria-label="Automation" disabled={active.length === 0}>
        {active.length === 0 && <option value="">No automation is active</option>}
        {active.map((automation) => (
          <option key={automation.id} value={automation.id}>
            {automation.name}
          </option>
        ))}
      </select>
      <SubmitButton pendingText="Starting…" className="w-full" disabled={active.length === 0 || Boolean(disabledReason)}>
        <Play className="h-4 w-4" /> Start automation
      </SubmitButton>
      {disabledReason && <p className="text-xs text-amber-700">{disabledReason}</p>}
      {active.length === 0 && <p className="text-xs text-slate-500">Activate an automation first. Drafts and paused automations cannot take leads.</p>}
      <Saved state={state}>Started. The first email goes out within a minute.</Saved>
    </form>
  );
}

// ─── Copy ───────────────────────────────────────────────────────────────────

export function CopyButton({ text, label = "Copy", className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Clipboard access denied: nothing to copy with, nothing to report.
        }
      }}
      className={cn(btn.ghost, "px-2 py-1 text-xs", className)}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

// ─── AI Personalize ─────────────────────────────────────────────────────────

/**
 * The personalised line of a lead: written by a person, or drafted by AI
 * from the CRM fields and then read, edited and saved by a person. Only what
 * is saved here reaches an email, through {{personalization}}.
 */
export function PersonalizationForm({
  leadId,
  initial,
  aiConfigured,
  hasFacts,
  canEdit,
}: {
  leadId: string;
  initial: string;
  aiConfigured: boolean;
  hasFacts: boolean;
  canEdit: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(savePersonalization, null);
  const [text, setText] = useState(initial);
  const [note, setNote] = useState<{ tone: "info" | "error"; message: string } | null>(null);
  const [drafting, startDraft] = useTransition();

  function draft() {
    setNote(null);
    startDraft(async () => {
      const result = await draftLeadPersonalization(leadId);
      if (result.ok) {
        setText(result.text);
        setNote({ tone: "info", message: `Draft by ${result.source}. It is not saved. Check every claim against the company description before you save it.` });
      } else {
        setNote({ tone: "error", message: result.error });
      }
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <FormError message={state?.ok ? undefined : state?.error} />
      <textarea
        name="personalization"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={1000}
        disabled={!canEdit}
        placeholder="One sentence that shows you looked at this company. Used where a template has {{personalization}}."
        className={inputClass}
        aria-label="Personalised line"
      />
      {note && (
        <p role="status" className={cn("rounded-xl border px-3 py-2 text-xs", note.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-violet-200 bg-violet-50 text-violet-800")}>
          {note.message}
        </p>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton variant="secondary" pendingText="Saving…">
            Save line
          </SubmitButton>
          <button
            type="button"
            onClick={draft}
            disabled={drafting || !aiConfigured || !hasFacts}
            className={btn.ghost}
            title={!aiConfigured ? "No AI key is set on the server" : !hasFacts ? "Add a company description first" : undefined}
          >
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-violet-600" />}
            AI Personalize
          </button>
          <Saved state={state}>Saved</Saved>
        </div>
      )}
      {canEdit && !aiConfigured && <p className="text-xs text-slate-500">AI Personalize needs GEMINI_API_KEY, GROQ_API_KEY or OPENROUTER_API_KEY on the server. Writing the line yourself always works.</p>}
      {canEdit && aiConfigured && !hasFacts && <p className="text-xs text-slate-500">AI Personalize writes from the company description; this lead has none.</p>}
    </form>
  );
}

// ─── Queue ──────────────────────────────────────────────────────────────────

export function RunQueueButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await runQueueNow();
          router.refresh();
        })
      }
      className={btn.secondary}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
      Run the queue now
    </button>
  );
}
