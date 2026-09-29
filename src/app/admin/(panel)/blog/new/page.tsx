import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader } from "@/components/admin/ui";
import { PostForm } from "@/components/admin/PostForm";

export const metadata: Metadata = { title: "New post" };

export default async function NewPostPage() {
  await requireAdminPage("content.write");

  return (
    <>
      <Link href="/admin/blog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All posts
      </Link>
      <PageHeader
        eyebrow="Content"
        title="New post"
        description="Write the article body as HTML (the same format the automation produces). Headings inside the body should start at h2; the template renders the title as the h1."
      />
      <PostForm />
    </>
  );
}
