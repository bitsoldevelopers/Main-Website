import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader, Panel } from "@/components/admin/ui";
import { FaqForm } from "@/components/admin/FaqForm";

export const metadata: Metadata = { title: "New FAQ" };

export default async function NewFaqPage() {
  await requireAdminPage("content.write");
  return (
    <>
      <Link href="/admin/faqs" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All FAQs
      </Link>
      <PageHeader eyebrow="Content" title="New FAQ" />
      <Panel className="max-w-3xl">
        <FaqForm />
      </Panel>
    </>
  );
}
