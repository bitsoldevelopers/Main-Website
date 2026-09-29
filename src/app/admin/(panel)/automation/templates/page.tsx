import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileText, Plus } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { TEMPLATE_VARIABLES, variablesIn } from "@/lib/automation/email/render";
import { listTemplates } from "@/lib/automation/queries";
import { Callout, DbUnavailable, EmptyState, PageHeader, Panel, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Email templates" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const sp = await searchParams;
  const saved = paramFrom(sp.saved);
  const error = paramFrom(sp.error);
  const result = await listTemplates();

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Email templates"
        description="The emails themselves. Each is filled in per lead from the CRM, so what a lead reads is about them."
        actions={
          canWrite ? (
            <Link href="/admin/automation/templates/new" className={btn.primary}>
              <Plus className="h-4 w-4" /> New template
            </Link>
          ) : null
        }
      />

      {saved && <Callout tone="green" icon={CheckCircle2} title={`Saved "${saved}"`} className="mb-6" />}
      {error && (
        <Callout tone="red" icon={AlertTriangle} title="That did not work" className="mb-6">
          {error}
        </Callout>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          {!result.ok ? (
            <DbUnavailable error={result.error} />
          ) : (
            <Panel bodyClassName="p-0">
              {result.data.length === 0 ? (
                <EmptyState icon={FileText} title="No templates yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Template</th>
                        <th className={thClass}>Used in</th>
                        <th className={`${thClass} text-right`}>Sent</th>
                        <th className={thClass}>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((template) => (
                        <tr key={template.id} className={trClass}>
                          <td className={tdClass}>
                            <Link href={`/admin/automation/templates/${template.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                              {template.name}
                            </Link>
                            <span className="mt-0.5 block text-xs text-slate-500">Subject: {template.subject}</span>
                            <span className="mt-1 flex flex-wrap gap-1">
                              {variablesIn(`${template.subject}\n${template.body}`).map((name) => (
                                <span key={name} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                                  {name}
                                </span>
                              ))}
                            </span>
                          </td>
                          <td className={`${tdClass} text-slate-500`}>
                            {template.steps.length === 0
                              ? "Not used"
                              : template.steps.map((step) => (
                                  <Link key={step.id} href={`/admin/automation/sequences/${step.sequence.id}`} className="block text-cyan-700 hover:underline">
                                    {step.sequence.name} › {step.name}
                                  </Link>
                                ))}
                          </td>
                          <td className={`${tdClass} text-right tabular-nums`}>{template._count.messages.toLocaleString()}</td>
                          <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(template.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}
        </div>

        <Panel title="Variables" description="Filled in from each lead's record. Nothing is guessed.">
          <dl className="space-y-3">
            {TEMPLATE_VARIABLES.map((variable) => (
              <div key={variable.name}>
                <dt className="font-mono text-xs font-semibold text-slate-900">{`{{${variable.name}}}`}</dt>
                <dd className="text-xs text-slate-500">
                  {variable.label} · {variable.source}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Usable in the subject, the body, the call to action and the follow-up task&apos;s title and note.
          </p>
        </Panel>
      </div>
    </>
  );
}
