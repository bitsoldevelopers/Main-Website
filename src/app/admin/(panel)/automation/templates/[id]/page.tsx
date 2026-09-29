import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { deleteTemplate } from "@/app/admin/actions-automation";
import { getSenderSettings, getTemplate } from "@/lib/automation/queries";
import { TemplateForm } from "@/components/admin/automation/TemplateForm";
import { ConfirmButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Edit template" };

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("outreach.write");
  const { id } = await params;
  const [result, sender] = await Promise.all([getTemplate(id), getSenderSettings()]);

  if (!result.ok || !sender.ok) {
    return (
      <>
        <PageHeader eyebrow="Templates" title="Edit template" />
        <DbUnavailable error={!result.ok ? result.error : !sender.ok ? sender.error : undefined} />
      </>
    );
  }
  const template = result.data;
  if (!template) notFound();

  return (
    <>
      <Link href="/admin/automation/templates" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All templates
      </Link>
      <PageHeader
        eyebrow="Templates"
        title={template.name}
        description={
          template.steps.length > 0
            ? `Used in ${template.steps.map((step) => `${step.sequence.name} › ${step.name}`).join(", ")}. Changes apply to emails sent from now on.`
            : "Not used by any sequence yet."
        }
      />

      <Panel className="mb-6">
        <TemplateForm
          initial={{
            id: template.id,
            name: template.name,
            subject: template.subject,
            body: template.body,
            ctaLabel: template.ctaLabel ?? "",
            ctaUrl: template.ctaUrl ?? "",
          }}
          footer={{
            companyName: sender.data.settings.companyName,
            companyAddress: sender.data.settings.companyAddress,
            signature: sender.data.settings.signature,
            senderName: sender.data.settings.fromName,
          }}
        />
      </Panel>

      <Panel title="Danger zone" className="max-w-md">
        {template.steps.length > 0 ? (
          <p className="text-sm text-slate-500">This template is part of a sequence. Replace it there before deleting it.</p>
        ) : (
          <form action={deleteTemplate}>
            <input type="hidden" name="id" value={template.id} />
            <ConfirmButton message={`Delete the template "${template.name}"?`} className="w-full">
              Delete template
            </ConfirmButton>
          </form>
        )}
      </Panel>
    </>
  );
}
