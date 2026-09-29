import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckSquare, ExternalLink, Phone } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { LEAD_PRIORITY_META, isLeadPriority } from "@/lib/admin/leads";
import { paramFrom } from "@/lib/admin/queries";
import { listAssignees } from "@/lib/admin/queries-crm";
import { hasPermission } from "@/lib/admin/rbac";
import { setTaskStatus } from "@/app/admin/actions-automation";
import { relativeTime } from "@/lib/automation/labels";
import { phoneDigits } from "@/lib/automation/normalize";
import { getFollowUps } from "@/lib/automation/queries";
import { TaskForm } from "@/components/admin/automation/SmallForms";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, EmptyState, LinkTabs, PageHeader, Panel, Pill, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Follow-ups" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "leads.write") : false;
  const sp = await searchParams;
  const tasks = paramFrom(sp.tasks) || "open";
  const [result, assignees] = await Promise.all([getFollowUps({ tasks }), listAssignees()]);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Lead automation" title="Follow-ups" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  const { scheduled, scheduledTotal, taskCounts } = result.data;
  // Server Component: rendered per request, so "now" is the request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Follow-ups"
        description="What people have to do, and what the automations will send next. A task is created when a lead replies and when a sequence ends without an answer."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div>
            <div className="mb-3">
              <LinkTabs
                current={tasks}
                tabs={[
                  { label: "Open", value: "open", href: "/admin/automation/followups", count: taskCounts.open },
                  { label: "Overdue", value: "overdue", href: "/admin/automation/followups?tasks=overdue", count: taskCounts.overdue },
                  { label: "Done", value: "done", href: "/admin/automation/followups?tasks=done", count: taskCounts.done },
                ]}
              />
            </div>
            <Panel bodyClassName="p-0" title="Tasks for people">
              {result.data.tasks.length === 0 ? (
                <EmptyState icon={CheckSquare} title={tasks === "done" ? "Nothing completed yet" : "Nothing to do"} description={tasks === "open" ? "Tasks appear when a lead replies or a sequence finishes." : undefined} />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {result.data.tasks.map((task) => {
                    const overdue = task.status === "OPEN" && task.dueAt && task.dueAt.getTime() < now;
                    const priority = isLeadPriority(task.priority) ? task.priority : "NORMAL";
                    const digits = task.lead?.phone ? phoneDigits(task.lead.phone) : "";
                    return (
                      <li key={task.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className={`font-semibold ${task.status === "DONE" ? "text-slate-500 line-through" : "text-slate-900"}`}>{task.title}</p>
                          {task.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-500">{task.description}</p>}
                          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                            {task.lead && (
                              <Link href={`/admin/leads/${task.lead.id}`} className="font-semibold text-cyan-700 hover:underline">
                                {task.lead.name}
                                {task.lead.company ? ` · ${task.lead.company}` : ""}
                              </Link>
                            )}
                            {task.dueAt && (
                              <span className={overdue ? "font-semibold text-amber-700" : undefined} title={formatDate(task.dueAt, { time: true })}>
                                Due {relativeTime(task.dueAt, now)}
                              </span>
                            )}
                            <span>{task.assignedTo ? `For ${task.assignedTo.name || task.assignedTo.email}` : "Unassigned"}</span>
                            <span>{task.source === "AUTOMATION" ? "Created by an automation" : `Created by ${task.createdBy}`}</span>
                            {priority !== "NORMAL" && <Pill tone={LEAD_PRIORITY_META[priority].tone}>{LEAD_PRIORITY_META[priority].label}</Pill>}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          {digits && (
                            <a href={`tel:+${digits}`} className={btn.icon} title={`Call ${task.lead?.phone}`}>
                              <Phone className="h-4 w-4" />
                              <span className="sr-only">Call</span>
                            </a>
                          )}
                          {task.lead?.linkedinUrl && (
                            <a href={task.lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className={btn.icon} title="LinkedIn profile">
                              <ExternalLink className="h-4 w-4" />
                              <span className="sr-only">LinkedIn</span>
                            </a>
                          )}
                          {canWrite && (
                            <form action={setTaskStatus}>
                              <input type="hidden" name="id" value={task.id} />
                              <input type="hidden" name="status" value={task.status === "OPEN" ? "DONE" : "OPEN"} />
                              <SubmitButton variant={task.status === "OPEN" ? "secondary" : "ghost"} pendingText="…">
                                {task.status === "OPEN" ? "Mark done" : "Reopen"}
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel
            bodyClassName="p-0"
            title="Scheduled follow-up emails"
            description={`${scheduledTotal.toLocaleString()} waiting. Each is sent only if the lead has not replied, bounced, unsubscribed or been taken over by then.`}
          >
            {scheduled.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No follow-ups scheduled" description="They appear once an automation has sent its first email to a lead." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Lead</th>
                      <th className={thClass}>Email</th>
                      <th className={thClass}>Automation</th>
                      <th className={thClass}>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scheduled.map((followUp) => (
                      <tr key={followUp.id} className={trClass}>
                        <td className={tdClass}>
                          <Link href={`/admin/leads/${followUp.lead.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                            {followUp.lead.name}
                          </Link>
                          <span className="block text-xs text-slate-500">{[followUp.lead.company, followUp.lead.outreachEmail].filter(Boolean).join(" · ")}</span>
                        </td>
                        <td className={tdClass}>{followUp.title}</td>
                        <td className={`${tdClass} text-slate-500`}>
                          {followUp.run ? (
                            <Link href={`/admin/automation/automations/${followUp.run.automation.id}`} className="text-cyan-700 hover:underline">
                              {followUp.run.automation.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                          {followUp.run?.status === "PAUSED" && (
                            <Pill tone="amber" className="ml-2">
                              Paused
                            </Pill>
                          )}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(followUp.dueAt, { time: true })}>
                          {relativeTime(followUp.dueAt, now)}
                          <span className="block text-xs">{formatDate(followUp.dueAt)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {canWrite && (
          <Panel title="Add a task" description="Not tied to a lead. To add one for a lead, use the lead's profile." className="xl:self-start">
            <TaskForm assignees={assignees.ok ? assignees.data.map((u) => ({ id: u.id, name: u.name || u.email })) : []} />
          </Panel>
        )}
      </div>
    </>
  );
}
