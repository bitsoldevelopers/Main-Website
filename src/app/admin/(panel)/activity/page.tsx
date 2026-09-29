import type { Metadata } from "next";
import Link from "next/link";
import { History, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { activityEntities, listActivity } from "@/lib/admin/queries-cms";
import { formatDate, timeAgo } from "@/lib/admin/format";
import {
  DbUnavailable,
  EmptyState,
  LinkTabs,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  btn,
  inputClass,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";
import type { PillTone } from "@/lib/admin/leads";

export const metadata: Metadata = { title: "Activity log" };

type SearchParams = Record<string, string | string[] | undefined>;

const ENTITY_TONES: Record<string, PillTone> = {
  lead: "cyan",
  blog: "purple",
  campaign: "amber",
  user: "red",
  auth: "slate",
  media: "green",
  redirect: "amber",
  testimonial: "purple",
  faq: "purple",
  course: "green",
};

function hrefWith(entity: string, q: string, page?: number): string {
  const params = new URLSearchParams();
  if (entity) params.set("entity", entity);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/activity?${qs}` : "/admin/activity";
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("activity.read");
  const sp = await searchParams;
  const entity = paramFrom(sp.entity);
  const q = paramFrom(sp.q);
  const page = pageFrom(sp.page);
  const [result, entitiesResult] = await Promise.all([listActivity({ page, entity, q }), activityEntities()]);
  const entities = entitiesResult.ok ? entitiesResult.data : [];

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Activity log"
        description="Every notable action — logins, content changes, CRM moves — with who did it and when. Written best-effort so it never blocks the action itself."
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LinkTabs
          current={entity}
          tabs={[
            { label: "All", value: "", href: hrefWith("", q) },
            ...entities.map((e) => ({ label: e.charAt(0).toUpperCase() + e.slice(1), value: e, href: hrefWith(e, q) })),
          ]}
        />
        <form method="get" action="/admin/activity" className="flex items-center gap-2">
          {entity && <input type="hidden" name="entity" value={entity} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" name="q" defaultValue={q} placeholder="Actor, action or detail" className={`${inputClass} w-64 pl-9`} aria-label="Search activity" />
          </div>
          <button type="submit" className={btn.secondary}>
            Filter
          </button>
          {(q || entity) && (
            <Link href="/admin/activity" className={btn.ghost}>
              Clear
            </Link>
          )}
        </form>
      </div>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <Panel bodyClassName="p-0">
          {result.data.items.length === 0 ? (
            <EmptyState
              icon={History}
              title={q || entity ? "Nothing matches" : "No activity recorded yet"}
              description="Actions taken in the admin and website form submissions will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className={thClass}>When</th>
                    <th className={thClass}>Actor</th>
                    <th className={thClass}>Action</th>
                    <th className={thClass}>Entity</th>
                    <th className={thClass}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((row) => (
                    <tr key={row.id} className={trClass}>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(row.createdAt, { time: true })}>
                        {timeAgo(row.createdAt)}
                      </td>
                      <td className={`${tdClass} text-slate-900`}>{row.actor}</td>
                      <td className={`${tdClass} font-mono text-xs text-cyan-700`}>{row.action}</td>
                      <td className={tdClass}>
                        <Pill tone={ENTITY_TONES[row.entity] ?? "slate"}>{row.entity}</Pill>
                      </td>
                      <td className={`${tdClass} max-w-md break-words text-slate-500`}>
                        {row.entity === "lead" && row.entityId ? (
                          <Link href={`/admin/leads/${row.entityId}`} className="hover:text-slate-900 hover:underline">
                            {row.detail ?? row.entityId}
                          </Link>
                        ) : (
                          (row.detail ?? "—")
                        )}
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
            noun={result.data.total === 1 ? "event" : "events"}
            hrefFor={(n) => hrefWith(entity, q, n)}
          />
        </Panel>
      )}
    </>
  );
}
