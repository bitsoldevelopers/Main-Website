import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, Pencil, Users } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { LEAD_STATUS_META, normalizeStatus } from "@/lib/admin/leads";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { deleteAutomation, setAutomationStatus } from "@/app/admin/actions-automation";
import { MANDATORY_STOP_CONDITIONS, describeCondition, stopReasonLabel } from "@/lib/automation/conditions";
import { TRIGGER_LABELS, automationBadge, relativeTime, runBadge } from "@/lib/automation/labels";
import { getAutomation, getSetupStatus } from "@/lib/automation/queries";
import { BarList } from "@/components/admin/BarList";
import { Hero, HeroStat, Workflow, heroBtn, type WorkflowNode } from "@/components/admin/automation/parts";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import { Callout, DbUnavailable, EmptyState, LinkTabs, PageHeader, Pagination, Panel, Pill, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Automation" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AutomationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const { id } = await params;
  const sp = await searchParams;
  const status = paramFrom(sp.status);
  const error = paramFrom(sp.error);
  const [result, setup] = await Promise.all([getAutomation(id, { page: pageFrom(sp.page), status: status || undefined }), getSetupStatus()]);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Automations" title="Automation" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  if (!result.data) notFound();
  const { automation, stats, stopReasons, runs } = result.data;
  const badge = automationBadge(automation.status);
  const entry = automation.conditions.filter((c) => c.kind === "ENTRY");
  const blockers = setup.ok ? setup.data.items.filter((item) => item.required && !item.done && item.key !== "automation") : [];

  const nodes: WorkflowNode[] = [
    { key: "trigger", type: "TRIGGER", title: "Lead enrolled", detail: TRIGGER_LABELS[automation.trigger] ?? automation.trigger },
    {
      key: "eligibility",
      type: "CHECK",
      title: "Check eligibility",
      detail: `Has an address that may be emailed; not replied, opted out or taken over${entry.length ? `; ${entry.map(describeCondition).join("; ")}` : ""}.`,
    },
    ...automation.steps.map((step): WorkflowNode => {
      if (step.type === "WAIT") {
        return { key: step.id, type: "WAIT", title: step.label, detail: "Then check for a reply. A reply, bounce or unsubscribe in the meantime ends the run." };
      }
      if (step.type === "CREATE_TASK") {
        return { key: step.id, type: "CREATE_TASK", title: step.label, detail: automation.taskTitle ? `"${automation.taskTitle}", due after ${automation.taskDueDays} day(s)` : undefined };
      }
      const template = step.sequenceStep?.template;
      return {
        key: step.id,
        type: "SEND_EMAIL",
        title: step.label,
        detail: template ? `Template: ${template.name} · Subject: ${template.subject}` : "The template for this step was removed; the step is skipped.",
        href: template ? `/admin/automation/templates/${template.id}` : undefined,
      };
    }),
    { key: "end", type: "STOP", title: "Run completed", detail: "The lead stays in the CRM for a person to work." },
  ];

  const href = (value: string, page = 1) => {
    const query = new URLSearchParams();
    if (value) query.set("status", value);
    if (page > 1) query.set("page", String(page));
    const qs = query.toString();
    return `/admin/automation/automations/${automation.id}${qs ? `?${qs}` : ""}`;
  };

  return (
    <>
      <Link href="/admin/automation/automations" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All automations
      </Link>

      <Hero
        eyebrow="Automation"
        title={automation.name}
        subtitle={automation.description ?? undefined}
        meta={
          <>
            <Pill tone={badge.tone}>{badge.label}</Pill>
            <span>
              Sequence:{" "}
              <Link href={`/admin/automation/sequences/${automation.sequence.id}`} className="font-semibold text-white underline decoration-white/30 hover:decoration-white">
                {automation.sequence.name}
              </Link>
            </span>
            <span>Created by {automation.createdBy}</span>
          </>
        }
        actions={
          canWrite ? (
            <>
              <form action={setAutomationStatus}>
                <input type="hidden" name="id" value={automation.id} />
                <input type="hidden" name="status" value={automation.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
                <SubmitButton className={automation.status === "ACTIVE" ? heroBtn.secondary : heroBtn.primary} pendingText="…">
                  {automation.status === "ACTIVE" ? "Pause automation" : "Activate"}
                </SubmitButton>
              </form>
              <Link href={`/admin/automation/automations/${automation.id}/edit`} className={heroBtn.secondary}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
              <Link href="/admin/leads?status=READY_FOR_OUTREACH" className={heroBtn.secondary}>
                <Users className="h-4 w-4" /> Choose leads
              </Link>
            </>
          ) : null
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <HeroStat label="In progress" value={stats.active.toLocaleString()} hint={stats.paused ? `${stats.paused} paused` : undefined} />
          <HeroStat label="Emails sent" value={stats.sent.toLocaleString()} />
          <HeroStat label="Replied" value={stats.replied.toLocaleString()} hint={stats.total ? `${Math.round((stats.replied / stats.total) * 100)}% of enrolled leads` : undefined} />
          <HeroStat label="Finished without reply" value={stats.completed.toLocaleString()} />
          <HeroStat label="Enrolled in total" value={stats.total.toLocaleString()} />
        </div>
      </Hero>

      {error && (
        <Callout tone="red" icon={AlertTriangle} title="That did not work" className="mb-6">
          {error}
        </Callout>
      )}
      {automation.status !== "ACTIVE" && (
        <Callout tone="amber" title={automation.status === "DRAFT" ? "This automation is a draft" : "This automation is paused"} className="mb-6">
          {automation.status === "DRAFT"
            ? "Read the emails it sends, then activate it. Until then no lead can be enrolled and nothing is sent."
            : "Leads already in it keep their place but receive nothing until it is activated again."}
        </Callout>
      )}
      {blockers.length > 0 && (
        <Callout tone="amber" icon={AlertTriangle} title="Emails are held back" className="mb-6">
          {blockers.map((item) => `${item.label}: ${item.detail}`).join(" ")}{" "}
          <Link href="/admin/automation/settings" className="font-semibold text-cyan-700 underline">
            Settings
          </Link>
        </Callout>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6">
          <Panel title="Workflow" description="What happens to each lead, in order">
            <Workflow nodes={nodes} />
          </Panel>

          <Panel title="Stop conditions" description="Always on; checked before every email">
            <ul className="space-y-1.5 text-sm text-slate-700">
              {MANDATORY_STOP_CONDITIONS.map((rule) => (
                <li key={rule.label} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" /> {rule.label}
                </li>
              ))}
            </ul>
          </Panel>

          {stopReasons.length > 0 && (
            <Panel title="Why runs ended">
              <BarList items={stopReasons.map((row) => ({ label: stopReasonLabel(row.reason), value: row.count }))} />
            </Panel>
          )}

          {canWrite && (
            <Panel title="Danger zone">
              <form action={deleteAutomation}>
                <input type="hidden" name="id" value={automation.id} />
                <ConfirmButton message={`Delete "${automation.name}" and the history of its runs? Emails already sent stay on each lead.`} className="w-full">
                  Delete automation
                </ConfirmButton>
              </form>
            </Panel>
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="mb-3">
            <LinkTabs
              current={status}
              tabs={[
                { label: "All", value: "", href: href(""), count: stats.total },
                { label: "Running", value: "ACTIVE", href: href("ACTIVE"), count: stats.active },
                { label: "Paused", value: "PAUSED", href: href("PAUSED"), count: stats.paused },
                { label: "Stopped", value: "STOPPED", href: href("STOPPED"), count: stats.stopped },
                { label: "Completed", value: "COMPLETED", href: href("COMPLETED"), count: stats.completed },
                { label: "Failed", value: "FAILED", href: href("FAILED"), count: stats.failed },
              ]}
            />
          </div>
          <Panel bodyClassName="p-0" title="Leads in this automation">
            {runs.items.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No leads here"
                description="Start the automation from a lead's profile, from the lead list (select several), or let an import start it for new leads."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Lead</th>
                      <th className={thClass}>Run</th>
                      <th className={`${thClass} text-right`}>Emails</th>
                      <th className={thClass}>Next step</th>
                      <th className={thClass}>Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.items.map((run) => {
                      const state = runBadge(run.status);
                      const next = automation.steps[run.stepIndex];
                      const leadStatus = normalizeStatus(run.lead.status);
                      return (
                        <tr key={run.id} className={trClass}>
                          <td className={tdClass}>
                            <Link href={`/admin/leads/${run.lead.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                              {run.lead.name}
                            </Link>
                            <span className="block text-xs text-slate-500">{[run.lead.company, run.lead.outreachEmail].filter(Boolean).join(" · ")}</span>
                            <Pill tone={LEAD_STATUS_META[leadStatus].tone} className="mt-1">
                              {LEAD_STATUS_META[leadStatus].label}
                            </Pill>
                          </td>
                          <td className={tdClass}>
                            <Pill tone={state.tone}>{state.label}</Pill>
                            {run.stopReason && <span className="mt-1 block text-xs text-slate-500">{stopReasonLabel(run.stopReason)}</span>}
                          </td>
                          <td className={`${tdClass} text-right tabular-nums`}>{run.emailsSent}</td>
                          <td className={`${tdClass} text-slate-500`}>
                            {run.status === "ACTIVE" && next ? (
                              <>
                                <span className="block text-slate-900">{next.label}</span>
                                {run.nextRunAt && <span className="text-xs" title={formatDate(run.nextRunAt, { time: true })}>{relativeTime(run.nextRunAt)}</span>}
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(run.startedAt, { time: true })}>
                            {timeAgo(run.startedAt)}
                            <span className="block text-xs">by {run.startedBy}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={runs.page} totalPages={runs.totalPages} total={runs.total} noun={runs.total === 1 ? "run" : "runs"} hrefFor={(n) => href(status, n)} />
          </Panel>
        </div>
      </div>
    </>
  );
}
