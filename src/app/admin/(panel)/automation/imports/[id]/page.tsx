import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileSpreadsheet, RefreshCw, Users } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { leadSourceLabel } from "@/lib/admin/leads";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { resolveReview, syncWorksheetNow } from "@/app/admin/actions-import";
import { COLUMN_BY_FIELD, isCrmField } from "@/lib/automation/columns";
import { MATCH_LEVELS, type QualityReport } from "@/lib/automation/import-parse";
import { importBadge, outcomeBadge } from "@/lib/automation/labels";
import { getImport } from "@/lib/automation/queries";
import { ASSIGNMENT_MODES, DUPLICATE_MODES, parseImportSettings } from "@/lib/automation/sources/types";
import { AutoRefresh } from "@/components/admin/automation/AutoRefresh";
import { Figure } from "@/components/admin/automation/parts";
import { SubmitButton } from "@/components/admin/SubmitButton";
import { Callout, DbUnavailable, EmptyState, KeyValue, LinkTabs, PageHeader, Pagination, Panel, Pill, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Import" };

type SearchParams = Record<string, string | string[] | undefined>;

const TABS: { value: string; label: string; outcomes: string[] }[] = [
  { value: "", label: "All rows", outcomes: [] },
  { value: "CREATED", label: "New", outcomes: ["CREATED"] },
  { value: "UPDATED", label: "Updated", outcomes: ["UPDATED"] },
  { value: "problems", label: "Errors and duplicates", outcomes: ["INVALID", "FAILED", "DUPLICATE", "REVIEW"] },
  { value: "REVIEW", label: "Needs review", outcomes: ["REVIEW"] },
  { value: "INVALID", label: "Invalid", outcomes: ["INVALID"] },
  { value: "FAILED", label: "Failed", outcomes: ["FAILED"] },
];

function matchLabel(level: string | null): string | null {
  if (!level) return null;
  if (level in MATCH_LEVELS) return MATCH_LEVELS[level as keyof typeof MATCH_LEVELS].label;
  return level === "SOURCE_ROW" ? "Same source row" : level;
}

export default async function ImportDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const { id } = await params;
  const sp = await searchParams;
  const outcome = paramFrom(sp.outcome);
  const result = await getImport(id, { page: pageFrom(sp.page), outcome: outcome || undefined });

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Imports" title="Import" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  if (!result.data) notFound();
  const { batch, outcomes, rows } = result.data;

  const badge = importBadge(batch.status);
  const running = batch.status === "QUEUED" || batch.status === "RUNNING";
  const settings = parseImportSettings(batch.settings);
  const quality = (batch.quality ?? null) as (Partial<QualityReport> & { warnings?: string[]; missingColumns?: string[] }) | null;
  const href = (value: string, page = 1) => {
    const query = new URLSearchParams();
    if (value) query.set("outcome", value);
    if (page > 1) query.set("page", String(page));
    const qs = query.toString();
    return `/admin/automation/imports/${batch.id}${qs ? `?${qs}` : ""}`;
  };
  const count = (values: string[]) => (values.length === 0 ? Object.values(outcomes).reduce((a, b) => a + b, 0) : values.reduce((n, v) => n + (outcomes[v] ?? 0), 0));

  return (
    <>
      <Link href="/admin/automation/imports" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All imports
      </Link>

      <PageHeader
        eyebrow={`${leadSourceLabel(batch.sourceType)} import`}
        title={batch.label}
        description={
          <>
            {batch.trigger === "SCHEDULED" ? "Automatic sync" : `Started by ${batch.startedBy}`} on {formatDate(batch.createdAt, { time: true })}
            {batch.finishedAt && batch.startedAt && ` · took ${Math.max(1, Math.round((batch.finishedAt.getTime() - batch.startedAt.getTime()) / 1000))} s`}
          </>
        }
        actions={
          <>
            <Pill tone={badge.tone}>{badge.label}</Pill>
            <Link href={`/admin/leads?importId=${batch.id}`} className={btn.secondary}>
              <Users className="h-4 w-4" /> View leads
            </Link>
            {canWrite && batch.worksheetId && !running && (
              <form action={syncWorksheetNow}>
                <input type="hidden" name="id" value={batch.worksheetId} />
                <SubmitButton variant="secondary" pendingText="Queuing…">
                  <RefreshCw className="h-4 w-4" /> Sync again
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {running && (
        <div className="mb-6">
          <AutoRefresh label={batch.status === "QUEUED" ? "Waiting for the queue…" : `Importing… ${batch.totalRows.toLocaleString()} rows so far`} />
        </div>
      )}
      {batch.error && (
        <Callout tone="red" icon={AlertTriangle} title="The import failed" className="mb-6">
          {batch.error}
        </Callout>
      )}
      {quality?.warnings && quality.warnings.length > 0 && (
        <Callout tone="amber" icon={AlertTriangle} title="Worth knowing" className="mb-6">
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {quality.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Callout>
      )}
      {quality?.missingColumns && quality.missingColumns.length > 0 && (
        <Callout tone="amber" title="Columns that were not in the source" className="mb-6">
          {quality.missingColumns.map((header) => `⚠ ${header} column not found.`).join(" ")}
        </Callout>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Total rows" value={batch.totalRows.toLocaleString()} href={href("")} />
        <Figure label="New leads" value={batch.createdCount.toLocaleString()} tone="green" href={href("CREATED")} />
        <Figure label="Updated" value={batch.updatedCount.toLocaleString()} tone="cyan" href={href("UPDATED")} />
        <Figure label="Duplicates" value={batch.duplicateCount.toLocaleString()} tone={batch.duplicateCount ? "amber" : "slate"} href={href("DUPLICATE")} hint={outcomes.REVIEW ? `${outcomes.REVIEW} waiting for review` : undefined} />
        <Figure label="Invalid" value={batch.invalidCount.toLocaleString()} tone={batch.invalidCount ? "red" : "slate"} href={href("INVALID")} />
        <Figure label="Skipped" value={batch.skippedCount.toLocaleString()} hint="Already up to date" href={href("UNCHANGED")} />
        <Figure label="Failed" value={batch.failedCount.toLocaleString()} tone={batch.failedCount ? "red" : "slate"} href={href("FAILED")} />
        <Figure label="Automation started" value={batch.automationStarted.toLocaleString()} tone="purple" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div>
            <div className="mb-3">
              <LinkTabs current={outcome} tabs={TABS.map((tab) => ({ label: tab.label, value: tab.value, href: href(tab.value), count: count(tab.outcomes) }))} />
            </div>
            <Panel bodyClassName="p-0">
              {rows.items.length === 0 ? (
                <EmptyState
                  icon={FileSpreadsheet}
                  title={running ? "Rows appear here as they are processed" : "No rows here"}
                  description={
                    batch.sourceType === "google_sheets" && !running
                      ? "For a linked worksheet, rows that did not change since an earlier sync are listed with the import that last changed them."
                      : undefined
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Row</th>
                        <th className={thClass}>Contact in the source</th>
                        <th className={thClass}>Result</th>
                        <th className={thClass}>Lead</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.items.map((row) => {
                        const rowBadge = outcomeBadge(row.outcome);
                        const raw = (row.raw ?? {}) as Record<string, string>;
                        const value = (field: string) => (isCrmField(field) && settings.mapping[field] ? (raw[settings.mapping[field] as string] ?? "") : "");
                        const name = [value("first_name"), value("last_name")].filter(Boolean).join(" ");
                        const match = matchLabel(row.matchLevel);
                        return (
                          <tr key={row.id} className={trClass}>
                            <td className={`${tdClass} tabular-nums text-slate-500`}>{row.rowNumber}</td>
                            <td className={tdClass}>
                              <span className="block font-semibold text-slate-900">{name || value("company_name") || <span className="font-normal text-slate-400">No name</span>}</span>
                              <span className="block text-xs text-slate-500">
                                {[value("job_title"), name ? value("company_name") : ""].filter(Boolean).join(" · ")}
                              </span>
                              <span className="block text-xs text-slate-500">{value("email_primary") || value("email_secondary") || value("email_personal")}</span>
                              <details className="mt-1.5">
                                <summary className="cursor-pointer text-xs font-semibold text-cyan-700 hover:underline">Source values</summary>
                                <dl className="mt-2 grid max-w-xl gap-x-4 gap-y-1 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)]">
                                  {Object.entries(raw).map(([header, cell]) => (
                                    <div key={header} className="contents">
                                      <dt className="font-semibold text-slate-500">{header}</dt>
                                      <dd className="min-w-0 whitespace-pre-wrap break-words text-slate-800">{cell || <span className="text-slate-300">—</span>}</dd>
                                    </div>
                                  ))}
                                </dl>
                              </details>
                            </td>
                            <td className={tdClass}>
                              <Pill tone={rowBadge.tone}>{rowBadge.label}</Pill>
                              {match && <span className="mt-1 block text-xs text-slate-500">Matched by: {match}</span>}
                              {row.message && <span className="mt-1 block max-w-sm text-xs text-slate-600">{row.message}</span>}
                              {row.outcome === "REVIEW" && canWrite && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {(
                                    [
                                      ["UPDATE", "Update the lead"],
                                      ["CREATE", "Create a separate lead"],
                                      ["DISMISS", "Keep as is"],
                                    ] as const
                                  ).map(([decision, label]) => (
                                    <form key={decision} action={resolveReview}>
                                      <input type="hidden" name="rowId" value={row.id} />
                                      <input type="hidden" name="decision" value={decision} />
                                      <SubmitButton variant={decision === "UPDATE" ? "primary" : "secondary"} pendingText="…" className="px-3 py-1.5 text-xs">
                                        {label}
                                      </SubmitButton>
                                    </form>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className={tdClass}>
                              {row.lead ? (
                                <Link href={`/admin/leads/${row.lead.id}`} className="font-semibold text-cyan-700 hover:underline">
                                  {row.lead.name}
                                </Link>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination page={rows.page} totalPages={rows.totalPages} total={rows.total} noun={rows.total === 1 ? "row" : "rows"} hrefFor={(n) => href(outcome, n)} />
            </Panel>
          </div>
        </div>

        <div className="space-y-6">
          {quality && typeof quality.totalRows === "number" && (
            <Panel title="Data quality" description="Of the source, before anything was written">
              <dl className="divide-y divide-slate-100 text-sm">
                {(
                  [
                    ["Total rows", quality.totalRows],
                    ["Valid emails", quality.validEmails],
                    ["Risky emails", quality.riskyEmails],
                    ["Invalid emails", quality.invalidEmails],
                    ["Missing emails", quality.missingEmails],
                    ["Duplicate emails", quality.duplicateEmails],
                    ["Missing names", quality.missingNames],
                    ["Missing companies", quality.missingCompanies],
                    ["Missing websites", quality.missingWebsites],
                    ["Missing LinkedIn URLs", quality.missingLinkedin],
                    ["Missing phone numbers", quality.missingPhones],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">{(value ?? 0).toLocaleString()}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          <Panel title="Settings this import ran with">
            <KeyValue
              items={[
                { label: "Duplicates", value: DUPLICATE_MODES[settings.duplicateMode] },
                { label: "Automation", value: settings.autoStartAutomation ? "Started for new leads" : "Not started" },
                { label: "Assignment", value: ASSIGNMENT_MODES[settings.assignmentMode] },
                { label: "Tags", value: settings.tags.length ? settings.tags.join(", ") : "None" },
                { label: "Domain check", value: settings.checkDomains ? "On" : "Off" },
              ]}
            />
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-cyan-700 hover:underline">Column mapping</summary>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {Object.entries(settings.mapping).map(([field, header]) => (
                  <li key={field}>
                    <span className="font-semibold text-slate-800">{header}</span> → {isCrmField(field) ? COLUMN_BY_FIELD[field].label : field}
                  </li>
                ))}
              </ul>
            </details>
          </Panel>
        </div>
      </div>
    </>
  );
}
