import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getPost } from "@/lib/admin/queries";
import { formatDate } from "@/lib/admin/format";
import { deletePost } from "@/app/admin/actions";
import { DbUnavailable, PageHeader, Panel, Pill, btn } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/PostForm";
import { ConfirmButton } from "@/components/admin/SubmitButton";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("content.write");
  const { id } = await params;
  const result = await getPost(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Content" title="Edit post" />
        <DbUnavailable error={result.error} />
      </>
    );
  }

  const post = result.data;
  if (!post) notFound();

  const tags = Array.isArray(post.tags) ? (post.tags as string[]) : [];

  return (
    <>
      <Link href="/admin/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>
      <PageHeader
        eyebrow="Content"
        title="Edit post"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Pill tone={post.published ? "green" : "amber"}>{post.published ? "Live" : "Draft"}</Pill>
            <span>
              Created {formatDate(post.createdAt)} · updated {formatDate(post.updatedAt, { time: true })}
            </span>
          </span>
        }
        actions={
          post.published && (
            <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
              View live <ExternalLink className="h-4 w-4" />
            </a>
          )
        }
      />

      <PostForm
        initial={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          author: post.author,
          image: post.image ?? "",
          excerpt: post.excerpt ?? "",
          metaDescription: post.metaDescription ?? "",
          tags: tags.join(", "),
          content: post.content,
          published: post.published,
        }}
      />

      <Panel title="Danger zone" className="mt-8 border-red-500/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Deleting removes the article from the database and revalidates its public URL. Links from other sites will 404.
          </p>
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <input type="hidden" name="redirectTo" value="/admin/blog" />
            <ConfirmButton message={`Delete "${post.title}" permanently?`}>Delete post</ConfirmButton>
          </form>
        </div>
      </Panel>
    </>
  );
}
