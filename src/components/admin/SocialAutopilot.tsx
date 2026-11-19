"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, Eye, Loader2, Rocket, XCircle } from "lucide-react";
import {
  postAutopostNow,
  previewAutopost,
  saveAutopilot,
  type AutopilotPreview,
  type AutopilotRunResult,
  type AutopilotSaveState,
} from "@/app/admin/actions-social";
import { AUTOPILOT_SOURCES, INTERVAL_CHOICES, SOURCE_LABEL, type AutopilotSettings } from "@/lib/admin/social/autopilot-plan";
import { cn } from "@/lib/utils";
import { FormError, KeyValue, btn, selectClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

const checkboxClass = "h-4 w-4 accent-cyan-600";

export function SocialAutopilot({
  settings,
  nextRun,
  lastResult,
  accountCount,
  aiReady,
}: {
  settings: AutopilotSettings;
  /** Already formatted for Pakistan time; null when nothing is scheduled. */
  nextRun: string | null;
  lastResult: { at: string; ok: boolean; message: string } | null;
  accountCount: number;
  aiReady: boolean;
}) {
  const [saved, formAction] = useActionState<AutopilotSaveState, FormData>(saveAutopilot, null);
  const [previewing, startPreview] = useTransition();
  const [posting, startPosting] = useTransition();
  const [preview, setPreview] = useState<AutopilotPreview | null>(null);
  const [run, setRun] = useState<AutopilotRunResult | null>(null);

  function makePreview() {
    setPreview(null);
    startPreview(async () => setPreview(await previewAutopost()));
  }

  function postNow() {
    if (!window.confirm(`Write and publish one post to ${accountCount === 1 ? "the connected account" : `all ${accountCount} connected accounts`} now? It goes public straight away.`)) return;
    setRun(null);
    startPosting(async () => setRun(await postAutopostNow()));
  }

  return (
    <div className="space-y-6">
      <KeyValue
        items={[
          {
            label: "Status",
            value: settings.enabled ? (
              <span className="font-semibold text-emerald-700">On: every {settings.intervalHours} h, day and night</span>
            ) : (
              <span className="text-slate-600">Off</span>
            ),
          },
          { label: "Next post", value: settings.enabled && nextRun ? nextRun : "—" },
          {
            label: "Last post",
            value: lastResult ? (
              <span className={cn("block", lastResult.ok ? "text-slate-700" : "text-red-600")}>
                <span className="font-semibold">{lastResult.at}</span> · {lastResult.message}
              </span>
            ) : (
              "None yet"
            ),
          },
        ]}
      />

      {accountCount === 0 && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No account is connected yet. Until LinkedIn or Facebook is connected above, the autopilot skips its turns and posts nothing.
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <FormError message={saved?.error} />
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className={checkboxClass} />
          Post automatically, with no review before publishing
        </label>

        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Every</span>
            <select name="intervalHours" defaultValue={settings.intervalHours} className={selectClass}>
              {INTERVAL_CHOICES.map((hours) => (
                <option key={hours} value={hours}>
                  {hours} hour{hours === 1 ? "" : "s"} ({Math.round(24 / hours)} a day)
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Subjects, taken in turn</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1.5">
              {AUTOPILOT_SOURCES.map((source) => (
                <label key={source} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="sources" value={source} defaultChecked={settings.sources.includes(source)} className={checkboxClass} />
                  {SOURCE_LABEL[source]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="withImage" defaultChecked={settings.withImage} className={checkboxClass} />
          Add an AI image to every post (Cloudflare FLUX)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pendingText="Saving…">Save</SubmitButton>
          {saved?.ok && <p className="text-sm text-emerald-700">{saved.message}</p>}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={makePreview} disabled={!aiReady || previewing || posting} className={btn.secondary}>
          {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
          {previewing ? "Writing a sample…" : "Preview a post"}
        </button>
        <button type="button" onClick={postNow} disabled={!aiReady || accountCount === 0 || posting || previewing} className={btn.secondary}>
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {posting ? "Writing and publishing…" : "Post one now"}
        </button>
        <p className="text-xs text-slate-500">A preview publishes nothing. Every published post is listed under Recent posts.</p>
      </div>

      {run && (
        <p
          className={cn(
            "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
            run.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {run.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          {run.message}
        </p>
      )}

      {preview && !preview.ok && <FormError message={preview.error} />}
      {preview?.ok && (
        <div className="grid gap-5 rounded-xl border border-slate-200 p-4 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">{preview.label}</p>
            <p className="whitespace-pre-line text-[0.9375rem] leading-relaxed text-slate-800">{preview.text}</p>
            {preview.link && <p className="mt-3 break-all text-sm text-cyan-700">{preview.link}</p>}
            <p className="mt-3 text-xs text-slate-500">
              Written by {preview.writer}. Sample only: the real post is written fresh when it goes out.
              {preview.imageNote ? ` Image: ${preview.imageNote}.` : ""}
            </p>
          </div>
          {preview.image && (
            <Image
              src={preview.image}
              alt="Sample image for the post"
              width={1080}
              height={1080}
              unoptimized
              className="h-auto w-full rounded-lg border border-slate-200"
            />
          )}
        </div>
      )}
    </div>
  );
}
