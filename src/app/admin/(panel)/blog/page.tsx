import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ExternalLink, EyeOff, Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listPosts, pageFrom, paramFrom } from "@/lib/admin/queries";
import { formatDate } from "@/lib/admin/format";
import { deletePost, setPostPublished } from "@/app/admin/actions";
import {
  Callout,
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
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";

export const metadata: Metadata = { title: "Blog" };

type SearchParams = Record<string, string | string[] | undefined>;
type Filters = { status: string; q: string };

function hrefWith(base: Filters, over: Partial<Filters & { page: number }>): string {
  const params = new URLSearchParams();
  const status = over.status ?? base.status;
  const q = over.q ?? base.q;
  if (status) params.set("status", status);
  if (q) params.set("q", q);
  if (over.page && over.page > 1) params.set("page", String(over.page));
  const qs = params.toString();
  return qs ? `/admin/blog?${qs}` : "/admin/blog";
}

export default async function BlogAdminPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("content.write");
  const sp = await searchParams;
  const filters: Filters = { status: paramFrom(sp.status), q: paramFrom(sp.q) };
  const saved = paramFrom(sp.saved);
  const page = pageFrom(sp.page);
  const result = await listPosts({ page, ...filters });
  const filtering = Boolean(filters.status || filters.q);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Blog"
        description="Articles in the Blog table. Published posts appear on /blog, the homepage preview, the sitemap and the public API; the daily automation also writes here."
        actions={
          <Link href="/admin/blog/new" className={btn.primary}>
            <Plus className="h-4 w-4" /> New post
          </Link>
        }
      />

      {saved && (
        <Callout tone="green" icon={CheckCircle2} className="mb-6" title="Post saved">
          <a href={`/blog/${saved}`} target="_blank" rel="noopener noreferrer" className="text-cyan-700 hover:underline">
            View /blog/{saved}
          </a>{" "}
          — the public page was revalidated.
        </Callout>
      )}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LinkTabs
          current={filters.status}
          tabs={[
            { label: "All", value: "", href: hrefWith(filters, { status: "" }) },
            { label: "Published", value: "published", href: hrefWith(filters, { status: "published" }) },
            { label: "Drafts", value: "draft", href: hrefWith(filters, { status: "draft" }) },
          ]}
        />
        <form method="get" action="/admin/blog" className="flex flex-wrap items-center gap-2">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Title, slug or author"
              className={`${inputClass} w-64 pl-9`}
              aria-label="Search posts"
            />
          </div>
          <button type="submit" className={btn.secondary}>
            Search
          </button>
          {filtering && (
            <Link href="/admin/blog" className={btn.ghost}>
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
              icon={FileText}
              title={filtering ? "No posts match" : "No posts yet"}
              action={
                !filtering && (
                  <Link href="/admin/blog/new" className={btn.primary}>
                    <Plus className="h-4 w-4" /> Write the first one
                  </Link>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr>
                    <th className={thClass}>Article</th>
                    <th className={thClass}>Tags</th>
                    <th className={thClass}>Author</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Updated</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((post) => {
                    const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];
                    return (
                      <tr key={post.id} className={trClass}>
                        <td className={`${tdClass} max-w-md`}>
                          <Link href={`/admin/blog/${post.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                            {post.title}
                          </Link>
                          <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">/blog/{post.slug}</span>
                          {!post.image && <span className="mt-1 block text-[11px] text-amber-700/80">No featured image</span>}
                        </td>
                        <td className={tdClass}>
                          <div className="flex max-w-[200px] flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
                                {tag}
                              </span>
                            ))}
                            {tags.length > 3 && <span className="text-[11px] text-slate-500">+{tags.length - 3}</span>}
                          </div>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{post.author}</td>
                        <td className={tdClass}>
                          <Pill tone={post.published ? "green" : "amber"}>{post.published ? "Live" : "Draft"}</Pill>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(post.updatedAt)}</td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/blog/${post.id}`} title="Edit" className={btn.icon}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                            {post.published && (
                              <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" title="View live" className={btn.icon}>
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <form action={setPostPublished}>
                              <input type="hidden" name="id" value={post.id} />
                              <input type="hidden" name="published" value={String(!post.published)} />
                              <SubmitButton variant="icon" title={post.published ? "Unpublish" : "Publish"}>
                                {post.published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </SubmitButton>
                            </form>
                            <form action={deletePost}>
                              <input type="hidden" name="id" value={post.id} />
                              <ConfirmButton
                                variant="icon"
                                title="Delete"
                                className="hover:bg-red-50 hover:text-red-600"
                                message={`Delete "${post.title}" permanently?`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </ConfirmButton>
                            </form>
                          </div>
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
            noun={result.data.total === 1 ? "post" : "posts"}
            hrefFor={(n) => hrefWith(filters, { page: n })}
          />
        </Panel>
      )}
    </>
  );
}
