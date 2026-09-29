import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, ListOrdered, Mail, Plus } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { automationBadge } from "@/lib/automation/labels";
import { listSequences } from "@/lib/automation/queries";
import { Callout, DbUnavailable, EmptyState, PageHeader, Pill, btn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Sequences" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SequencesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const sp = await searchParams;
  const saved = paramFrom(sp.saved);
  const error = paramFrom(sp.error);
  const result = await listSequences();

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Email sequences"
        description="A sequence is the emails of an outreach, in order, with the wait before each. Automations run sequences."
        actions={
          canWrite ? (
            <Link href="/admin/automation/sequences/new" className={btn.primary}>
              <Plus className="h-4 w-4" /> New sequence
            </Link>
          ) : null
        }
      />

      {saved && (
        <Callout tone="green" icon={CheckCircle2} title={`Saved "${saved}"`} className="mb-6">
          Automations using it have been updated.
        </Callout>
      )}
      {error && (
        <Callout tone="red" icon={AlertTriangle} title="That did not work" className="mb-6">
          {error}
        </Callout>
      )}

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState icon={ListOrdered} title="No sequences yet" />
        </div>
      ) : (
        <div className="space-y-4">
          {result.data.map((sequence) => {
            let day = 0;
            return (
              <section key={sequence.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <Link href={`/admin/automation/sequences/${sequence.id}`} className="text-base font-bold text-slate-900 hover:text-cyan-700">
                      {sequence.name}
                    </Link>
                    {sequence.description && <p className="mt-0.5 text-sm text-slate-500">{sequence.description}</p>}
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {sequence.automations.length === 0
                        ? "Not used by any automation."
                        : sequence.automations.map((automation) => (
                            <Link key={automation.id} href={`/admin/automation/automations/${automation.id}`}>
                              <Pill tone={automationBadge(automation.status).tone} className="normal-case tracking-normal">
                                {automation.name}
                              </Pill>
                            </Link>
                          ))}
                    </p>
                  </div>
                  {canWrite && (
                    <Link href={`/admin/automation/sequences/${sequence.id}`} className={`${btn.secondary} shrink-0`}>
                      Edit
                    </Link>
                  )}
                </div>

                <ol className="mt-5 flex flex-wrap items-stretch gap-y-3">
                  {sequence.steps.map((step, i) => {
                    day += step.delayDays;
                    return (
                      <li key={step.id} className="flex items-center">
                        {i > 0 && (
                          <span className="mx-2 flex flex-col items-center text-[11px] text-slate-500">
                            <Clock className="h-3.5 w-3.5 text-amber-600" />
                            {step.delayDays} d
                          </span>
                        )}
                        <Link
                          href={`/admin/automation/templates/${step.template.id}`}
                          className="flex w-52 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-cyan-300 hover:bg-white"
                        >
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                            <Mail className="h-3.5 w-3.5 text-cyan-700" /> {step.name}
                          </span>
                          <span className="mt-1 line-clamp-2 text-xs text-slate-500">{step.template.subject}</span>
                          <span className="mt-2 text-[11px] font-semibold text-slate-400">{day === 0 ? "Immediately" : `Day ${day}`}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
