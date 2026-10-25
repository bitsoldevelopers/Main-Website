import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Download, Pencil, Plus, Search } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/rbac";
import { paramFrom } from "@/lib/admin/queries";
import { listKnowledge } from "@/lib/chatbot/queries";
import { loadKnowledge } from "@/lib/ai/knowledge";
import { MARKETING_KNOWLEDGE_BASE } from "@/data/marketing/knowledge-base";
import { truncate } from "@/lib/admin/format";
import { deleteKnowledge, importDefaultKnowledge, setKnowledgeState } from "@/app/admin/actions-chatbot";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import {
  Callout,
  DbUnavailable,
  EmptyState,
  LinkTabs,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  btn,
  inputClass,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";

export const metadata: Metadata = { title: "Chatbot knowledge base" };

type SearchParams = Record<string, string | string[] | undefined>;

function hrefWith(category: string, q: string): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/chatbot/knowledge?${qs}` : "/admin/chatbot/knowledge";
}

const STATE_TONE = { PUBLISHED: "green", DRAFT: "amber", ARCHIVED: "slate" } as const;

export default async function KnowledgePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("chatbot.view");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "chatbot.write") : false;
  const sp = await searchParams;
  const category = paramFrom(sp.category);
  const q = paramFrom(sp.q);

  const [result, live] = await Promise.all([listKnowledge({ category: category || undefined, q: q || undefined }), loadKnowledge({ fresh: true })]);
  const total = result.ok ? result.data.states.reduce((sum, s) => sum + s.count, 0) : 0;
  const published = result.ok ? result.data.states.find((s) => s.state === "PUBLISHED")?.count ?? 0 : 0;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="Knowledge Base"
        description="Everything the assistant is allowed to say about BITSOL Marketing. It answers from published entries only; the services catalogue and the contact details in Chatbot Studio are added on top."
        actions={
          canWrite && (
            <>
              <form action={importDefaultKnowledge}>
                <SubmitButton variant="secondary" pendingText="Importing…">
                  <Download className="h-4 w-4" /> Import built-in entries
                </SubmitButton>
              </form>
              <Link href="/admin/chatbot/knowledge/new" className={btn.primary}>
                <Plus className="h-4 w-4" /> Add entry
              </Link>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Entries" value={total} icon={BookOpen} />
        <StatCard label="Published" value={published} hint="Used in answers" icon={BookOpen} tone="green" />
        <StatCard label="In use right now" value={live.source === "database" ? "This table" : "Built-in entries"} hint={`${live.entries.length} entries`} icon={BookOpen} tone="purple" />
      </div>

      {live.source === "defaults" && (
        <Callout tone="cyan" className="mb-6" title="The assistant is answering from the built-in entries">
          Import them to start editing from what the assistant says today. Once this table has entries, only its published rows are used.
        </Callout>
      )}

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <LinkTabs
              current={category}
              tabs={[
                { label: "All", value: "", href: hrefWith("", q), count: total },
                ...result.data.categories.map((c) => ({ label: c.category, value: c.category, href: hrefWith(c.category, q), count: c.count })),
              ]}
            />
            <form method="get" action="/admin/chatbot/knowledge" className="flex items-center gap-2">
              {category && <input type="hidden" name="category" value={category} />}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input type="search" name="q" defaultValue={q} placeholder="Search questions and answers" className={`${inputClass} w-64 pl-9`} aria-label="Search the knowledge base" />
              </div>
            </form>
          </div>

          {result.data.entries.length === 0 ? (
            <Panel bodyClassName="p-0">
              <EmptyState
                icon={BookOpen}
                title={q || category ? "No entries match" : "No entries yet"}
                description={q || category ? "Try another filter or search." : `Import the ${MARKETING_KNOWLEDGE_BASE.length} built-in entries, or add your own.`}
                action={
                  canWrite && !q && !category ? (
                    <form action={importDefaultKnowledge}>
                      <SubmitButton pendingText="Importing…">
                        <Download className="h-4 w-4" /> Import built-in entries
                      </SubmitButton>
                    </form>
                  ) : undefined
                }
              />
            </Panel>
          ) : (
            <Panel bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Question</th>
                      <th className={thClass}>Category</th>
                      <th className={thClass}>Keywords</th>
                      <th className={thClass}>State</th>
                      <th className={`${thClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.entries.map((entry) => {
                      const keywords = Array.isArray(entry.keywords) ? (entry.keywords as unknown[]).filter((k): k is string => typeof k === "string") : [];
                      return (
                        <tr key={entry.id} className={trClass}>
                          <td className={`${tdClass} max-w-lg`}>
                            <Link href={`/admin/chatbot/knowledge/${entry.id}`} className="font-semibold text-slate-900 hover:underline">
                              {truncate(entry.question, 90)}
                            </Link>
                            <p className="mt-0.5 text-xs text-slate-500">{truncate(entry.answer.replace(/[*_#]/g, ""), 130)}</p>
                          </td>
                          <td className={tdClass}>
                            <p className="text-xs font-semibold text-slate-900">{entry.category}</p>
                            <p className="text-[11px] text-slate-500">{entry.kind.charAt(0) + entry.kind.slice(1).toLowerCase()} · v{entry.version}</p>
                          </td>
                          <td className={`${tdClass} max-w-[14rem] text-[11px] text-slate-500`}>{truncate(keywords.join(", "), 70) || "—"}</td>
                          <td className={tdClass}>
                            <Pill tone={STATE_TONE[entry.state as keyof typeof STATE_TONE] ?? "slate"}>{entry.state}</Pill>
                          </td>
                          <td className={`${tdClass} text-right`}>
                            {canWrite && (
                              <div className="flex items-center justify-end gap-1">
                                <form action={setKnowledgeState}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <input type="hidden" name="state" value={entry.state === "PUBLISHED" ? "DRAFT" : "PUBLISHED"} />
                                  <button type="submit" className={btn.ghost}>
                                    {entry.state === "PUBLISHED" ? "Unpublish" : "Publish"}
                                  </button>
                                </form>
                                <Link href={`/admin/chatbot/knowledge/${entry.id}`} className={btn.icon} title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </Link>
                                <form action={deleteKnowledge}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <ConfirmButton message="Delete this entry? The assistant stops using it immediately." variant="icon" className="hover:text-red-600">
                                    ✕
                                  </ConfirmButton>
                                </form>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          {live.source === "database" && canWrite && (
            <p className="mt-3 text-xs text-slate-500">
              Import built-in entries only adds entries whose slug is not in this table yet, so it is safe to run again after an update.
            </p>
          )}
        </>
      )}
    </>
  );
}
