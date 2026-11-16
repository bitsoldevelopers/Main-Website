import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, FileText, Megaphone } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { listTemplates } from "@/lib/whatsapp/broadcast-queries";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { templatesReady } from "@/lib/whatsapp/templates";
import { Callout, DbUnavailable, EmptyState, PageHeader, Panel, Pill, StatCard, btn } from "@/components/admin/ui";
import { TemplateActions } from "@/components/admin/chatbot/TemplateActions";
import { TemplateToolbar } from "@/components/admin/chatbot/TemplateToolbar";
import { TemplateStatusPill } from "@/components/admin/chatbot/broadcast-ui";

export const metadata: Metadata = { title: "WhatsApp templates" };
export const dynamic = "force-dynamic";

/**
 * The WhatsApp Business Account's message templates, mirrored locally. Meta
 * owns this list: everything here is what a sync last read, which is why the
 * sync time is printed. A template shown as approved that Meta rejected an
 * hour ago would send nothing but errors.
 */
export default async function TemplatesPage() {
  await requireAdminPage("chatbot.manage");

  const [settings, result] = await Promise.all([getWhatsAppSettings({ fresh: true }), listTemplates()]);
  const ready = templatesReady(settings);
  const data = result.ok ? result.data : null;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="WhatsApp templates"
        description="Meta-approved message templates. Broadcasts and follow-ups send through these: a template Meta has not approved cannot reach anyone outside the 24-hour reply window."
        actions={
          <Link href="/admin/chatbot/broadcasts" className={btn.secondary}>
            <Megaphone className="h-4 w-4" /> Broadcasts
          </Link>
        }
      />

      {!result.ok && <DbUnavailable error={result.error} className="mb-6" />}

      {!ready && (
        <Callout tone="amber" icon={AlertTriangle} title="Meta's template list is not connected" className="mb-6">
          Templates are read from and written to the WhatsApp Business Account, which needs the account ID and a permanent access token carrying{" "}
          <span className="font-mono text-[0.875rem]">whatsapp_business_management</span>. Enter both under{" "}
          <Link href="/admin/chatbot/setup" className="font-medium text-cyan-700 hover:underline">
            Chatbot Setup → Connect WhatsApp
          </Link>
          . Until then nothing can be synced or submitted from here, and broadcasts have nothing approved to send.
        </Callout>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Templates" value={data?.templates.length ?? 0} icon={FileText} />
        <StatCard label="Approved" value={data?.approved ?? 0} hint="Ready to broadcast" icon={CheckCircle2} tone="green" />
        <StatCard label="Awaiting Meta" value={data?.pending ?? 0} hint="Under review" icon={Clock} tone="amber" />
      </div>

      <Panel
        title="Sync and submit"
        description={
          data?.lastSyncedAt
            ? `Last synced from Meta ${timeAgo(data.lastSyncedAt)} (${formatDate(data.lastSyncedAt, { time: true })}). Meta reviews a new template in anything from minutes to a day; sync again to learn the verdict.`
            : "Sync pulls in the templates the business account already has. Submit sends a new one to Meta for review."
        }
        className="mb-6"
      >
        <TemplateToolbar canSync={ready} />
      </Panel>

      {data && data.templates.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {data.templates.map((template) => (
            <Panel
              key={template.id}
              title={template.name}
              description={
                <span className="font-mono">
                  {template.metaName} · {template.languageCode}
                </span>
              }
              actions={<TemplateStatusPill status={template.status} />}
              bodyClassName="flex flex-col gap-4"
            >
              <div className="rounded-md bg-slate-50 p-4 text-[0.9375rem] leading-relaxed text-slate-700">
                {template.headerText && <p className="mb-2 font-medium text-slate-900">{template.headerText}</p>}
                {template.headerFormat && template.headerFormat !== "TEXT" && (
                  <p className="mb-2 rounded border border-dashed border-slate-300 px-3 py-1.5 text-[0.8125rem] text-slate-500">
                    {template.headerFormat.toLowerCase()} header. Meta keeps the format but not the file, so every broadcast on this template needs its own media URL.
                  </p>
                )}
                <p className="whitespace-pre-wrap">{template.body}</p>
                {template.footerText && <p className="mt-2 text-[0.8125rem] text-slate-500">{template.footerText}</p>}
              </div>

              {template.status === "REJECTED" && template.rejectedReason && (
                <p className="rounded-md bg-red-100 px-4 py-3 text-[0.8125rem] text-red-700">
                  Meta rejected this: {template.rejectedReason.replace(/_/g, " ").toLowerCase()}. A rejected template cannot be edited; submit a new one under a different
                  name.
                </p>
              )}
              {!template.metaId && (
                <p className="rounded-md bg-amber-100 px-4 py-3 text-[0.8125rem] text-amber-700">Never submitted to Meta, so it cannot be sent. It exists only in this panel.</p>
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <Pill>{template.category.toLowerCase()}</Pill>
                {template.qualityScore && <Pill tone={template.qualityScore === "GREEN" ? "green" : template.qualityScore === "RED" ? "red" : "amber"}>quality {template.qualityScore.toLowerCase()}</Pill>}
                {template.variables.map((variable, index) => (
                  <Pill key={`${variable}-${index}`} tone="cyan">
                    {`{{${index + 1}}}`} {variable}
                  </Pill>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-3">
                <TemplateActions id={template.id} metaName={template.metaName} inMeta={Boolean(template.metaId)} />
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        result.ok && (
          <Panel>
            <EmptyState
              icon={FileText}
              title="No templates yet"
              description={
                ready
                  ? "Sync from Meta to pull in the templates this business account already has, or submit a new one for approval."
                  : "Connect the WhatsApp Business Account on Chatbot Setup to read Meta's template list."
              }
            />
          </Panel>
        )
      )}
    </>
  );
}
