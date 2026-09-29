"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, Code2, ImageOff } from "lucide-react";
import { savePost, type FormState } from "@/app/admin/actions";
import { slugify } from "@/lib/admin/slug";
import { wordCount, readTime } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import { Field, FormError, Panel, btn, inputClass } from "./ui";
import { SubmitButton } from "./SubmitButton";

export interface PostFormValues {
  id?: string;
  title: string;
  slug: string;
  author: string;
  image: string;
  excerpt: string;
  metaDescription: string;
  tags: string;
  content: string;
  published: boolean;
}

const empty: PostFormValues = {
  title: "",
  slug: "",
  author: "BITSOL MARKETING",
  image: "",
  excerpt: "",
  metaDescription: "",
  tags: "",
  content: "",
  published: true,
};

export function PostForm({ initial }: { initial?: PostFormValues }) {
  const values = initial ?? empty;
  const [state, formAction] = useActionState<FormState, FormData>(savePost, null);

  const [title, setTitle] = useState(values.title);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(values.slug));
  const [meta, setMeta] = useState(values.metaDescription);
  const [content, setContent] = useState(values.content);
  const [image, setImage] = useState(values.image);
  const [imageBroken, setImageBroken] = useState(false);
  const [preview, setPreview] = useState(false);

  const errors = state?.fieldErrors ?? {};
  const words = wordCount(content);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <div className="space-y-6">
        <FormError message={state?.error} />

        <Panel>
          <div className="space-y-5">
            <Field label="Title" htmlFor="post-title" error={errors.title}>
              <input
                id="post-title"
                name="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
                placeholder="How AI automation cuts response time for Pakistani SMEs"
                className={cn(inputClass, "text-lg font-semibold")}
                required
              />
            </Field>

            <Field
              label="Slug"
              htmlFor="post-slug"
              error={errors.slug}
              hint={
                <>
                  Public URL: <span className="text-slate-900/70">bitsolmarketing.com/blog/{slug || "…"}</span>
                </>
              }
            >
              <input
                id="post-slug"
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                onBlur={() => setSlug((s) => slugify(s))}
                placeholder="auto-generated-from-title"
                className={cn(inputClass, "font-mono text-xs")}
              />
            </Field>

            <Field label="Excerpt" htmlFor="post-excerpt" hint="Shown on the blog cards and under the title on the article page.">
              <textarea
                id="post-excerpt"
                name="excerpt"
                defaultValue={values.excerpt}
                rows={3}
                placeholder="Two sentences that make someone want to read on."
                className={inputClass}
              />
            </Field>
          </div>
        </Panel>

        <Panel
          title="Article body"
          description={`HTML. ${words.toLocaleString()} words · ${readTime(content)}`}
          bodyClassName="p-0"
          actions={
            <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition",
                  !preview ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Code2 className="h-3.5 w-3.5" /> HTML
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition",
                  preview ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:text-slate-900"
                )}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
            </div>
          }
        >
          {/* The textarea stays mounted so its value is always submitted. */}
          <textarea
            id="post-content"
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={26}
            placeholder="<h2>Section heading</h2>&#10;<p>Paragraph…</p>"
            className={cn(
              "w-full resize-y rounded-b-2xl border-0 bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-900/25",
              preview && "hidden"
            )}
            required
          />
          {preview && (
            <div className="max-h-[720px] overflow-y-auto px-6 py-6">
              {content.trim() ? (
                <article className="blog-content" dangerouslySetInnerHTML={{ __html: content }} />
              ) : (
                <p className="text-sm text-slate-500">Nothing to preview yet.</p>
              )}
            </div>
          )}
          {errors.content && <p className="px-5 pb-4 text-xs text-red-600">{errors.content}</p>}
        </Panel>
      </div>

      <aside className="space-y-6">
        <Panel title="Publish">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 bg-slate-100 p-3">
            <input type="checkbox" name="published" defaultChecked={values.published} className="mt-0.5 h-4 w-4 accent-[#00D9FF]" />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Published</span>
              <span className="block text-xs text-slate-500">Unchecked posts are hidden from /blog, the sitemap and the API.</span>
            </span>
          </label>
          <div className="mt-4 flex flex-col gap-2">
            <SubmitButton pendingText="Saving…">{values.id ? "Save changes" : "Create post"}</SubmitButton>
            <Link href="/admin/blog" className={btn.secondary}>
              Cancel
            </Link>
          </div>
        </Panel>

        <Panel title="Search preview" description="What Google sees.">
          <Field
            label="Meta description"
            htmlFor="post-meta"
            error={errors.metaDescription}
            hint={
              <span className={cn(meta.length > 160 ? "text-amber-700" : undefined)}>
                {meta.length}/160 characters{meta.length > 160 && " — Google will truncate this"}
              </span>
            }
          >
            <textarea
              id="post-meta"
              name="metaDescription"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              rows={3}
              maxLength={191}
              placeholder="Falls back to the excerpt when empty."
              className={inputClass}
            />
          </Field>
          <div className="mt-4 rounded-xl border border-slate-300 bg-white p-3">
            <p className="truncate text-xs text-emerald-600/80">bitsolmarketing.com › blog › {slug || "slug"}</p>
            <p className="mt-1 line-clamp-1 text-base text-[#8ab4f8]">{title || "Post title"}</p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{meta || "Meta description preview."}</p>
          </div>
        </Panel>

        <Panel title="Featured image">
          <Field label="Image URL" htmlFor="post-image" error={errors.image} hint="Unsplash URLs and /public paths both work.">
            <input
              id="post-image"
              name="image"
              value={image}
              onChange={(e) => {
                setImage(e.target.value);
                setImageBroken(false);
              }}
              placeholder="https://images.unsplash.com/…"
              className={cn(inputClass, "font-mono text-xs")}
            />
          </Field>
          <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
            {image && !imageBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" onError={() => setImageBroken(true)} />
            ) : (
              <span className="flex items-center gap-2 text-xs text-slate-500">
                <ImageOff className="h-4 w-4" /> {imageBroken ? "Image failed to load" : "No image"}
              </span>
            )}
          </div>
        </Panel>

        <Panel title="Details">
          <div className="space-y-4">
            <Field label="Tags" htmlFor="post-tags" hint="Comma separated. The first tag is shown on the card.">
              <input id="post-tags" name="tags" defaultValue={values.tags} placeholder="AI Automation, SEO, Pakistan" className={inputClass} />
            </Field>
            <Field
              label="Author"
              htmlFor="post-author"
              hint="Company bylines are marked up as an Organization; a personal name as a Person."
            >
              <input id="post-author" name="author" defaultValue={values.author} className={inputClass} />
            </Field>
          </div>
        </Panel>
      </aside>
    </form>
  );
}
