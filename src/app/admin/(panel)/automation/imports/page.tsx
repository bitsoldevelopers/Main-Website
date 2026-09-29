import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { leadSourceLabel } from "@/lib/admin/leads";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { importBadge } from "@/lib/automation/labels";
import { listImports } from "@/lib/automation/queries";
import { DbUnavailable, EmptyState, LinkTabs, PageHeader, Pagination, Panel, Pill, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Imports" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function ImportsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const sp = await searchParams;
  const source = paramFrom(sp.source);
  const result = await listImports({ page: pageFrom(sp.page), source: source || undefined });
  const href = (s: string, page = 1) => {
    const params = new URLSearchParams();
    if (s) params.set("source", s);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/admin/automation/imports?${qs}` : "/admin/automation/imports";
  };

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Imports"
        description="Every batch that was brought in: what it created, updated, skipped and rejected."
        actions={
          <Link href="/admin/automation/sources" className={btn.primary}>
            New import
          </Link>
        }
      />

      <div className="mb-4">
        <LinkTabs
          current={source}
          tabs={[
            { label: "All", value: "", href: href("") },
            { label: "Google Sheets", value: "google_sheets", href: href("google_sheets") },
            { label: "CSV", value: "csv", href: href("csv") },
          ]}
        />
      </div>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <Panel bodyClassName="p-0">
          {result.data.items.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No imports yet" description="Imports appear here as soon as one is started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr>
                    <th className={thClass}>Import</th>
                    <th className={thClass}>Status</th>
                    <th className={`${thClass} text-right`}>Rows</th>
                    <th className={`${thClass} text-right`}>New</th>
                    <th className={`${thClass} text-right`}>Updated</th>
                    <th className={`${thClass} text-right`}>Duplicates</th>
                    <th className={`${thClass} text-right`}>Invalid</th>
                    <th className={`${thClass} text-right`}>Skipped</th>
                    <th className={`${thClass} text-right`}>Automation</th>
                    <th className={thClass}>Started</th>
                    <th className={thClass}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((batch) => {
                    const badge = importBadge(batch.status);
                    return (
                      <tr key={batch.id} className={trClass}>
                        <td className={tdClass}>
                          <Link href={`/admin/automation/imports/${batch.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                            {batch.label}
                          </Link>
                          <span className="block text-xs text-slate-500">
                            {leadSourceLabel(batch.sourceType)} · {batch.trigger === "SCHEDULED" ? "automatic sync" : batch.startedBy}
                          </span>
                          {batch.error && <span className="mt-1 block max-w-sm text-xs text-red-600">{batch.error}</span>}
                        </td>
                        <td className={tdClass}>
                          <Pill tone={badge.tone}>{badge.label}</Pill>
                        </td>
                        <td className={`${tdClass} text-right tabular-nums`}>{batch.totalRows.toLocaleString()}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{batch.createdCount.toLocaleString()}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{batch.updatedCount.toLocaleString()}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{batch.duplicateCount.toLocaleString()}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{(batch.invalidCount + batch.failedCount).toLocaleString()}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{batch.skippedCount.toLocaleString()}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{batch.automationStarted.toLocaleString()}</td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(batch.createdAt, { time: true })}>
                          {timeAgo(batch.createdAt)}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <Link href={`/admin/automation/imports/${batch.id}`} className={btn.ghost}>
                            Open <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={result.data.page}
            totalPages={result.data.totalPages}
            total={result.data.total}
            noun={result.data.total === 1 ? "import" : "imports"}
            hrefFor={(n) => href(source, n)}
          />
        </Panel>
      )}
    </>
  );
}
