"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Play, Sparkles } from "lucide-react";
import { addSuppression, createTask, moveUnsentToDripAction, runQueueNow, saveSenderSettings, startLeadAutomation, type MailboxFormState } from "@/app/admin/actions-automation";
import { draftLeadPersonalization, savePersonalization } from "@/app/admin/actions-leads";
import type { FormState } from "@/app/admin/actions";
import type { OutreachSettings } from "@/lib/automation/settings";
import type { DripStatus } from "@/lib/automation/drip";
import { EMAIL_DESIGNS, EMAIL_DESIGN_LABELS } from "@/lib/automation/email/render";
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

export function SenderSettingsForm({
  settings,
  canEdit,
  automations = [],
  drip = null,
}: {
  settings: OutreachSettings;
  canEdit: boolean;
  automations?: { id: string; name: string; status: string }[];
  drip?: DripStatus | null;
}) {
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
          <Field label="Sender address" htmlFor="from-email" error={errors.fromEmail} hint="Sending from your mailbox: that mailbox's address. With Resend: on a domain verified there.">
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
          <Field label="Emails per day, all mailboxes together" htmlFor="daily-limit" hint="An overall cap, any 24 hours. Each mailbox also has its own limit under Sending mailboxes; Hostinger allows 1,000 per mailbox. Raise new mailboxes over 2–3 weeks.">
            <input id="daily-limit" name="dailyLimit" type="number" min={1} max={2000} defaultValue={settings.dailyLimit} className={inputClass} />
          </Field>
          <Field label="Emails per minute, at most" htmlFor="batch-limit" hint="The scheduler runs once a minute; this spaces the sends out. 1 spreads 100 emails over about two hours.">
            <input id="batch-limit" name="batchLimit" type="number" min={1} max={100} defaultValue={settings.batchLimit} className={inputClass} />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Send from (Pakistan time)" htmlFor="window-start" hint="Nothing is sent outside these hours; waiting emails go out when they open.">
              <select id="window-start" name="sendWindowStart" defaultValue={settings.sendWindowStart} className={selectClass}>
                {Array.from({ length: 25 }, (_, h) => h).slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Until (Pakistan time)" htmlFor="window-end" error={errors.sendWindowEnd}>
              <select id="window-end" name="sendWindowEnd" defaultValue={settings.sendWindowEnd} className={selectClass}>
                {Array.from({ length: 25 }, (_, h) => h).slice(1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="spreadEvenly" defaultChecked={settings.spreadEvenly} className="mt-1" />
            <span>
              <span className="font-semibold text-slate-900">Spread each mailbox&apos;s emails evenly over these hours</span>
              <span className="block text-xs leading-relaxed text-slate-500">
                100 a day between 10:00 and 22:00 is one email every 7 minutes from that mailbox, rather than a burst at the start of the day.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Email design</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {EMAIL_DESIGNS.map((design) => (
              <label
                key={design}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 text-sm has-checked:border-cyan-600 has-checked:bg-cyan-50/50"
              >
                <input type="radio" name="emailDesign" value={design} defaultChecked={settings.emailDesign === design} className="mt-1" />
                <span>
                  <span className="font-semibold text-slate-900">{EMAIL_DESIGN_LABELS[design].label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{EMAIL_DESIGN_LABELS[design].hint}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input type="checkbox" name="showServices" defaultChecked={settings.showServices} className="mt-1" />
            <span>
              <span className="font-semibold text-slate-900">Show our services in every email</span>
              <span className="block text-xs leading-relaxed text-slate-500">
                Web development, mobile app development, digital marketing and AI chatbots, each linked to its page on the website. Preview it under
                Templates.
              </span>
            </span>
          </label>
        </div>

        <div className="space-y-4 rounded-md border border-slate-200 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Daily drip: work through an imported list</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Import a big list without starting it, and the drip starts a few prospects a day (oldest import first). Each prospect gets up to four
              emails, so follow-ups always go first: new prospects only start while today&apos;s email limit has room. With 100 emails a day, about 25 new
              prospects a day keeps every follow-up on time.
            </p>
            {drip && (
              <p className="mt-2 text-xs font-medium text-slate-700">
                {drip.enabled
                  ? `On: ${drip.startedLastDay} of ${drip.perDay} started in the last 24 hours, ${drip.waiting.toLocaleString("en-GB")} prospects waiting${drip.automationActive ? "" : ` — “${drip.automationName ?? "the automation"}” is not active, so nobody is started`}.`
                  : `Off. ${drip.waiting.toLocaleString("en-GB")} imported prospects are waiting to be started.`}
              </p>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New prospects per day, at most" htmlFor="drip-per-day" error={errors.dripPerDay} hint="0 turns the drip off.">
              <input id="drip-per-day" name="dripPerDay" type="number" min={0} max={1000} defaultValue={settings.dripPerDay} className={inputClass} />
            </Field>
            <Field label="Start them in" htmlFor="drip-automation" error={errors.dripAutomationId} hint="The automation must be active.">
              <select id="drip-automation" name="dripAutomationId" defaultValue={settings.dripAutomationId} className={selectClass}>
                <option value="">Choose an automation</option>
                {automations.map((automation) => (
                  <option key={automation.id} value={automation.id}>
                    {automation.name}
                    {automation.status === "ACTIVE" ? "" : ` (${automation.status.toLowerCase()})`}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="space-y-4 rounded-md border border-slate-200 p-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Answer replies with AI</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              The inboxes are read every 2 minutes while this is on. The AI reads each reply: automatic messages (&ldquo;we received your email&rdquo;, out
              of office) get no answer and the sequence carries on; &ldquo;please stop&rdquo; unsubscribes the address; a person&apos;s question or interest
              gets an answer from the mailbox they wrote to, in the same thread, using the chatbot&apos;s knowledge base. Every reply still stops the
              sequence and creates a sales task, and the timeline shows what was sent.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Answering" htmlFor="auto-reply-mode">
              <select id="auto-reply-mode" name="autoReplyMode" defaultValue={settings.autoReplyMode} className={selectClass}>
                <option value="off">Off: a person answers</option>
                <option value="draft">Suggest an answer on the timeline</option>
                <option value="auto">Send the answer automatically</option>
              </select>
            </Field>
            <Field label="Answer after (minutes)" htmlFor="auto-reply-delay" hint="After the reply is read.">
              <input id="auto-reply-delay" name="autoReplyDelay" type="number" min={0} max={60} defaultValue={settings.autoReplyDelay} className={inputClass} />
            </Field>
            <Field label="AI answers per lead, at most" htmlFor="auto-reply-max" hint="Then a person takes over.">
              <input id="auto-reply-max" name="autoReplyMax" type="number" min={1} max={10} defaultValue={settings.autoReplyMax} className={inputClass} />
            </Field>
          </div>
          <Field
            label="Instructions for the AI"
            htmlFor="auto-reply-notes"
            hint="Offers, starting prices it may quote, what to avoid. Without a price here it never quotes one and suggests a call instead."
          >
            <textarea
              id="auto-reply-notes"
              name="autoReplyNotes"
              rows={4}
              maxLength={3000}
              defaultValue={settings.autoReplyNotes}
              placeholder="e.g. Offer a free website audit. Mention that we reply on WhatsApp within the hour. Never promise delivery dates."
              className={inputClass}
            />
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

// ─── Move started-but-unsent prospects to the drip ──────────────────────────

/** Outside the sender form: forms cannot be nested. */
export function MoveToDripForm({ unsent }: { unsent: number }) {
  const [state, formAction] = useActionState<MailboxFormState>(moveUnsentToDripAction, null);
  if (unsent === 0 && !state) return null;
  return (
    <form action={formAction} className="space-y-3 rounded-md border border-amber-200 bg-amber-50/60 p-4">
      {unsent > 0 && (
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">{unsent.toLocaleString("en-GB")} prospects</span> were started all at once (for example on
          import) and have not been emailed yet. Hand them to the daily drip so they start gradually and follow-ups keep priority. Nothing is sent
          or lost; their place in the list is kept.
        </p>
      )}
      {unsent > 0 && (
        <SubmitButton variant="secondary" pendingText="Moving…">
          Move them to the daily drip
        </SubmitButton>
      )}
      {state && (
        <p role="status" className={cn("text-sm font-semibold", state.ok ? "text-emerald-700" : "text-red-700")}>
          {state.ok ? state.notes?.[0] : state.error}
        </p>
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
