import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { LeadProfileForm } from "@/components/admin/automation/LeadProfileForm";
import { PageHeader, Panel, btn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Add lead" };

export default async function NewLeadPage() {
  await requireAdminPage("leads.write");
  return (
    <>
      <Link href="/admin/leads" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All leads
      </Link>
      <PageHeader
        eyebrow="CRM"
        title="Add a lead"
        description="For leads that arrive outside the website — WhatsApp, referrals, events. Website submissions create themselves, and a whole list is quicker to import."
        actions={
          <Link href="/admin/automation/sources" className={btn.secondary}>
            <FileSpreadsheet className="h-4 w-4" /> Import a list
          </Link>
        }
      />
      <Panel className="max-w-5xl">
        <LeadProfileForm />
      </Panel>
    </>
  );
}
