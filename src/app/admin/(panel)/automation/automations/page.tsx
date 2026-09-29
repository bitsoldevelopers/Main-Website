import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Plus, Workflow } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/rbac";
import { setAutomationStatus } from "@/app/admin/actions-automation";
import { TRIGGER_LABELS, automationBadge } from "@/lib/automation/labels";
import { listAutomations } from "@/lib/automation/queries";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, EmptyState, PageHeader, Pill, btn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Automations" };

export default async function AutomationsPage() {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const result = await listAutomations();

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Automations"
        description="An automation takes a lead through a sequence of emails, stops the moment something says it should, and hands the lead to a person at the end."
        actions={
          canWrite ? (
            <Link href="/admin/automation/automations/new" className={btn.primary}>
              <Plus className="h-4 w-4" /> New automation
            </Link>
          ) : null
        }
      />

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState icon={Workflow} title="No automations yet" description="Create one from a sequence of emails." />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {result.data.map((automation) => {
            const badge = automationBadge(automation.status);
            return (
              <section key={automation.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/admin/automation/automations/${automation.id}`} className="text-base font-bold text-slate-900 hover:text-cyan-700">
                      {automation.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {automation.sequence.name} · {automation.sequence._count.steps} email{automation.sequence._count.steps === 1 ? "" : "s"} ·{" "}
                      {TRIGGER_LABELS[automation.trigger] ?? automation.trigger}
                    </p>
                  </div>
                  <Pill tone={badge.tone}>{badge.label}</Pill>
                </div>
                {automation.description && <p className="mt-3 text-sm text-slate-500">{automation.description}</p>}

                <dl className="mt-4 grid grid-cols-4 gap-3 border-t border-slate-100 pt-4">
                  {(
                    [
                      ["In progress", automation.active],
                      ["Emails sent", automation.sent],
                      ["Replied", automation.replied],
                      ["Finished", automation.completed],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</dt>
                      <dd className="mt-0.5 text-lg font-bold text-slate-900">{value.toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                  <Link href={`/admin/automation/automations/${automation.id}`} className={btn.secondary}>
                    Open <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  {canWrite && (
                    <form action={setAutomationStatus}>
                      <input type="hidden" name="id" value={automation.id} />
                      <input type="hidden" name="status" value={automation.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
                      <SubmitButton variant={automation.status === "ACTIVE" ? "ghost" : "primary"} pendingText="…">
                        {automation.status === "ACTIVE" ? "Pause" : "Activate"}
                      </SubmitButton>
                    </form>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
