"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CheckCircle2, Link2, Loader2, MinusCircle, RefreshCw, Stethoscope, Trash2, Wand2, XCircle } from "lucide-react";
import {
  checkWhatsAppSetup,
  forgetWhatsAppDetails,
  generateWhatsAppVerifyToken,
  saveWhatsAppDetails,
  subscribeWhatsAppWebhooks,
  type ChecksResult,
  type WhatsAppFormState,
} from "@/app/admin/actions-whatsapp";
import type { CheckStatus, SetupCheck } from "@/lib/whatsapp/diagnostics";
import type { DetailKey, SettingSource } from "@/lib/whatsapp/fields";
import { cn } from "@/lib/utils";
import { Field, FormError, Pill, btn, inputClass } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { CopyButton } from "@/components/admin/automation/SmallForms";

/**
 * Admin → Chatbot → Setup → Connect WhatsApp. Saved secrets never come back
 * to the browser: the page sends only where each value comes from and the
 * last four characters of a secret.
 */

export interface WhatsAppFieldView {
  key: DetailKey;
  label: string;
  hint: string;
  secret: boolean;
  numeric: boolean;
  source: SettingSource;
  /** The value of a field that is not secret. */
  current: string;
  /** The last four characters of a saved secret. */
  ending: string;
}

const SOURCE: Record<SettingSource, { label: string; tone: "green" | "cyan" | "amber" }> = {
  panel: { label: "Saved here", tone: "green" },
  environment: { label: "Server variable", tone: "cyan" },
  none: { label: "Missing", tone: "amber" },
};

function SourcePill({ source }: { source: SettingSource }) {
  return <Pill tone={SOURCE[source].tone}>{SOURCE[source].label}</Pill>;
}

// ─── WhatsApp details ───────────────────────────────────────────────────────

function DetailInput({ field }: { field: WhatsAppFieldView }) {
  const id = `wa-${field.key}`;
  const savedSecret = field.secret && field.source !== "none";
  const savedLine = savedSecret
    ? `${field.source === "panel" ? "Saved here" : "Set as a server variable"}, ending in ${field.ending}. Leave this empty to keep it.`
    : null;

  return (
    <Field
      htmlFor={id}
      className={field.key === "WHATSAPP_TOKEN" ? "sm:col-span-2" : undefined}
      label={
        <span className="flex items-center justify-between gap-2">
          {field.label}
          <SourcePill source={field.source} />
        </span>
      }
      hint={
        <>
          {savedLine && <span className="mb-0.5 block font-semibold text-slate-700">{savedLine}</span>}
          {field.hint}
        </>
      }
    >
      <input
        id={id}
        name={field.key}
        type={field.secret ? "password" : "text"}
        inputMode={field.numeric ? "numeric" : undefined}
        defaultValue={field.secret ? "" : field.current}
        placeholder={savedSecret ? `•••• ${field.ending}` : field.numeric ? "Digits only" : ""}
        autoComplete="off"
        spellCheck={false}
        className={cn(inputClass, "font-mono")}
      />
    </Field>
  );
}

function ForgetDetails() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message?: string; error?: string } | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
      <button
        type="button"
        disabled={pending}
        className={cn(btn.ghost, "text-red-600 hover:bg-red-50 hover:text-red-700")}
        onClick={() => {
          if (!window.confirm("Remove every WhatsApp detail saved on this page, the verify token included? Server environment variables still apply.")) return;
          startTransition(async () => setResult(await forgetWhatsAppDetails()));
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Remove the details saved here
      </button>
      {result && <p className={cn("text-sm", result.ok ? "text-emerald-700" : "text-red-600")}>{result.ok ? result.message : result.error}</p>}
    </div>
  );
}

export function WhatsAppDetailsForm({
  fields,
  autoReply,
  savedHere,
}: {
  fields: WhatsAppFieldView[];
  autoReply: boolean;
  /** Something is saved on this page, so there is something to remove. */
  savedHere: boolean;
}) {
  const [state, formAction] = useActionState<WhatsAppFormState, FormData>(saveWhatsAppDetails, null);
  // The inputs are uncontrolled: when the saved details change (a save, or
  // Remove below), a new key rebuilds the form from them, so a stale value
  // left in an input cannot be saved again by accident.
  const saved = `${fields.map((field) => `${field.source}:${field.current}:${field.ending}`).join("|")}|${autoReply}`;

  return (
    <div className="space-y-4">
      <form key={saved} action={formAction} className="space-y-5" autoComplete="off">
        <FormError message={state?.error} />
        <div className="grid gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <DetailInput key={field.key} field={field} />
          ))}
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="checkbox" name="WHATSAPP_AUTO_REPLY" defaultChecked={autoReply} className="mt-0.5 h-4 w-4 accent-cyan-600" />
          <span className="text-sm">
            <span className="font-semibold text-slate-900">The assistant replies on WhatsApp</span>
            <span className="mt-0.5 block text-xs text-slate-500">When this is off, messages are recorded in Conversations and wait for a person.</span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="Saving and asking Meta…">Save and check</SubmitButton>
          {state?.ok && state.message && (
            <p role="status" className="text-sm text-emerald-700">
              {state.message}
            </p>
          )}
        </div>
        {state?.ok && state.warning && (
          <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {state.warning}
          </p>
        )}
      </form>
      {savedHere && <ForgetDetails />}
    </div>
  );
}

// ─── Callback URL and verify token ──────────────────────────────────────────

function CopyRow({ label, value, aside }: { label: string; value: string; aside?: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
        {aside}
      </div>
      <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-900">{value}</code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

export function WebhookValues({
  webhookUrl,
  verifyToken,
  verifyTokenSource,
}: {
  webhookUrl: string;
  verifyToken: string;
  verifyTokenSource: SettingSource;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function generate() {
    if (
      verifyToken &&
      !window.confirm("Replace the verify token? Messages keep arriving. Give Meta the new token the next time you press Verify and save.")
    ) {
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await generateWhatsAppVerifyToken();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="space-y-5">
      <CopyRow label="Callback URL" value={webhookUrl} />

      {verifyToken ? (
        <CopyRow label="Verify token" value={verifyToken} aside={<SourcePill source={verifyTokenSource} />} />
      ) : (
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Verify token</p>
            <SourcePill source="none" />
          </div>
          <p className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            There is no verify token yet. Generate one, then give it to Meta with the callback URL.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={generate} disabled={pending} className={verifyToken ? btn.secondary : btn.primary}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {verifyToken ? "Replace the verify token" : "Generate a verify token"}
        </button>
      </div>
      <FormError message={error} />

      <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-slate-500">
        <li>Meta calls the live site, so copy both values from the live site&apos;s Setup page.</li>
        <li>In Meta for Developers, open the app, then WhatsApp → Configuration → Webhook → Edit.</li>
        <li>Paste the callback URL and the verify token, then press Verify and save.</li>
        <li>Under Webhook fields, subscribe to messages.</li>
      </ol>
      <p className="flex items-start gap-2 text-xs text-slate-500">
        <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Meta uses the verify token only while it verifies, so replacing it later does not stop messages.
      </p>
    </div>
  );
}

// ─── Checks ─────────────────────────────────────────────────────────────────

const STATUS: Record<CheckStatus, { icon: LucideIcon; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-emerald-600", label: "Passed" },
  warn: { icon: AlertTriangle, className: "text-amber-600", label: "Needs attention" },
  fail: { icon: XCircle, className: "text-red-600", label: "Failed" },
  skip: { icon: MinusCircle, className: "text-slate-400", label: "Not checked" },
};

function CheckRow({ check, onSubscribe, subscribing }: { check: SetupCheck; onSubscribe: () => void; subscribing: boolean }) {
  const status = STATUS[check.status];
  const Icon = status.icon;
  return (
    <li className="flex items-start gap-3 px-4 py-3" data-check={check.id} data-status={check.status}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", status.className)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900">
          {check.label}
          <span className="sr-only">: {status.label}</span>
        </p>
        <p className="mt-0.5 break-words text-xs leading-relaxed text-slate-600">{check.detail}</p>
        {check.fix && check.status !== "ok" && (
          <p className="mt-1 break-words text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-700">What to do:</span> {check.fix}
          </p>
        )}
        {check.canSubscribe && (
          <button type="button" onClick={onSubscribe} disabled={subscribing} className={cn(btn.secondary, "mt-2 px-3 py-1.5 text-xs")}>
            {subscribing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Subscribe this app
          </button>
        )}
      </div>
    </li>
  );
}

export function WhatsAppChecks() {
  const [result, setResult] = useState<ChecksResult | null>(null);
  const [running, startRun] = useTransition();
  const [subscribing, startSubscribe] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; message: string } | null>(null);

  const run = () =>
    startRun(async () => {
      setNote(null);
      setResult(await checkWhatsAppSetup());
    });

  const subscribe = () =>
    startSubscribe(async () => {
      const outcome = await subscribeWhatsAppWebhooks();
      setNote(outcome);
      if (outcome.ok) setResult(await checkWhatsAppSetup());
    });

  const checks = result?.ok ? result.checks : [];
  const passed = checks.filter((check) => check.status === "ok").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={running} className={btn.primary}>
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : result ? <RefreshCw className="h-4 w-4" /> : <Stethoscope className="h-4 w-4" />}
          {running ? "Checking…" : result ? "Run the checks again" : "Run the checks"}
        </button>
        {result?.ok && (
          <p className="text-sm text-slate-500" role="status">
            {passed} of {checks.length} passed · {new Date(result.ranAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>
      {result && !result.ok && <FormError message={result.error} />}
      {note && (
        <p role="status" className={cn("rounded-xl border px-4 py-3 text-sm", note.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-600")}>
          {note.message}
        </p>
      )}
      {checks.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} onSubscribe={subscribe} subscribing={subscribing} />
          ))}
        </ul>
      )}
    </div>
  );
}
