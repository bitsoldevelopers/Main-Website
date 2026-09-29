import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDate, truncate } from "@/lib/admin/format";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { listCompanies } from "@/lib/automation/lead-queries";
import { DbUnavailable, EmptyState, PageHeader, Pagination, Panel, btn, inputClass, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Companies" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("leads.read");
  const sp = await searchParams;
  const q = paramFrom(sp.q);
  const result = await listCompanies({ page: pageFrom(sp.page), q: q || undefined });

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Companies"
        description="One record per organisation, however many of its people are leads. Created as leads are imported or edited."
      />

      <form method="get" action="/admin/companies" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input type="search" name="q" defaultValue={q} placeholder="Name, domain or description" className={`${inputClass} w-80 bg-white pl-9`} aria-label="Search companies" />
        </div>
        <button type="submit" className={btn.secondary}>
          Search
        </button>
        {q && (
          <Link href="/admin/companies" className={btn.ghost}>
            Clear
          </Link>
        )}
      </form>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <Panel bodyClassName="p-0">
          {result.data.items.length === 0 ? (
            <EmptyState icon={Building2} title={q ? "No company matches" : "No companies yet"} description={q ? undefined : "They appear when leads with a company name are imported."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className={thClass}>Company</th>
                    <th className={thClass}>Description</th>
                    <th className={`${thClass} text-right`}>Contacts</th>
                    <th className={thClass}>Added</th>
                    <th className={thClass}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((company) => (
                    <tr key={company.id} className={trClass}>
                      <td className={tdClass}>
                        <Link href={`/admin/companies/${company.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                          {company.name}
                        </Link>
                        {company.domain && <span className="block text-xs text-slate-500">{company.domain}</span>}
                      </td>
                      <td className={`${tdClass} max-w-md text-slate-500`}>{company.description ? truncate(company.description, 120) : <span className="text-slate-300">—</span>}</td>
                      <td className={`${tdClass} text-right tabular-nums`}>{company._count.leads.toLocaleString()}</td>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(company.createdAt)}</td>
                      <td className={`${tdClass} text-right`}>
                        <Link href={`/admin/companies/${company.id}`} className={btn.ghost}>
                          Open <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={result.data.page}
            totalPages={result.data.totalPages}
            total={result.data.total}
            noun={result.data.total === 1 ? "company" : "companies"}
            hrefFor={(n) => `/admin/companies?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}`}
          />
        </Panel>
      )}
    </>
  );
}
