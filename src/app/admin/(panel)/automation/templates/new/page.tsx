import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getSenderSettings } from "@/lib/automation/queries";
import { TemplateForm } from "@/components/admin/automation/TemplateForm";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  await requireAdminPage("outreach.write");
  const sender = await getSenderSettings();

  return (
    <>
      <Link href="/admin/automation/templates" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All templates
      </Link>
      <PageHeader eyebrow="Templates" title="New template" />
      {!sender.ok ? (
        <DbUnavailable error={sender.error} />
      ) : (
        <Panel>
          <TemplateForm
            footer={{
              companyName: sender.data.settings.companyName,
              companyAddress: sender.data.settings.companyAddress,
              signature: sender.data.settings.signature,
              senderName: sender.data.settings.fromName,
            }}
          />
        </Panel>
      )}
    </>
  );
}
