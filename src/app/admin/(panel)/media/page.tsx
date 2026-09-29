import type { Metadata } from "next";
import Link from "next/link";
import { ImageIcon, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { listMedia } from "@/lib/admin/queries-cms";
import {
  DbUnavailable,
  EmptyState,
  LinkTabs,
  PageHeader,
  Pagination,
  Panel,
  btn,
  inputClass,
} from "@/components/admin/ui";
import { MediaGrid, MediaUploader } from "@/components/admin/MediaLibrary";

export const metadata: Metadata = { title: "Media library" };

type SearchParams = Record<string, string | string[] | undefined>;

function hrefWith(type: string, q: string, page?: number): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/media?${qs}` : "/admin/media";
}

export default async function MediaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("media.write");
  const sp = await searchParams;
  const type = paramFrom(sp.type);
  const q = paramFrom(sp.q);
  const page = pageFrom(sp.page);
  const result = await listMedia({ page, q, type });

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Media library"
        description="Uploads live under /uploads and are served by the site immediately. Copy a file's URL to use it in a blog post, service or anywhere else."
      />

      <Panel className="mb-6">
        <MediaUploader />
      </Panel>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <LinkTabs
          current={type}
          tabs={[
            { label: "All", value: "", href: hrefWith("", q) },
            { label: "Images", value: "image", href: hrefWith("image", q) },
            { label: "Video", value: "video", href: hrefWith("video", q) },
            { label: "Documents", value: "document", href: hrefWith("document", q) },
          ]}
        />
        <form method="get" action="/admin/media" className="flex items-center gap-2">
          {type && <input type="hidden" name="type" value={type} />}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="search" name="q" defaultValue={q} placeholder="Filename or alt text" className={`${inputClass} w-64 pl-9`} aria-label="Search media" />
          </div>
          <button type="submit" className={btn.secondary}>
            Search
          </button>
          {(q || type) && (
            <Link href="/admin/media" className={btn.ghost}>
              Clear
            </Link>
          )}
        </form>
      </div>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : result.data.items.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            icon={ImageIcon}
            title={q || type ? "Nothing matches" : "No uploads yet"}
            description={q || type ? "Try a broader search or clear the filters." : "Drop your first file above — it will be live at its /uploads URL immediately."}
          />
        </Panel>
      ) : (
        <>
          <MediaGrid
            items={result.data.items.map((m) => ({
              ...m,
              createdAt: m.createdAt.toISOString(),
            }))}
          />
          <Panel className="mt-4" bodyClassName="p-0">
            <Pagination
              page={result.data.page}
              totalPages={result.data.totalPages}
              total={result.data.total}
              noun={result.data.total === 1 ? "file" : "files"}
              hrefFor={(n) => hrefWith(type, q, n)}
            />
          </Panel>
        </>
      )}
    </>
  );
}
