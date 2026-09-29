import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listAssignees } from "@/lib/admin/queries-crm";
import { SHEET_COLUMNS } from "@/lib/automation/columns";
import { listActiveAutomations } from "@/lib/automation/queries";
import { ImportWizard } from "@/components/admin/automation/ImportWizard";
import { PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "CSV upload" };

export default async function CsvImportPage() {
  await requireAdminPage("outreach.write");
  const [automations, assignees] = await Promise.all([listActiveAutomations(), listAssignees()]);

  return (
    <>
      <Link href="/admin/automation/sources" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All sources
      </Link>

      <PageHeader
        eyebrow="Sources"
        title="Import leads from a CSV"
        description="For a one-off import, or while Google Sheets is not connected. The file goes through exactly the same checks as a linked sheet."
      />

      <Panel className="mb-6">
        <ImportWizard
          source="csv"
          automations={automations.ok ? automations.data : []}
          assignees={assignees.ok ? assignees.data.map((u) => ({ id: u.id, name: u.name || u.email })) : []}
        />
      </Panel>

      <Panel title="Expected columns" description="Titles are matched whatever their case or spacing; extra columns are kept with the row but not imported.">
        <div className="flex flex-wrap gap-1.5">
          {SHEET_COLUMNS.map((column) => (
            <span key={column.field} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
              {column.header}
            </span>
          ))}
        </div>
      </Panel>
    </>
  );
}
