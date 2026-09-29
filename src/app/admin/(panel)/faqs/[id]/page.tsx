import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getFaq } from "@/lib/admin/queries-cms";
import { truncate } from "@/lib/admin/format";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";
import { FaqForm } from "@/components/admin/FaqForm";

export const metadata: Metadata = { title: "Edit FAQ" };

export default async function EditFaqPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("content.write");
  const { id } = await params;
  const result = await getFaq(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Content" title="Edit FAQ" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  const faq = result.data;
  if (!faq) notFound();

  return (
    <>
      <Link href="/admin/faqs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All FAQs
      </Link>
      <PageHeader eyebrow="Content" title={`Edit: ${truncate(faq.question, 60)}`} />
      <Panel className="max-w-3xl">
        <FaqForm
          initial={{
            id: faq.id,
            question: faq.question,
            answer: faq.answer,
            page: faq.page,
            order: faq.order,
            published: faq.published,
          }}
        />
      </Panel>
    </>
  );
}
