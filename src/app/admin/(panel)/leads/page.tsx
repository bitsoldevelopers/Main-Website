import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileSpreadsheet, Inbox, KanbanSquare, Plus, SlidersHorizontal } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { LEAD_PRIORITIES, LEAD_PRIORITY_META, LEAD_STATUSES, LEAD_STATUS_META, leadSourceLabel } from "@/lib/admin/leads";
import { FILTER_KEYS, getLeadFilterOptions, listLeads, type LeadListFilters } from "@/lib/automation/lead-queries";
import { LeadSearch } from "@/components/admin/automation/LeadSearch";
import { LeadsTable } from "@/components/admin/automation/LeadsTable";
import { DbUnavailable, EmptyState, Field, LinkTabs, PageHeader, Pagination, Panel, btn, inputClass, selectClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Leads" };

type SearchParams = Record<string, string | string[] | undefined>;
type Filters = Omit<LeadListFilters, "page">;

/** Filters that live in the "More filters" panel; it opens by itself when one of them is on. */
const PANEL_KEYS = ["company", "title", "location", "tag", "email", "phone", "linkedin", "website", "created", "contacted", "followup", "priority"] as const;

function hrefWith(base: Filters, over: Partial<Filters & { page: number }>): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = key in over ? over[key] : base[key];
    if (value) params.set(key, value);
  }
  if (over.page && over.page > 1) params.set("page", String(over.page));
  const qs = params.toString();
  return qs ? `/admin/leads?${qs}` : "/admin/leads";
}

const AVAILABILITY = [
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "website", label: "Website" },
] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("leads.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "leads.write") : false;
  const canOutreach = session ? hasPermission(session.role, "outreach.write") : false;

  const sp = await searchParams;
  const filters: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = paramFrom(sp[key]);
    if (value) filters[key] = value;
  }
  const page = pageFrom(sp.page);
  const [result, optionsResult] = await Promise.all([listLeads({ page, ...filters }), getLeadFilterOptions()]);
  const options = optionsResult.ok ? optionsResult.data : null;

  const filtering = FILTER_KEYS.some((key) => filters[key]);
  const panelCount = PANEL_KEYS.filter((key) => filters[key]).length;
  // Server Component: rendered per request, so "now" is the request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const exportParams = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));

  return (
    <>
      <PageHeader
        eyebrow="CRM"
        title="Leads & Applications"
        description="Website inquiries, career applications and the prospects imported from Google Sheets or a CSV, in one list."
        actions={
          <>
            <Link href="/admin/leads/board" className={btn.secondary}>
              <KanbanSquare className="h-4 w-4" /> Pipeline board
            </Link>
            {canOutreach && (
              <Link href="/admin/automation/sources" className={btn.secondary}>
                <FileSpreadsheet className="h-4 w-4" /> Import
              </Link>
            )}
            {canWrite && (
              <Link href="/admin/leads/new" className={btn.primary}>
                <Plus className="h-4 w-4" /> Add lead
              </Link>
            )}
          </>
        }
      />

      {(filters.campaign || filters.importId) && (
        <p className="mb-4 text-sm text-slate-500">
          {filters.campaign && (
            <>
              Showing leads from campaign <span className="font-semibold text-cyan-700">{filters.campaign}</span>
            </>
          )}
          {filters.importId && (
            <>
              Showing the leads of{" "}
              <Link href={`/admin/automation/imports/${filters.importId}`} className="font-semibold text-cyan-700 hover:underline">
                one import
              </Link>
            </>
          )}{" "}
          ·{" "}
          <Link href={hrefWith(filters, { campaign: "", importId: "" })} className="underline hover:text-slate-900">
            show all
          </Link>
        </p>
      )}

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <LinkTabs
          current={filters.kind ?? ""}
          tabs={[
            { label: "All", value: "", href: hrefWith(filters, { kind: "" }), count: options?.counts.all },
            { label: "Inquiries", value: "inquiry", href: hrefWith(filters, { kind: "inquiry" }), count: options?.counts.inquiry },
            { label: "Prospects", value: "prospect", href: hrefWith(filters, { kind: "prospect" }), count: options?.counts.prospect },
            { label: "Job applications", value: "application", href: hrefWith(filters, { kind: "application" }), count: options?.counts.application },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <LeadSearch placeholder="Name, company, email, phone, LinkedIn, website, location" />
          <a href={`/api/admin/leads/export${exportParams.size ? `?${exportParams}` : ""}`} className={btn.secondary} title="Everything the current filters match, as CSV">
            <Download className="h-4 w-4" /> Export
          </a>
        </div>
      </div>

      <form method="get" action="/admin/leads" className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {filters.q && <input type="hidden" name="q" value={filters.q} />}
        {filters.kind && <input type="hidden" name="kind" value={filters.kind} />}
        {filters.campaign && <input type="hidden" name="campaign" value={filters.campaign} />}
        {filters.importId && <input type="hidden" name="importId" value={filters.importId} />}

        <div className="flex flex-wrap items-end gap-3">
          <Field label="Lead status" htmlFor="f-status" className="w-52">
            <select id="f-status" name="status" defaultValue={filters.status ?? ""} className={selectClass}>
              <option value="">Any status</option>
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_META[status].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Automation" htmlFor="f-automation" className="w-48">
            <select id="f-automation" name="automation" defaultValue={filters.automation ?? ""} className={selectClass}>
              <option value="">Any</option>
              <option value="none">Never in one</option>
              <option value="ACTIVE">Running</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="STOPPED">Stopped</option>
              <option value="FAILED">Failed</option>
            </select>
          </Field>
          <Field label="Source" htmlFor="f-source" className="w-44">
            <select id="f-source" name="source" defaultValue={filters.source ?? ""} className={selectClass}>
              <option value="">Any source</option>
              {(options?.sources ?? []).map((source) => (
                <option key={source} value={source}>
                  {leadSourceLabel(source)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned user" htmlFor="f-assigned" className="w-48">
            <select id="f-assigned" name="assigned" defaultValue={filters.assigned ?? ""} className={selectClass}>
              <option value="">Anyone</option>
              <option value="none">Unassigned</option>
              {(options?.assignees ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          </Field>
          <button type="submit" className={btn.primary}>
            Filter
          </button>
          {filtering && (
            <Link href={filters.kind ? `/admin/leads?kind=${filters.kind}` : "/admin/leads"} className={btn.ghost}>
              Clear
            </Link>
          )}
        </div>

        <details className="group mt-4 border-t border-slate-100 pt-4" open={panelCount > 0}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
            <SlidersHorizontal className="h-4 w-4" /> More filters
            {panelCount > 0 && <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white">{panelCount} on</span>}
          </summary>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Company" htmlFor="f-company">
              <input id="f-company" name="company" defaultValue={filters.company ?? ""} placeholder="Contains…" className={inputClass} />
            </Field>
            <Field label="Title" htmlFor="f-title">
              <input id="f-title" name="title" defaultValue={filters.title ?? ""} placeholder="CEO, Marketing…" className={inputClass} />
            </Field>
            <Field label="Location" htmlFor="f-location">
              <input id="f-location" name="location" defaultValue={filters.location ?? ""} placeholder="Dubai, UK…" className={inputClass} />
            </Field>
            <Field label="Tag" htmlFor="f-tag">
              <select id="f-tag" name="tag" defaultValue={filters.tag ?? ""} className={selectClass}>
                <option value="">Any tag</option>
                {(options?.tags ?? []).map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </Field>

            {AVAILABILITY.map(({ key, label }) => (
              <Field key={key} label={`${label} availability`} htmlFor={`f-${key}`}>
                <select id={`f-${key}`} name={key} defaultValue={filters[key] ?? ""} className={selectClass}>
                  <option value="">Either</option>
                  <option value="yes">Has {label === "LinkedIn" ? "a LinkedIn profile" : label === "Website" ? "a website" : `a${label === "Email" ? "n" : ""} ${label.toLowerCase()}`}</option>
                  <option value="no">Missing</option>
                </select>
              </Field>
            ))}

            <Field label="Created date" htmlFor="f-created">
              <select id="f-created" name="created" defaultValue={filters.created ?? ""} className={selectClass}>
                <option value="">Any time</option>
                <option value="today">Last 24 hours</option>
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </select>
            </Field>
            <Field label="Last contacted" htmlFor="f-contacted">
              <select id="f-contacted" name="contacted" defaultValue={filters.contacted ?? ""} className={selectClass}>
                <option value="">Any</option>
                <option value="never">Never</option>
                <option value="7">In the last 7 days</option>
                <option value="30">In the last 30 days</option>
                <option value="older">More than 30 days ago</option>
              </select>
            </Field>
            <Field label="Next follow-up" htmlFor="f-followup">
              <select id="f-followup" name="followup" defaultValue={filters.followup ?? ""} className={selectClass}>
                <option value="">Any</option>
                <option value="overdue">Overdue</option>
                <option value="7">In the next 7 days</option>
                <option value="none">None scheduled</option>
              </select>
            </Field>
            <Field label="Priority" htmlFor="f-priority">
              <select id="f-priority" name="priority" defaultValue={filters.priority ?? ""} className={selectClass}>
                <option value="">Any priority</option>
                {LEAD_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {LEAD_PRIORITY_META[priority].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </details>
      </form>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <Panel bodyClassName="p-0">
          {result.data.items.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={filtering ? "Nothing matches these filters" : "No leads yet"}
              description={
                filtering
                  ? "Try a broader search or clear the filters."
                  : "Submissions from the website appear here as they arrive. Prospects come in through an import."
              }
              action={
                !filtering && canOutreach ? (
                  <Link href="/admin/automation/sources" className={btn.primary}>
                    <FileSpreadsheet className="h-4 w-4" /> Import leads
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <LeadsTable
              rows={result.data.items}
              canWrite={canWrite}
              canOutreach={canOutreach}
              now={now}
              options={{
                automations: options?.automations ?? [],
                assignees: (options?.assignees ?? []).map((user) => ({ id: user.id, name: user.name || user.email })),
                tags: options?.tags ?? [],
              }}
            />
          )}
          <Pagination
            page={result.data.page}
            totalPages={result.data.totalPages}
            total={result.data.total}
            noun={result.data.total === 1 ? "lead" : "leads"}
            hrefFor={(n) => hrefWith(filters, { page: n })}
          />
        </Panel>
      )}
    </>
  );
}
