import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCheck, Send, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { getBroadcast } from "@/lib/whatsapp/broadcast-queries";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { Callout, DbUnavailable, EmptyState, KeyValue, PageHeader, Panel, Pill, StatCard, tdClass, thClass, trClass } from "@/components/admin/ui";
import { BroadcastActions } from "@/components/admin/chatbot/BroadcastActions";
import { BroadcastStatusPill, RecipientStatusPill } from "@/components/admin/chatbot/broadcast-ui";

export const metadata: Metadata = { title: "Broadcast" };
export const dynamic = "force-dynamic";

/**
 * One broadcast, recipient by recipient. The list page can only show totals;
 * this is where a specific question gets an answer: whether one number
 * received the message, and what Meta said if it did not. Failures are shown
 * first, because they are the rows anyone opens this page to read.
 */
export default async function BroadcastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("chatbot.manage");
  const { id } = await params;

  const [settings, result] = await Promise.all([getWhatsAppSettings({ fresh: true }), getBroadcast(id)]);
  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Chatbot" title="Broadcast" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  if (!result.data) notFound();

  const { broadcast, recipients, pending } = result.data;

  return (
    <>
      <Link href="/admin/chatbot/broadcasts" className="mb-4 inline-flex items-center gap-1.5 text-[0.875rem] text-slate-500 hover:text-cyan-700">
        <ArrowLeft className="h-4 w-4" /> All broadcasts
      </Link>

      <PageHeader
        eyebrow="Broadcast"
        title={broadcast.title}
        description={
          <>
            <span className="font-mono">{broadcast.reference}</span> · drafted by {broadcast.createdBy ?? "an earlier version of the panel"} on{" "}
            {formatDate(broadcast.createdAt, { time: true })}
          </>
        }
        actions={<BroadcastActions id={broadcast.id} status={broadcast.status} pending={pending} title={broadcast.title} canSend={settings.enabled} />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <BroadcastStatusPill status={broadcast.status} />
        {broadcast.templateName && (
          <Pill className="font-mono">
            {broadcast.templateName} · {broadcast.languageCode}
          </Pill>
        )}
        {broadcast.status === "SCHEDULED" && broadcast.scheduledAt && <Pill tone="purple">Scheduled for {formatDate(broadcast.scheduledAt, { time: true })}</Pill>}
      </div>

      {broadcast.error && (
        <Callout tone="red" icon={AlertTriangle} title="The last run stopped" className="mb-6">
          {broadcast.error}
        </Callout>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Targeted" value={broadcast.recipients.toLocaleString()} icon={Users} />
        <StatCard label="Accepted by Meta" value={broadcast.sent.toLocaleString()} hint="Handed over for delivery" icon={Send} tone="cyan" />
        <StatCard label="Delivered" value={broadcast.delivered.toLocaleString()} hint={`${broadcast.readCount.toLocaleString()} read`} icon={CheckCheck} tone="green" />
        <StatCard label="Failed" value={broadcast.failed.toLocaleString()} icon={AlertTriangle} tone={broadcast.failed > 0 ? "red" : "slate"} />
      </div>

      <Panel title="What was sent" description="Placeholders shown with a sample contact's values. Each recipient received their own." className="mb-6">
        <p className="whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-[0.9375rem] leading-relaxed text-slate-700">{broadcast.body}</p>
        <KeyValue
          className="mt-4"
          items={[
            { label: "Template", value: broadcast.template ? `${broadcast.template.name} (${broadcast.template.status.toLowerCase()} in Meta)` : "Deleted from Meta" },
            { label: "Started", value: broadcast.startedAt ? formatDate(broadcast.startedAt, { time: true }) : "Not yet" },
            { label: "Finished", value: broadcast.sentAt ? formatDate(broadcast.sentAt, { time: true }) : "Not yet" },
            ...(broadcast.headerMediaUrl ? [{ label: "Header media", value: <span className="break-all font-mono text-[0.8125rem]">{broadcast.headerMediaUrl}</span> }] : []),
          ]}
        />
      </Panel>

      <Panel title="Recipients" description={`${broadcast.recipients.toLocaleString()} targeted. Failures first.`} bodyClassName="p-0">
        {recipients.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-start">
              <thead>
                <tr>
                  <th className={thClass}>Contact</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Accepted</th>
                  <th className={thClass}>Delivered</th>
                  <th className={thClass}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((row) => (
                  <tr key={row.id} className={trClass}>
                    <td className={tdClass}>
                      <p className="font-medium text-slate-900">{row.name ?? "Unnamed"}</p>
                      <a href={`https://wa.me/${row.waId}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-slate-500 hover:text-cyan-700 hover:underline">
                        {row.phone}
                      </a>
                    </td>
                    <td className={tdClass}>
                      <RecipientStatusPill status={row.status} />
                    </td>
                    <td className={tdClass}>
                      <span className="whitespace-nowrap text-[0.875rem] text-slate-500">{row.sentAt ? formatDate(row.sentAt, { time: true }) : "-"}</span>
                    </td>
                    <td className={tdClass}>
                      <span className="whitespace-nowrap text-[0.875rem] text-slate-500">
                        {row.readAt ?? row.deliveredAt ? formatDate((row.readAt ?? row.deliveredAt)!, { time: true }) : "-"}
                      </span>
                    </td>
                    <td className={tdClass}>
                      {row.error ? (
                        <span className="text-[0.875rem] text-red-700">{row.error}</span>
                      ) : (
                        <span className="font-mono text-xs text-slate-500">{row.messageId ? `${row.messageId.slice(0, 22)}…` : "-"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {broadcast.recipients > recipients.length && (
              <p className="border-t border-slate-200 px-5 py-3 text-[0.8125rem] text-slate-500">
                Showing the first {recipients.length.toLocaleString()} of {broadcast.recipients.toLocaleString()} recipients.
              </p>
            )}
          </div>
        ) : (
          <EmptyState icon={Users} title="No recipients on this broadcast" description="The audience matched nobody when it was built. Delete it and create another." />
        )}
      </Panel>
    </>
  );
}
