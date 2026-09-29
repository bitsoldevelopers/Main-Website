import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet, Globe, Keyboard, Plug, Upload, type LucideIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { timeAgo } from "@/lib/admin/format";
import { listSources } from "@/lib/automation/queries";
import { SOURCE_TYPES, type SourceType } from "@/lib/automation/sources/types";
import { DbUnavailable, PageHeader, Pill, btn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Lead sources" };

const ICONS: Partial<Record<SourceType, LucideIcon>> = {
  google_sheets: FileSpreadsheet,
  csv: Upload,
  website: Globe,
  manual: Keyboard,
};

const ACTIONS: Partial<Record<SourceType, { label: string; href: string }>> = {
  google_sheets: { label: "Open", href: "/admin/automation/sources/google-sheets" },
  csv: { label: "Upload a file", href: "/admin/automation/sources/csv" },
  website: { label: "View leads", href: "/admin/leads?source=website" },
  manual: { label: "Add a lead", href: "/admin/leads/new" },
};

export default async function SourcesPage() {
  await requireAdminPage("outreach.read");
  const result = await listSources();

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Sources"
        description="Where leads come from. Every source feeds the same CRM and goes through the same validation, duplicate check and automation."
      />

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(Object.keys(SOURCE_TYPES) as SourceType[]).map((type) => {
            const info = SOURCE_TYPES[type];
            const summary = result.data.find((row) => row.type === type);
            const Icon = ICONS[type] ?? Plug;
            const action = ACTIONS[type];
            return (
              <section
                key={type}
                className={`flex flex-col rounded-2xl border bg-white p-5 shadow-sm ${info.available ? "border-slate-200" : "border-dashed border-slate-300 bg-slate-50"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${info.available ? "bg-cyan-50 text-cyan-700" : "bg-slate-200 text-slate-500"}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <Pill tone={info.available ? "green" : "slate"}>{info.available ? "Available" : "Planned"}</Pill>
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-900">{info.label}</h2>
                <p className="mt-1 text-sm text-slate-500">{info.description}</p>

                {info.available && (
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Leads</dt>
                      <dd className="mt-0.5 text-lg font-bold text-slate-900">{(summary?.leads ?? 0).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Latest</dt>
                      <dd className="mt-0.5 text-slate-700">{summary?.lastLeadAt ? timeAgo(summary.lastLeadAt) : "—"}</dd>
                    </div>
                  </dl>
                )}

                {summary && summary.sources.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-slate-500">
                    {summary.sources.slice(0, 4).map((source) => (
                      <li key={source.id} className="flex items-center justify-between gap-3">
                        <span className="truncate">{source.name}</span>
                        <span className="shrink-0 tabular-nums">{source.leads.toLocaleString()}</span>
                      </li>
                    ))}
                    {summary.sources.length > 4 && <li>and {summary.sources.length - 4} more</li>}
                  </ul>
                )}

                <div className="mt-auto pt-5">
                  {info.available && action ? (
                    <Link href={action.href} className={btn.secondary}>
                      {action.label} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <p className="text-xs text-slate-500">Not built yet. When it is, it plugs into the same import pipeline.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
