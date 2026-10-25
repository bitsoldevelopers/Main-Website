import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, MessagesSquare, PhoneForwarded, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { conversationStats, listConversations, type ConversationFilter } from "@/lib/chatbot/queries";
import { formatDate, timeAgo, truncate } from "@/lib/admin/format";
import {
  DbUnavailable,
  EmptyState,
  LinkTabs,
  PageHeader,
  Pagination,
  Panel,
  Pill,
  StatCard,
  btn,
  inputClass,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";

export const metadata: Metadata = { title: "Chatbot conversations" };

type SearchParams = Record<string, string | string[] | undefined>;

const FILTERS: ConversationFilter[] = ["all", "web", "whatsapp", "handoff", "leads"];

function hrefWith(filter: ConversationFilter, q: string, page?: number): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/chatbot/conversations?${qs}` : "/admin/chatbot/conversations";
}

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("chatbot.view");
  const sp = await searchParams;
  const rawFilter = paramFrom(sp.filter) as ConversationFilter;
  const filter: ConversationFilter = FILTERS.includes(rawFilter) ? rawFilter : "all";
  const q = paramFrom(sp.q);
  const page = pageFrom(sp.page);

  const [result, statsResult] = await Promise.all([listConversations({ page, filter, q }), conversationStats()]);
  const stats = statsResult.ok ? statsResult.data : null;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="Conversations"
        description="Every conversation the assistant has handled on the website and on WhatsApp, newest first. Handed-off chats are the ones waiting on a person."
        actions={
          <Link href="/admin/chatbot/simulator" className={btn.secondary}>
            Try the assistant
          </Link>
        }
      />

      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Conversations" value={stats.total} hint={`${stats.today} started today`} icon={MessagesSquare} />
          <StatCard label="Website chat" value={stats.web} icon={MessageCircle} href={hrefWith("web", "")} />
          <StatCard label="WhatsApp" value={stats.whatsapp} hint="Inbound to the business number" icon={MessageCircle} tone="green" href={hrefWith("whatsapp", "")} />
          <StatCard label="Handed to a person" value={stats.handoffs} hint="Escalated by the assistant" icon={PhoneForwarded} tone="amber" href={hrefWith("handoff", "")} />
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LinkTabs
          current={filter}
          tabs={[
            { label: "All", value: "all", href: hrefWith("all", q) },
            { label: "Website", value: "web", href: hrefWith("web", q) },
            { label: "WhatsApp", value: "whatsapp", href: hrefWith("whatsapp", q) },
            { label: "Needs a person", value: "handoff", href: hrefWith("handoff", q) },
            { label: "Became a lead", value: "leads", href: hrefWith("leads", q), count: stats?.withLead },
          ]}
        />
        <form method="get" action="/admin/chatbot/conversations" className="flex items-center gap-2">
          {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" name="q" defaultValue={q} placeholder="Reference, name or number" className={`${inputClass} w-64 pl-9`} aria-label="Search conversations" />
          </div>
        </form>
      </div>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.items.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            icon={MessagesSquare}
            title={q || filter !== "all" ? "No conversations match" : "No conversations yet"}
            description={
              q || filter !== "all"
                ? "Try another filter or search."
                : "Conversations appear here as soon as someone talks to the assistant on the website. Run the migration in docs/sql if this stays empty after a chat."
            }
            action={
              <Link href="/admin/chatbot/simulator" className={btn.primary}>
                Open the simulator
              </Link>
            }
          />
        </Panel>
      ) : (
        <Panel bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr>
                  <th className={thClass}>Conversation</th>
                  <th className={thClass}>Customer</th>
                  <th className={thClass}>Last message</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {result.data.items.map((row) => {
                  const last = row.messages[0];
                  return (
                    <tr key={row.id} className={trClass}>
                      <td className={tdClass}>
                        <Link href={`/admin/chatbot/conversations/${row.id}`} className="font-mono text-xs font-semibold text-cyan-700 hover:underline">
                          {row.reference}
                        </Link>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {row.channel === "WHATSAPP" ? "WhatsApp" : "Website"} · {row._count.messages} messages · {row.language}
                        </p>
                      </td>
                      <td className={tdClass}>
                        {row.lead ? (
                          <Link href={`/admin/leads/${row.lead.id}`} className="font-semibold text-slate-900 hover:underline">
                            {row.lead.name}
                          </Link>
                        ) : (
                          <span className="text-slate-900">{row.contactName ?? (row.channel === "WHATSAPP" ? "WhatsApp contact" : "Visitor")}</span>
                        )}
                        {row.contactPhone && <p className="text-[11px] text-slate-500">{row.contactPhone}</p>}
                        {!row.contactPhone && row.title && <p className="max-w-[220px] truncate text-[11px] text-slate-500">{row.title}</p>}
                      </td>
                      <td className={`${tdClass} max-w-md text-slate-500`}>
                        {last ? `${last.role === "USER" ? "Customer" : "Assistant"}: ${truncate(last.content, 110)}` : "—"}
                      </td>
                      <td className={tdClass}>
                        <div className="flex flex-wrap gap-1">
                          {row.handedOff && <Pill tone="amber">Handed off</Pill>}
                          {row.botPaused && <Pill tone="slate">Paused</Pill>}
                          {row.lead && <Pill tone="green">Lead</Pill>}
                          {row._count.requests > 0 && <Pill tone="purple">{row._count.requests} request{row._count.requests === 1 ? "" : "s"}</Pill>}
                          {!row.handedOff && !row.lead && row._count.requests === 0 && <Pill tone="cyan">Assistant</Pill>}
                        </div>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(row.updatedAt, { time: true })}>
                        {timeAgo(row.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={result.data.page} totalPages={result.data.totalPages} total={result.data.total} noun="conversations" hrefFor={(p) => hrefWith(filter, q, p)} />
        </Panel>
      )}
    </>
  );
}
