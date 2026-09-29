import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/auth";
import { safe } from "@/lib/admin/queries";
import { deleteSequence } from "@/app/admin/actions-automation";
import { getSequence, listTemplates } from "@/lib/automation/queries";
import { SequenceForm } from "@/components/admin/automation/SequenceForm";
import { ConfirmButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Edit sequence" };

export default async function EditSequencePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("outreach.write");
  const { id } = await params;
  const [result, templates, runs] = await Promise.all([
    getSequence(id),
    listTemplates(),
    safe(() => prisma.automationRun.count({ where: { status: { in: ["ACTIVE", "PAUSED"] }, automation: { sequenceId: id } } })),
  ]);

  if (!result.ok || !templates.ok) {
    return (
      <>
        <PageHeader eyebrow="Sequences" title="Edit sequence" />
        <DbUnavailable error={!result.ok ? result.error : !templates.ok ? templates.error : undefined} />
      </>
    );
  }
  const sequence = result.data;
  if (!sequence) notFound();

  return (
    <>
      <Link href="/admin/automation/sequences" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All sequences
      </Link>
      <PageHeader eyebrow="Sequences" title={sequence.name} description={sequence.description ?? undefined} />

      <Panel className="mb-6">
        <SequenceForm
          templates={templates.data.map((t) => ({ id: t.id, name: t.name, subject: t.subject }))}
          activeRuns={runs.ok ? runs.data : 0}
          initial={{
            id: sequence.id,
            name: sequence.name,
            description: sequence.description ?? "",
            steps: sequence.steps.map((step) => ({ key: step.id, id: step.id, name: step.name, delayDays: step.delayDays, templateId: step.templateId })),
          }}
        />
      </Panel>

      <Panel title="Danger zone" className="max-w-md">
        {sequence.automations.length > 0 ? (
          <p className="text-sm text-slate-500">
            Used by {sequence.automations.map((a) => a.name).join(", ")}. Change or delete {sequence.automations.length === 1 ? "that automation" : "those automations"} before
            deleting the sequence.
          </p>
        ) : (
          <form action={deleteSequence}>
            <input type="hidden" name="id" value={sequence.id} />
            <ConfirmButton message={`Delete the sequence "${sequence.name}"? Its templates are kept.`} className="w-full">
              Delete sequence
            </ConfirmButton>
          </form>
        )}
      </Panel>
    </>
  );
}
