import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listKnowledge } from "@/lib/chatbot/queries";
import { PageHeader, Panel } from "@/components/admin/ui";
import { KnowledgeForm } from "@/components/admin/chatbot/KnowledgeForm";

export const metadata: Metadata = { title: "New knowledge entry" };

export default async function NewKnowledgePage() {
  await requireAdminPage("chatbot.write");
  const result = await listKnowledge();
  const categories = result.ok ? result.data.categories.map((c) => c.category) : [];

  return (
    <>
      <Link href="/admin/chatbot/knowledge" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Knowledge Base
      </Link>
      <PageHeader eyebrow="Chatbot" title="New entry" description="A question customers ask and the answer the assistant may give." />
      <Panel className="max-w-3xl">
        <KnowledgeForm categories={categories} />
      </Panel>
    </>
  );
}
