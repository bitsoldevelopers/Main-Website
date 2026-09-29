import type { Metadata } from "next";
import Link from "next/link";
import { List, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getLeadBoard } from "@/lib/admin/queries-crm";
import { DbUnavailable, PageHeader, btn } from "@/components/admin/ui";
import { LeadBoard } from "@/components/admin/LeadBoard";

export const metadata: Metadata = { title: "Pipeline board" };

export default async function LeadBoardPage() {
  await requireAdminPage("leads.read");
  const result = await getLeadBoard();

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Pipeline board"
        description="Drag a card to change its status. Each column shows the newest leads; the full list has filters and search."
        actions={
          <>
            <Link href="/admin/leads" className={btn.secondary}>
              <List className="h-4 w-4" /> List view
            </Link>
            <Link href="/admin/leads/new" className={btn.primary}>
              <Plus className="h-4 w-4" /> Add lead
            </Link>
          </>
        }
      />
      {!result.ok ? <DbUnavailable error={result.error} /> : <LeadBoard initial={result.data} />}
    </>
  );
}
