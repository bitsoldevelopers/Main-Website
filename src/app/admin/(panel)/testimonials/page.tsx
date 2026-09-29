import type { Metadata } from "next";
import Link from "next/link";
import { Download, MessageSquareQuote, Pencil, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listTestimonials } from "@/lib/admin/queries-cms";
import { deleteTestimonial, importDefaultTestimonials, toggleTestimonial } from "@/app/admin/actions-cms";
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

export const metadata: Metadata = { title: "Testimonials" };

export default async function TestimonialsPage() {
  await requireAdminPage("content.write");
  const result = await listTestimonials();

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Testimonials"
        description="The Voices of Success card stack on the homepage. While this table is empty the site shows its built-in five cards."
        actions={
          <Link href="/admin/testimonials/new" className={btn.primary}>
            <Plus className="h-4 w-4" /> Add testimonial
          </Link>
        }
      />

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            icon={MessageSquareQuote}
            title="Serving the built-in testimonials"
            description="Import them to start editing from what is live today, or add your first real client quote."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <form action={importDefaultTestimonials}>
                  <SubmitButton variant="secondary" pendingText="Importing…">
                    <Download className="h-4 w-4" /> Import the current five
                  </SubmitButton>
                </form>
                <Link href="/admin/testimonials/new" className={btn.primary}>
                  <Plus className="h-4 w-4" /> Add testimonial
                </Link>
              </div>
            }
          />
        </Panel>
      ) : (
        <>
          <Callout tone="cyan" className="mb-6">
            Changes appear on the homepage within a minute (its cache revalidates on save). Unpublished rows are kept but not shown.
          </Callout>
          <Panel bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr>
                    <th className={thClass}>Client</th>
                    <th className={thClass}>Quote</th>
                    <th className={thClass}>Order</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((t) => (
                    <tr key={t.id} className={trClass}>
                      <td className={tdClass}>
                        <span className="block font-semibold text-slate-900">{t.company || t.name}</span>
                        <span className="block text-xs text-slate-500">
                          {t.name}
                          {t.title ? ` · ${t.title}` : ""}
                        </span>
                      </td>
                      <td className={`${tdClass} max-w-md text-slate-500`}>{truncate(t.quote, 120)}</td>
                      <td className={`${tdClass} tabular-nums text-slate-500`}>{t.order}</td>
                      <td className={tdClass}>
                        <Pill tone={t.published ? "green" : "slate"}>{t.published ? "Published" : "Hidden"}</Pill>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <form action={toggleTestimonial}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="published" value={String(!t.published)} />
                            <button type="submit" className={btn.ghost}>
                              {t.published ? "Hide" : "Publish"}
                            </button>
                          </form>
                          <Link href={`/admin/testimonials/${t.id}`} className={btn.icon} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          <form action={deleteTestimonial}>
                            <input type="hidden" name="id" value={t.id} />
                            <ConfirmButton message="Delete this testimonial?" variant="icon" className="hover:text-red-600">
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
