import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  FileSpreadsheet,
  Inbox,
  ListChecks,
  MailCheck,
  Reply,
  Send,
  Upload,
  Users,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { importBadge, relativeTime } from "@/lib/automation/labels";
import { getOverview, getSetupStatus } from "@/lib/automation/queries";
import { BarList } from "@/components/admin/BarList";
import { ColumnChart } from "@/components/admin/automation/ColumnChart";
import { Hero, HeroStat, Workflow, heroBtn } from "@/components/admin/automation/parts";
import { Callout, DbUnavailable, EmptyState, Panel, Pill, StatCard, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Lead automation" };

function percent(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

export default async function AutomationOverviewPage() {
  await requireAdminPage("outreach.read");
  const [overview, setup] = await Promise.all([getOverview(), getSetupStatus()]);

  if (!overview.ok) {
    return (
      <>
        <Hero eyebrow="CRM" title="Lead automation" subtitle="Import leads, run email sequences, follow up, hand over to a person." />
        <DbUnavailable error={overview.error} />
      </>
    );
  }
  const { kpis, funnel, daily, bySource, queue, lastTick, schedulerRunning, recentImports } = overview.data;
  const blockers = setup.ok ? setup.data.items.filter((item) => item.required && !item.done) : [];

  return (
    <>
      <Hero
        eyebrow="CRM"
        title="Lead automation"
        subtitle="Source → import → validate → de-duplicate → CRM → outreach email → follow-up → human task."
        actions={
          <>
            <Link href="/admin/automation/sources/google-sheets" className={heroBtn.primary}>
              <FileSpreadsheet className="h-4 w-4" /> Import from Google Sheets
            </Link>
            <Link href="/admin/automation/sources/csv" className={heroBtn.secondary}>
              <Upload className="h-4 w-4" /> Upload CSV
            </Link>
            <Link href="/admin/leads?kind=prospect" className={heroBtn.secondary}>
              <Users className="h-4 w-4" /> View leads
            </Link>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeroStat
            label="Scheduler"
            value={schedulerRunning ? "Running in this process" : "Not running here"}
            hint={lastTick ? `Last pass ${timeAgo(lastTick.ranAt)} (${lastTick.source})` : "No pass yet since the server started"}
          />
          <HeroStat
            label="Queue"
            value={`${queue.pending.toLocaleString()} waiting`}
            hint={queue.nextRunAt ? `Next job ${relativeTime(queue.nextRunAt)}` : "Nothing scheduled"}
          />
          <HeroStat label="In automation" value={`${kpis.inAutomation.toLocaleString()} leads`} hint={`${kpis.followUps7.toLocaleString()} follow-ups due in 7 days`} />
          <HeroStat
            label="Sending as"
            value={setup.ok && setup.data.settings.fromEmail ? setup.data.settings.fromEmail : "Not set"}
            hint={setup.ok ? `Up to ${setup.data.settings.dailyLimit} emails a day` : undefined}
          />
        </div>
      </Hero>

      {blockers.length > 0 && (
        <Callout tone="amber" icon={AlertTriangle} title="No email will be sent until this is done" className="mb-6">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {blockers.map((item) => (
              <li key={item.key}>
                <span className="font-semibold text-slate-800">{item.label}:</span> {item.detail}{" "}
                {item.href && (
                  <Link href={item.href} className="font-semibold text-cyan-700 underline">
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Callout>
      )}
      {queue.failed > 0 && (
        <Callout tone="red" icon={AlertTriangle} title={`${queue.failed} job${queue.failed === 1 ? "" : "s"} failed`} className="mb-6">
          They were retried and gave up.{" "}
          <Link href="/admin/automation/logs?tab=jobs&status=FAILED" className="font-semibold text-cyan-700 underline">
            See what went wrong
          </Link>
        </Callout>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ready for outreach"
          value={kpis.ready.toLocaleString()}
          hint={`${kpis.prospects.toLocaleString()} imported leads in total`}
          icon={Inbox}
          href="/admin/leads?status=READY_FOR_OUTREACH"
        />
        <StatCard
          label="Emails sent · 30 days"
          value={kpis.sent30.toLocaleString()}
          hint={`${kpis.sent7.toLocaleString()} in the last 7 days`}
          icon={Send}
          tone="purple"
          href="/admin/automation/logs?tab=emails"
        />
        <StatCard
          label="Replies · 30 days"
          value={kpis.replied30.toLocaleString()}
          hint={`Reply rate ${percent(kpis.replyRate)}`}
          icon={Reply}
          tone="green"
          href="/admin/leads?status=REPLIED"
        />
        <StatCard
          label="Open tasks"
          value={kpis.openTasks.toLocaleString()}
          hint={kpis.overdueTasks > 0 ? `${kpis.overdueTasks.toLocaleString()} overdue` : "None overdue"}
          icon={ListChecks}
          tone={kpis.overdueTasks > 0 ? "amber" : "cyan"}
          href="/admin/automation/followups"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Emails sent per day" description="Last 14 days, Pakistan time">
            <ColumnChart
              unit="Emails"
              caption="Outreach emails sent by all automations"
              data={daily.map((day) => ({ key: day.date, label: day.label, value: day.sent }))}
            />
          </Panel>

          <Panel
            bodyClassName="p-0"
            title="Recent imports"
            actions={
              <Link href="/admin/automation/imports" className={btn.ghost}>
                All imports <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {recentImports.length === 0 ? (
              <EmptyState
                icon={FileSpreadsheet}
                title="Nothing imported yet"
                description="Link a Google Sheet or upload a CSV with the prospect columns to bring leads into the CRM."
                action={
                  <Link href="/admin/automation/sources" className={btn.primary}>
                    Choose a source
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Source</th>
                      <th className={thClass}>Status</th>
                      <th className={`${thClass} text-right`}>Rows</th>
                      <th className={`${thClass} text-right`}>New</th>
                      <th className={`${thClass} text-right`}>Updated</th>
                      <th className={thClass}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentImports.map((batch) => {
                      const badge = importBadge(batch.status);
                      return (
                        <tr key={batch.id} className={trClass}>
                          <td className={tdClass}>
                            <Link href={`/admin/automation/imports/${batch.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                              {batch.label}
                            </Link>
                            <span className="block text-xs text-slate-500">
                              {batch.trigger === "SCHEDULED" ? "Automatic sync" : `Started by ${batch.startedBy}`}
                            </span>
                          </td>
                          <td className={tdClass}>
                            <Pill tone={badge.tone}>{badge.label}</Pill>
                          </td>
                          <td className={`${tdClass} text-right tabular-nums`}>{batch.totalRows.toLocaleString()}</td>
                          <td className={`${tdClass} text-right tabular-nums`}>{batch.createdCount.toLocaleString()}</td>
                          <td className={`${tdClass} text-right tabular-nums`}>{batch.updatedCount.toLocaleString()}</td>
                          <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(batch.createdAt, { time: true })}>
                            {timeAgo(batch.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="How a lead moves through the system" description="The same path for every source">
            <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
              <Workflow
                nodes={[
                  { key: "source", type: "TRIGGER", title: "Source", detail: "Google Sheets, CSV, website forms, manual entry." },
                  { key: "normalise", type: "CHECK", title: "Normalise and validate", detail: "Emails, phones, LinkedIn and website URLs; the source values are kept as supplied." },
                  { key: "dedupe", type: "CHECK", title: "Duplicate check", detail: "Email 1 → Email 2 → Personal Email → phone → LinkedIn → name + company." },
                  { key: "crm", type: "CHECK", title: "Create or update the lead", detail: "Company, contact, three emails and four phones, each stored separately." },
                  { key: "email", type: "CHECK", title: "Choose the outreach email", detail: "One address per lead; invalid, bounced and suppressed ones are skipped." },
                ]}
              />
              <Workflow
                nodes={[
                  { key: "start", type: "SEND_EMAIL", title: "Start the sequence", detail: "Personalised from the CRM fields, with an unsubscribe link." },
                  { key: "wait", type: "WAIT", title: "Wait, then check for a reply", detail: "Before every email the stop conditions are checked again." },
                  { key: "follow", type: "SEND_EMAIL", title: "Follow up", detail: "Only if the lead has not replied, bounced, unsubscribed or been taken over." },
                  { key: "task", type: "CREATE_TASK", title: "Human follow-up task", detail: "After the last email, or the moment a lead replies." },
                  { key: "won", type: "STOP", title: "Conversion", detail: "Worked from the pipeline board like any other lead." },
                ]}
              />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Outreach funnel" description="Imported leads, by how far they got">
            <BarList items={funnel.map((row) => ({ label: row.label, value: row.value, title: row.hint }))} />
          </Panel>

          <Panel title="Deliverability · 30 days">
            <BarList
              items={[
                { label: "Sent", value: kpis.sent30 },
                { label: "Replied", value: kpis.replied30 },
                { label: "Bounced", value: kpis.bounced30 },
                { label: "Unsubscribed", value: kpis.unsubscribed30 },
              ]}
            />
            <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
              <MailCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Bounces, opens and replies arrive through the email provider&apos;s webhook. A bounce rate above 5% is a
              reason to clean the list before sending more.
            </p>
          </Panel>

          {bySource.length > 0 && (
            <Panel
              title="Leads by source"
              actions={
                <Link href="/admin/automation/sources" className={btn.ghost}>
                  Sources <ArrowUpRight className="h-4 w-4" />
                </Link>
              }
            >
              <BarList items={bySource.map((row) => ({ label: row.label, value: row.value }))} />
            </Panel>
          )}

          {setup.ok && (
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <WorkflowIcon className="h-4 w-4 text-cyan-700" /> Setup
                </span>
              }
              description="What is connected in this environment"
            >
              <ul className="divide-y divide-slate-100">
                {setup.data.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-3 py-2.5 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <CircleDashed className={`mt-0.5 h-4 w-4 shrink-0 ${item.required ? "text-amber-600" : "text-slate-400"}`} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      {!item.done && !item.required && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Optional</span>}
                      <span className="block text-xs leading-relaxed text-slate-500">{item.detail}</span>
                    </span>
                    {item.href && !item.done && (
                      <Link href={item.href} className="shrink-0 text-xs font-semibold text-cyan-700 hover:underline">
                        Set up
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
