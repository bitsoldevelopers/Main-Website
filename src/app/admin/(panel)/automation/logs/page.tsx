import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ListChecks, Mail } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { retryJob } from "@/app/admin/actions-automation";
import { jobBadge, messageBadge, relativeTime } from "@/lib/automation/labels";
import { listEvents, listJobs, listMessages } from "@/lib/automation/queries";
import { JOB_TYPE_LABELS, type JobType } from "@/lib/automation/queue";
import { lastTick } from "@/lib/automation/worker";
import { RunQueueButton } from "@/components/admin/automation/SmallForms";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, EmptyState, KeyValue, LinkTabs, PageHeader, Pagination, Panel, Pill, selectClass, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Automation logs" };

type SearchParams = Record<string, string | string[] | undefined>;

const TABS = [
  { value: "emails", label: "Emails" },
  { value: "events", label: "Email events" },
  { value: "jobs", label: "Job queue" },
] as const;

const MESSAGE_STATUSES = ["QUEUED", "SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED", "BOUNCED", "COMPLAINED", "FAILED"];
const JOB_STATUSES = ["PENDING", "RUNNING", "DONE", "FAILED", "CANCELLED"];
const EVENT_TYPES = ["SENT", "DELIVERED", "OPENED", "CLICKED", "REPLIED", "RECEIVED", "BOUNCED", "COMPLAINED", "FAILED", "DELAYED", "SUPPRESSED"];

export default async function LogsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const sp = await searchParams;
  const requested = paramFrom(sp.tab);
  const tab = TABS.some((t) => t.value === requested) ? requested : "emails";
  const status = paramFrom(sp.status);
  const page = pageFrom(sp.page);

  const href = (t: string, s = "", p = 1) => {
    const query = new URLSearchParams({ tab: t });
    if (s) query.set("status", s);
    if (p > 1) query.set("page", String(p));
    return `/admin/automation/logs?${query}`;
  };
  const options = tab === "emails" ? MESSAGE_STATUSES : tab === "jobs" ? JOB_STATUSES : EVENT_TYPES;
  const filter = options.includes(status) ? status : "";
  const tick = lastTick();
  // Server Component: rendered per request, so "now" is the request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Logs"
        description="Every email, every event the provider reported, and every job the queue ran. Imports have their own tab; changes made by people are in the activity log."
        actions={
          <>
            <Link href="/admin/automation/imports" className={btn.secondary}>
              Import log
            </Link>
            {session && hasPermission(session.role, "activity.read") && (
              <Link href="/admin/activity" className={btn.secondary}>
                Activity log
              </Link>
            )}
            {canWrite && <RunQueueButton />}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LinkTabs current={tab} tabs={TABS.map((t) => ({ label: t.label, value: t.value, href: href(t.value) }))} />
        <form method="get" action="/admin/automation/logs" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <select name="status" defaultValue={filter} className={`${selectClass} w-48`} aria-label={tab === "events" ? "Event type" : "Status"}>
            <option value="">{tab === "events" ? "Any event" : "Any status"}</option>
            {options.map((value) => (
              <option key={value} value={value}>
                {(tab === "emails" ? messageBadge(value).label : tab === "jobs" ? jobBadge(value).label : value.toLowerCase().replace(/^./, (c) => c.toUpperCase()))}
              </option>
            ))}
          </select>
          <button type="submit" className={btn.secondary}>
            Filter
          </button>
        </form>
      </div>

      {tab === "jobs" && (
        <Panel className="mb-4" title="Scheduler">
          <KeyValue
            items={[
              { label: "Last pass in this process", value: tick ? `${timeAgo(tick.ranAt)} · started by ${tick.source} · took ${tick.durationMs} ms` : "None since the server started" },
              ...(tick
                ? [
                    {
                      label: "It did",
                      value: tick.skipped
                        ? `Nothing: ${tick.skipped}`
                        : `${tick.claimed} jobs: ${tick.done} done, ${tick.deferred} postponed, ${tick.retried} to retry, ${tick.failed} failed · ${tick.emailsSent} emails sent · ${tick.syncsQueued} syncs queued`,
                    },
                  ]
                : []),
              { label: "Retries", value: "A failed job is tried again after 1 min, 5 min, 15 min, 1 h and 3 h, then gives up." },
            ]}
          />
        </Panel>
      )}

      {tab === "emails" && <Emails filter={filter} page={page} href={href} />}
      {tab === "events" && <Events filter={filter} page={page} href={href} />}
      {tab === "jobs" && <Jobs filter={filter} page={page} href={href} canWrite={canWrite} now={now} />}
    </>
  );
}

type Href = (tab: string, status?: string, page?: number) => string;

async function Emails({ filter, page, href }: { filter: string; page: number; href: Href }) {
  const result = await listMessages({ page, status: filter || undefined });
  if (!result.ok) return <DbUnavailable error={result.error} />;
  return (
    <Panel bodyClassName="p-0">
      {result.data.items.length === 0 ? (
        <EmptyState icon={Mail} title="No emails here" description="Emails sent by automations are listed here with what happened to them." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className={thClass}>To</th>
                <th className={thClass}>Subject</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Sent</th>
                <th className={thClass}>Provider</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((message) => {
                const badge = messageBadge(message.status);
                return (
                  <tr key={message.id} className={trClass}>
                    <td className={tdClass}>
                      <Link href={`/admin/leads/${message.lead.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                        {message.lead.name}
                      </Link>
                      <span className="block text-xs text-slate-500">{message.toEmail}</span>
                    </td>
                    <td className={`${tdClass} max-w-sm`}>
                      {message.subject}
                      {message.error && <span className="mt-1 block text-xs text-red-600">{message.error}</span>}
                    </td>
                    <td className={tdClass}>
                      <Pill tone={badge.tone}>{badge.label}</Pill>
                      {message.openCount > 1 && <span className="mt-1 block text-xs text-slate-500">Opened {message.openCount} times</span>}
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={message.sentAt ? formatDate(message.sentAt, { time: true }) : undefined}>
                      {message.sentAt ? timeAgo(message.sentAt) : "Not sent"}
                    </td>
                    <td className={`${tdClass} text-slate-500`}>
                      {message.provider === "test" ? <Pill tone="amber">Test mode</Pill> : message.provider}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} noun={result.data.total === 1 ? "email" : "emails"} hrefFor={(n) => href("emails", filter, n)} />
    </Panel>
  );
}

async function Events({ filter, page, href }: { filter: string; page: number; href: Href }) {
  const result = await listEvents({ page, type: filter || undefined });
  if (!result.ok) return <DbUnavailable error={result.error} />;
  return (
    <Panel bodyClassName="p-0">
      {result.data.items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No events here"
          description="Delivery, open, click, bounce and reply events arrive through the email provider's webhook once RESEND_WEBHOOK_SECRET is set."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={thClass}>Event</th>
                <th className={thClass}>Lead</th>
                <th className={thClass}>Email</th>
                <th className={thClass}>When</th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((event) => {
                const badge = messageBadge(event.type);
                return (
                  <tr key={event.id} className={trClass}>
                    <td className={tdClass}>
                      <Pill tone={badge.tone}>{event.type === "RECEIVED" ? "Reply received" : badge.label}</Pill>
                    </td>
                    <td className={tdClass}>
                      {event.message ? (
                        <Link href={`/admin/leads/${event.message.lead.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                          {event.message.lead.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                      <span className="block text-xs text-slate-500">{event.message?.toEmail}</span>
                    </td>
                    <td className={`${tdClass} max-w-sm text-slate-600`}>{event.message?.subject ?? "—"}</td>
                    <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(event.occurredAt, { time: true })}>
                      {timeAgo(event.occurredAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} noun={result.data.total === 1 ? "event" : "events"} hrefFor={(n) => href("events", filter, n)} />
    </Panel>
  );
}

async function Jobs({ filter, page, href, canWrite, now }: { filter: string; page: number; href: Href; canWrite: boolean; now: number }) {
  const result = await listJobs({ page, status: filter || undefined });
  if (!result.ok) return <DbUnavailable error={result.error} />;
  return (
    <Panel bodyClassName="p-0">
      {result.data.items.length === 0 ? (
        <EmptyState icon={ListChecks} title="No jobs here" description="Imports, syncs and automation steps each run as a job." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead>
              <tr>
                <th className={thClass}>Job</th>
                <th className={thClass}>For</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Due</th>
                <th className={thClass}>Result</th>
                <th className={thClass}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.data.items.map((job) => {
                const badge = jobBadge(job.status);
                return (
                  <tr key={job.id} className={trClass}>
                    <td className={tdClass}>
                      <span className="font-semibold text-slate-900">{JOB_TYPE_LABELS[job.type as JobType] ?? job.type}</span>
                      <span className="block text-xs text-slate-500">
                        Attempt {job.attempts} of {job.maxAttempts}
                      </span>
                    </td>
                    <td className={tdClass}>
                      {job.subject ? (
                        <Link href={job.subject.href} className="text-cyan-700 hover:underline">
                          {job.subject.label}
                        </Link>
                      ) : (
                        <span className="text-slate-400">Removed</span>
                      )}
                    </td>
                    <td className={tdClass}>
                      <Pill tone={badge.tone}>{badge.label}</Pill>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(job.runAt, { time: true })}>
                      {job.status === "PENDING" ? relativeTime(job.runAt, now) : timeAgo(job.finishedAt ?? job.runAt)}
                    </td>
                    <td className={`${tdClass} max-w-sm text-xs`}>
                      {job.lastError ? <span className={job.status === "FAILED" ? "text-red-600" : "text-amber-700"}>{job.lastError}</span> : <span className="text-slate-500">{job.result}</span>}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {canWrite && job.status === "FAILED" && (
                        <form action={retryJob}>
                          <input type="hidden" name="id" value={job.id} />
                          <SubmitButton variant="secondary" pendingText="…">
                            Retry
                          </SubmitButton>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} noun={result.data.total === 1 ? "job" : "jobs"} hrefFor={(n) => href("jobs", filter, n)} />
    </Panel>
  );
}
