import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader, Panel } from "@/components/admin/ui";
import { TestimonialForm } from "@/components/admin/TestimonialForm";

export const metadata: Metadata = { title: "New testimonial" };

export default async function NewTestimonialPage() {
  await requireAdminPage("content.write");
  return (
    <>
      <Link href="/admin/testimonials" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All testimonials
      </Link>
      <PageHeader eyebrow="Content" title="New testimonial" />
      <Panel className="max-w-3xl">
        <TestimonialForm />
      </Panel>
    </>
  );
}
