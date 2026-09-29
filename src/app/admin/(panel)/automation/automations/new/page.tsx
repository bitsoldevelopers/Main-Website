import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listSequences } from "@/lib/automation/queries";
import { AutomationForm } from "@/components/admin/automation/AutomationForm";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "New automation" };

export default async function NewAutomationPage() {
  await requireAdminPage("outreach.write");
  const sequences = await listSequences();

  return (
    <>
      <Link href="/admin/automation/automations" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All automations
      </Link>
      <PageHeader eyebrow="Automations" title="New automation" />
      {!sequences.ok ? (
        <DbUnavailable error={sequences.error} />
      ) : (
        <Panel className="max-w-4xl">
          <AutomationForm sequences={sequences.data.map((s) => ({ id: s.id, name: s.name, steps: s.steps.length }))} />
        </Panel>
      )}
    </>
  );
}
