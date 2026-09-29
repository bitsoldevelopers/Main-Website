import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listTemplates } from "@/lib/automation/queries";
import { SequenceForm } from "@/components/admin/automation/SequenceForm";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "New sequence" };

export default async function NewSequencePage() {
  await requireAdminPage("outreach.write");
  const templates = await listTemplates();

  return (
    <>
      <Link href="/admin/automation/sequences" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All sequences
      </Link>
      <PageHeader eyebrow="Sequences" title="New sequence" />
      {!templates.ok ? (
        <DbUnavailable error={templates.error} />
      ) : (
        <Panel>
          <SequenceForm templates={templates.data.map((t) => ({ id: t.id, name: t.name, subject: t.subject }))} />
        </Panel>
      )}
    </>
  );
}
