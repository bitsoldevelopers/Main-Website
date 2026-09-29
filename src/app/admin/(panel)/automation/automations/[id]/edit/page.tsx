import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { isConditionField, isConditionOperator } from "@/lib/automation/conditions";
import { getAutomation, listSequences } from "@/lib/automation/queries";
import { AutomationForm, type ConditionValue } from "@/components/admin/automation/AutomationForm";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Edit automation" };

export default async function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("outreach.write");
  const { id } = await params;
  const [result, sequences] = await Promise.all([getAutomation(id, { page: 1 }), listSequences()]);

  if (!result.ok || !sequences.ok) {
    return (
      <>
        <PageHeader eyebrow="Automations" title="Edit automation" />
        <DbUnavailable error={!result.ok ? result.error : !sequences.ok ? sequences.error : undefined} />
      </>
    );
  }
  if (!result.data) notFound();
  const { automation } = result.data;

  const conditions: ConditionValue[] = automation.conditions
    .filter((c) => c.kind === "ENTRY")
    .flatMap((c) => (isConditionField(c.field) && isConditionOperator(c.operator) ? [{ key: c.id, field: c.field, operator: c.operator, value: c.value ?? "" }] : []));

  return (
    <>
      <Link
        href={`/admin/automation/automations/${automation.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to the automation
      </Link>
      <PageHeader eyebrow="Automations" title={`Edit: ${automation.name}`} />
      <Panel className="max-w-4xl">
        <AutomationForm
          sequences={sequences.data.map((s) => ({ id: s.id, name: s.name, steps: s.steps.length }))}
          initial={{
            id: automation.id,
            name: automation.name,
            description: automation.description ?? "",
            sequenceId: automation.sequenceId,
            trigger: automation.trigger,
            createTask: automation.createTask,
            taskTitle: automation.taskTitle ?? "",
            taskNote: automation.taskNote ?? "",
            taskDueDays: automation.taskDueDays,
            conditions,
          }}
        />
      </Panel>
    </>
  );
}
