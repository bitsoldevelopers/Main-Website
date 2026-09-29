import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { leadKind } from "@/lib/admin/leads";
import { getLeadProfile } from "@/lib/automation/lead-queries";
import { LeadProfileForm } from "@/components/admin/automation/LeadProfileForm";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Edit lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("leads.write");
  const { id } = await params;
  const result = await getLeadProfile(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="CRM" title="Edit lead" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  if (!result.data) notFound();
  const { lead } = result.data;

  // Leads from the website forms only have a full name; split it for the form.
  const [first = "", ...rest] = lead.name.trim().split(/\s+/);
  const named = Boolean(lead.firstName || lead.lastName);
  const email = (type: string) => lead.emails.find((e) => e.type === type)?.email ?? "";
  const phone = (type: string) => lead.phones.find((p) => p.type === type)?.phone ?? "";

  return (
    <>
      <Link href={`/admin/leads/${lead.id}`} className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to the lead
      </Link>
      <PageHeader eyebrow="CRM" title={`Edit: ${lead.name}`} />
      <Panel className="max-w-5xl">
        <LeadProfileForm
          initial={{
            id: lead.id,
            kind: leadKind(lead.subject),
            firstName: named ? (lead.firstName ?? "") : first,
            lastName: named ? (lead.lastName ?? "") : rest.join(" "),
            jobTitle: lead.jobTitle ?? "",
            company: lead.company ?? "",
            website: lead.website ?? "",
            linkedinUrl: lead.linkedinUrl ?? "",
            contactLocation: lead.contactLocation ?? "",
            city: lead.city ?? "",
            country: lead.country ?? "",
            companyDescription: lead.companyDescription ?? "",
            emails: {
              PRIMARY: email("PRIMARY") || (lead.emails.length === 0 ? lead.email : ""),
              SECONDARY: email("SECONDARY"),
              PERSONAL: email("PERSONAL"),
            },
            phones: {
              PRIMARY: phone("PRIMARY") || (lead.phones.length === 0 ? (lead.phone ?? "") : ""),
              SECONDARY: phone("SECONDARY"),
              TERTIARY: phone("TERTIARY"),
              COMPANY: phone("COMPANY"),
            },
            subject: lead.subject,
            message: lead.message,
            status: lead.status,
            priority: lead.priority,
          }}
        />
      </Panel>
    </>
  );
}
