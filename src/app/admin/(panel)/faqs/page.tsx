import type { Metadata } from "next";
import Link from "next/link";
import { Download, HelpCircle, Pencil, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listFaqs } from "@/lib/admin/queries-cms";
import { deleteFaq, importDefaultFaqs, toggleFaq } from "@/app/admin/actions-cms";
import { truncate } from "@/lib/admin/format";
import {
  Callout,
  DbUnavailable,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  btn,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";

export const metadata: Metadata = { title: "FAQs" };

export default async function FaqsPage() {
  await requireAdminPage("content.write");
  const result = await listFaqs();

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="FAQs"
        description="The homepage FAQ accordion, also emitted as FAQPage schema for Google. While this table is empty the site shows its built-in six questions."
        actions={
          <Link href="/admin/faqs/new" className={btn.primary}>
            <Plus className="h-4 w-4" /> Add FAQ
          </Link>
        }
      />

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            icon={HelpCircle}
            title="Serving the built-in FAQ"
            description="Import the current six questions to start editing from what is live today."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <form action={importDefaultFaqs}>
                  <SubmitButton variant="secondary" pendingText="Importing…">
                    <Download className="h-4 w-4" /> Import the current six
                  </SubmitButton>
                </form>
                <Link href="/admin/faqs/new" className={btn.primary}>
                  <Plus className="h-4 w-4" /> Add FAQ
                </Link>
              </div>
            }
          />
        </Panel>
      ) : (
        <>
          <Callout tone="cyan" className="mb-6">
            Changes appear on the homepage within a minute. Keep answers factual — they feed the FAQPage schema Google reads.
          </Callout>
          <Panel bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className={thClass}>Question</th>
                    <th className={thClass}>Answer</th>
                    <th className={thClass}>Order</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((faq) => (
                    <tr key={faq.id} className={trClass}>
                      <td className={`${tdClass} max-w-xs font-semibold text-slate-900`}>{truncate(faq.question, 80)}</td>
                      <td className={`${tdClass} max-w-md text-slate-500`}>{truncate(faq.answer, 110)}</td>
                      <td className={`${tdClass} tabular-nums text-slate-500`}>{faq.order}</td>
                      <td className={tdClass}>
                        <Pill tone={faq.published ? "green" : "slate"}>{faq.published ? "Published" : "Hidden"}</Pill>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <form action={toggleFaq}>
                            <input type="hidden" name="id" value={faq.id} />
                            <input type="hidden" name="published" value={String(!faq.published)} />
                            <button type="submit" className={btn.ghost}>
                              {faq.published ? "Hide" : "Publish"}
                            </button>
                          </form>
                          <Link href={`/admin/faqs/${faq.id}`} className={btn.icon} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <form action={deleteFaq}>
                            <input type="hidden" name="id" value={faq.id} />
                            <ConfirmButton message="Delete this FAQ?" variant="icon" className="hover:text-red-600">
                              ✕
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
