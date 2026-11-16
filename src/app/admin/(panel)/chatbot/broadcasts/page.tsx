import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FileText, Megaphone, Send, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { config } from "@/lib/config";
import { formatDate, truncate } from "@/lib/admin/format";
import { listBroadcasts } from "@/lib/whatsapp/broadcast-queries";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { Callout, DbUnavailable, EmptyState, PageHeader, Panel, StatCard, btn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { BroadcastActions } from "@/components/admin/chatbot/BroadcastActions";
import { BroadcastComposer } from "@/components/admin/chatbot/BroadcastComposer";
import { BroadcastStatusPill } from "@/components/admin/chatbot/broadcast-ui";

export const metadata: Metadata = { title: "WhatsApp broadcasts" };
export const dynamic = "force-dynamic";

/**
 * Broadcast campaigns. Every row is a Meta-approved template sent to an
 * opted-in audience. The two numbers worth reading are on each row: how many
 * messages Meta accepted, and how many arrived. They are different facts,
 * and the gap between them is the first thing to look at when a campaign
 * underperforms.
 */
export default async function BroadcastsPage() {
  await requireAdminPage("chatbot.manage");

  const [settings, result] = await Promise.all([getWhatsAppSettings({ fresh: true }), listBroadcasts()]);
  const data = result.ok ? result.data : null;
  const canSend = settings.enabled;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="WhatsApp broadcasts"
        description="Send a Meta-approved template to many contacts at once. Anyone who has sent STOP is excluded automatically, and nothing goes out until Send is pressed on a broadcast's row."
        actions={
          <Link href="/admin/chatbot/templates" className={btn.secondary}>
            <FileText className="h-4 w-4" /> Templates
          </Link>
        }
      />

      {!result.ok && <DbUnavailable error={result.error} className="mb-6" />}

      {!canSend && (
        <Callout tone="amber" icon={AlertTriangle} title="WhatsApp is not connected" className="mb-6">
          Broadcasts can be drafted, but sending needs the phone number ID and access token under{" "}
          <Link href="/admin/chatbot/setup" className="font-medium text-cyan-700 hover:underline">
            Chatbot Setup → Connect WhatsApp
          </Link>
          .
        </Callout>
      )}

      {canSend && data && data.templates.length === 0 && (
        <Callout tone="cyan" title="No approved templates yet" className="mb-6">
          A broadcast reaches people outside the 24-hour reply window, which Meta only allows through a template it has approved.{" "}
          <Link href="/admin/chatbot/templates" className="font-medium text-cyan-700 hover:underline">
            Sync or submit one
          </Link>{" "}
          before composing a broadcast.
        </Callout>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Broadcasts" value={data?.broadcasts.length ?? 0} icon={Megaphone} />
        <StatCard label="Sent" value={data?.sentCount ?? 0} hint="Runs that finished" icon={Send} tone="green" />
        <StatCard label="Messages delivered" value={(data?.delivered ?? 0).toLocaleString()} hint="Confirmed by Meta, not just accepted" icon={Users} tone="purple" />
      </div>

      <Panel title="New broadcast" description="Choose an approved template, fill its values, pick the audience. Creating never sends." className="mb-6">
        <BroadcastComposer templates={data?.templates ?? []} canSend={canSend} cronConfigured={Boolean(config.cron.secret)} />
      </Panel>

      <Panel title="Broadcasts" description="Newest first. Open a reference to see every recipient." bodyClassName="p-0">
        {data && data.broadcasts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] text-start">
              <thead>
                <tr>
                  <th className={thClass}>Broadcast</th>
                  <th className={thClass}>Template</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Reach</th>
                  <th className={thClass}>When</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {data.broadcasts.map((row) => (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>
                      <div className="min-w-0 max-w-sm">
                        <Link href={`/admin/chatbot/broadcasts/${row.id}`} className="font-medium text-slate-900 hover:text-cyan-700 hover:underline">
                          {row.title}
                        </Link>
                        <p className="font-mono text-xs text-slate-500">{row.reference}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-slate-500">{truncate(row.body, 100)}</p>
                      </div>
                    </td>
                    <td className={tdClass}>
                      <p className="text-[0.875rem]">{row.template?.name ?? "Deleted template"}</p>
                      <p className="font-mono text-xs text-slate-500">
                        {row.templateName ?? "-"}
                        {row.languageCode ? ` · ${row.languageCode}` : ""}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <BroadcastStatusPill status={row.status} />
                    </td>
                    <td className={tdClass}>
                      <p className="whitespace-nowrap text-[0.875rem]">
                        {row.delivered.toLocaleString()} delivered / {row.sent.toLocaleString()} accepted
                      </p>
                      <p className="whitespace-nowrap text-xs text-slate-500">
                        {row.recipients.toLocaleString()} targeted
                        {row.failed > 0 ? ` · ${row.failed.toLocaleString()} failed` : ""}
                      </p>
                    </td>
                    <td className={tdClass}>
                      <span className="whitespace-nowrap text-[0.875rem] text-slate-500">
                        {row.status === "SCHEDULED" && row.scheduledAt
                          ? `Scheduled ${formatDate(row.scheduledAt, { time: true })}`
                          : formatDate(row.sentAt ?? row.startedAt ?? row.createdAt, { time: true })}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <BroadcastActions id={row.id} status={row.status} pending={data.pending[row.id] ?? 0} title={row.title} canSend={canSend} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          result.ok && <EmptyState icon={Megaphone} title="No broadcasts yet" description="Create one above from an approved template and an audience." />
        )}
      </Panel>
    </>
  );
}
