import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getKnowledge, listKnowledge } from "@/lib/chatbot/queries";
import { truncate } from "@/lib/admin/format";
import { DbUnavailable, PageHeader, Panel } from "@/components/admin/ui";
import { KnowledgeForm } from "@/components/admin/chatbot/KnowledgeForm";

export const metadata: Metadata = { title: "Edit knowledge entry" };

export default async function EditKnowledgePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("chatbot.write");
  const { id } = await params;
  const [result, list] = await Promise.all([getKnowledge(id), listKnowledge()]);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Chatbot" title="Edit entry" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  const entry = result.data;
  if (!entry) notFound();
  const keywords = Array.isArray(entry.keywords) ? (entry.keywords as unknown[]).filter((k): k is string => typeof k === "string") : [];

  return (
    <>
      <Link href="/admin/chatbot/knowledge" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Knowledge Base
      </Link>
      <PageHeader eyebrow="Chatbot" title={`Edit: ${truncate(entry.question, 60)}`} description={`Version ${entry.version} · the assistant uses the saved text within 30 seconds.`} />
      <Panel className="max-w-3xl">
        <KnowledgeForm
          categories={list.ok ? list.data.categories.map((c) => c.category) : []}
          initial={{
            id: entry.id,
            slug: entry.slug,
            question: entry.question,
            answer: entry.answer,
            category: entry.category,
            kind: entry.kind,
            state: entry.state,
            keywords,
            sortOrder: entry.sortOrder,
          }}
        />
      </Panel>
    </>
  );
}
