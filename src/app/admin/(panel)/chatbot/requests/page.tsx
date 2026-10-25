import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, LifeBuoy } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/rbac";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { listRequests, requestCounts, type RequestKind } from "@/lib/chatbot/queries";
import { formatDate, timeAgo, truncate } from "@/lib/admin/format";
import { humanise } from "@/lib/utils";
import { deleteRequest, updateRequest } from "@/app/admin/actions-chatbot";
import { MEETING_STATUSES, TICKET_STATUSES } from "@/lib/chatbot/constants";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import {
  DbUnavailable,
  EmptyState,
  LinkTabs,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  StatCard,
  selectClass,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";
import type { PillTone } from "@/lib/admin/leads";

export const metadata: Metadata = { title: "Chatbot tickets & meetings" };

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_TONE: Record<string, PillTone> = {
  OPEN: "amber",
  IN_PROGRESS: "cyan",
  WAITING_CUSTOMER: "purple",
  RESOLVED: "green",
  CLOSED: "slate",
  REQUESTED: "amber",
  CONFIRMED: "green",
  RESCHEDULED: "purple",
  COMPLETED: "slate",
  CANCELLED: "red",
  NO_SHOW: "red",
};

const PRIORITY_TONE: Record<string, PillTone> = { LOW: "slate", NORMAL: "cyan", HIGH: "amber", URGENT: "red" };

function hrefWith(kind: string, status: string, page?: number): string {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (status) params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/chatbot/requests?${qs}` : "/admin/chatbot/requests";
}

export default async function RequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("chatbot.view");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "chatbot.write") : false;
  const sp = await searchParams;
  const rawKind = paramFrom(sp.kind);
  const kind = rawKind === "TICKET" || rawKind === "MEETING" ? (rawKind as RequestKind) : undefined;
  const status = paramFrom(sp.status);
  const page = pageFrom(sp.page);

  const [result, countsResult] = await Promise.all([listRequests({ page, kind, status: status || undefined }), requestCounts()]);
  const counts = countsResult.ok ? countsResult.data : null;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="Tickets & Meetings"
        description="Support tickets and consultation requests the assistant raised in conversation, each with the reference the customer was given. Leads live under CRM → Leads."
      />

      {counts && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open tickets" value={counts.openTickets} hint={`${counts.tickets} in total`} icon={LifeBuoy} tone="amber" href={hrefWith("TICKET", "OPEN")} />
          <StatCard label="Meetings to confirm" value={counts.pendingMeetings} hint={`${counts.meetings} in total`} icon={CalendarCheck} tone="purple" href={hrefWith("MEETING", "REQUESTED")} />
          <StatCard label="All tickets" value={counts.tickets} icon={LifeBuoy} href={hrefWith("TICKET", "")} />
          <StatCard label="All meetings" value={counts.meetings} icon={CalendarCheck} href={hrefWith("MEETING", "")} />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LinkTabs
          current={kind ?? ""}
          tabs={[
            { label: "All", value: "", href: hrefWith("", "") },
            { label: "Tickets", value: "TICKET", href: hrefWith("TICKET", "") },
            { label: "Meetings", value: "MEETING", href: hrefWith("MEETING", "") },
          ]}
        />
        {kind && (
          <LinkTabs
            current={status}
            tabs={[
              { label: "Any status", value: "", href: hrefWith(kind, "") },
              ...(kind === "TICKET" ? TICKET_STATUSES : MEETING_STATUSES).map((s) => ({ label: humanise(s), value: s, href: hrefWith(kind, s) })),
            ]}
          />
        )}
      </div>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.items.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState icon={LifeBuoy} title="Nothing here yet" description="Tickets and consultation requests appear as soon as the assistant raises one in a conversation." />
        </Panel>
      ) : (
        <Panel bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead>
                <tr>
                  <th className={thClass}>Reference</th>
                  <th className={thClass}>Request</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Raised</th>
                  {canWrite && <th className={`${thClass} text-right`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((row) => {
                  const statuses = row.kind === "TICKET" ? TICKET_STATUSES : MEETING_STATUSES;
                  return (
                    <tr key={row.id} className={trClass}>
                      <td className={tdClass}>
                        <p className="font-mono text-xs font-semibold text-slate-900">{row.reference}</p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.kind === "TICKET" ? `Ticket · ${row.category ? humanise(row.category) : "General"}` : `Consultation · ${row.mode ? humanise(row.mode) : "—"}`}
                        </p>
                        {row.conversation && (
                          <Link href={`/admin/chatbot/conversations/${row.conversation.id}`} className="text-[11px] text-cyan-700 hover:underline">
                            {row.conversation.channel === "WHATSAPP" ? "WhatsApp" : "Website"} conversation
                          </Link>
                        )}
                      </td>
                      <td className={`${tdClass} max-w-md`}>
                        <p className="font-semibold text-slate-900">{truncate(row.subject, 80)}</p>
                        {row.kind === "MEETING" && row.preferredDate && (
                          <p className="text-xs text-slate-700">
                            {formatDate(row.preferredDate)} at {row.preferredTime ?? "a time to confirm"}
                          </p>
                        )}
                        {row.description && <p className="mt-0.5 text-xs text-slate-500">{truncate(row.description, 120)}</p>}
                        {row.notes && <p className="mt-0.5 text-[11px] italic text-slate-500">{truncate(row.notes, 100)}</p>}
                      </td>
                      <td className={tdClass}>
                        {row.lead ? (
                          <Link href={`/admin/leads/${row.lead.id}`} className="font-semibold text-slate-900 hover:underline">
                            {row.lead.name}
                          </Link>
                        ) : (
                          <span className="text-slate-900">{row.contactName ?? "Unknown"}</span>
                        )}
                        {row.contactPhone && <p className="text-[11px] text-slate-500">{row.contactPhone}</p>}
                        {row.contactEmail && <p className="text-[11px] text-slate-500">{row.contactEmail}</p>}
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1">
                          <Pill tone={STATUS_TONE[row.status] ?? "slate"}>{humanise(row.status)}</Pill>
                          {row.kind === "TICKET" && row.priority !== "NORMAL" && <Pill tone={PRIORITY_TONE[row.priority] ?? "slate"}>{humanise(row.priority)}</Pill>}
                        </div>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(row.createdAt, { time: true })}>
                        {timeAgo(row.createdAt)}
                      </td>
                      {canWrite && (
                        <td className={`${tdClass} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <form action={updateRequest} className="flex items-center gap-1">
                              <input type="hidden" name="id" value={row.id} />
                              <select name="status" defaultValue={row.status} className={`${selectClass} w-44 py-1.5 text-xs`} aria-label="Status">
                                {statuses.map((s) => (
                                  <option key={s} value={s}>
                                    {humanise(s)}
                                  </option>
                                ))}
                              </select>
                              <SubmitButton variant="ghost" pendingText="Saving…">
                                Save
                              </SubmitButton>
                            </form>
                            <form action={deleteRequest}>
                              <input type="hidden" name="id" value={row.id} />
                              <ConfirmButton message="Delete this request?" variant="icon" className="hover:text-red-600">
                                ✕
                              </ConfirmButton>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} noun="requests" hrefFor={(p) => hrefWith(kind ?? "", status, p)} />
        </Panel>
      )}
    </>
  );
}
