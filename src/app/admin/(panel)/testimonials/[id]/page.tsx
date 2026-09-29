import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getTestimonial } from "@/lib/admin/queries-cms";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";
import { TestimonialForm } from "@/components/admin/TestimonialForm";

export const metadata: Metadata = { title: "Edit testimonial" };

export default async function EditTestimonialPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("content.write");
  const { id } = await params;
  const result = await getTestimonial(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Content" title="Edit testimonial" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  const t = result.data;
  if (!t) notFound();

  return (
    <>
      <Link href="/admin/testimonials" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All testimonials
      </Link>
      <PageHeader eyebrow="Content" title={`Edit: ${t.company || t.name}`} />
      <Panel className="max-w-3xl">
        <TestimonialForm
          initial={{
            id: t.id,
            name: t.name,
            title: t.title,
            company: t.company ?? "",
            quote: t.quote,
            order: t.order,
            published: t.published,
          }}
        />
      </Panel>
    </>
  );
}
