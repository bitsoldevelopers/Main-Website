"use client";

import Image from "next/image";
import { useActionState, useState, useTransition } from "react";
import { Check, CheckCircle2, Copy, Download, ExternalLink, ImagePlus, Loader2, Sparkles, Trash2, XCircle } from "lucide-react";
import { draftSocialCopy, generateSocialImage, publishSocialPost, type PublishState } from "@/app/admin/actions-social";
import type { ArticleOption, SocialAccountView } from "@/lib/admin/social/accounts";
import type { SocialPlatform } from "@/lib/admin/social/platforms";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass, selectClass } from "./ui";
import { ConfirmButton } from "./SubmitButton";

const PLATFORM_LABEL: Record<SocialPlatform, string> = { LINKEDIN: "LinkedIn", FACEBOOK: "Facebook" };
const MAX_CHARS = 3000;

type Note = { tone: "ok" | "error"; message: string } | null;

function wordsIn(text: string): number {
  return text.split(/\s+/).filter((word) => word && !word.startsWith("#")).length;
}

export function SocialComposer({
  accounts,
  articles,
  aiReady,
  imagesReady,
  siteUrl,
}: {
  accounts: SocialAccountView[];
  articles: ArticleOption[];
  aiReady: boolean;
  imagesReady: boolean;
  siteUrl: string;
}) {
  const [state, formAction, publishing] = useActionState<PublishState, FormData>(publishSocialPost, null);
  const [drafting, startDraft] = useTransition();
  const [drawing, startDrawing] = useTransition();

  const [source, setSource] = useState<"article" | "topic">(articles.length > 0 ? "article" : "topic");
  const [articleSlug, setArticleSlug] = useState(articles[0]?.slug ?? "");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [selected, setSelected] = useState<string[]>(() => accounts.map((a) => a.id));
  const [draftNote, setDraftNote] = useState<Note>(null);
  const [idea, setIdea] = useState("");
  const [image, setImage] = useState<{ src: string; description: string } | null>(null);
  const [imageNote, setImageNote] = useState<Note>(null);
  const [copied, setCopied] = useState(false);

  const usingArticle = source === "article" && articleSlug !== "";
  const articleUrl = usingArticle ? `${siteUrl}/blog/${articleSlug}` : "";
  const shareLink = link || articleUrl;

  // A published post leaves the box empty for the next one. Done while
  // rendering, when a new result arrives, rather than in an effect.
  const [handled, setHandled] = useState<PublishState>(null);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) {
      setText("");
      setDraftNote(null);
      setImage(null);
      setImageNote(null);
      setIdea("");
    }
  }

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function draft() {
    setDraftNote(null);
    startDraft(async () => {
      const platforms = accounts.filter((a) => selected.includes(a.id)).map((a) => a.platform);
      const result = await draftSocialCopy({
        articleSlug: usingArticle ? articleSlug : undefined,
        topic: source === "topic" ? topic : undefined,
        platforms,
      });
      if (result.ok) {
        setText(result.text);
        setDraftNote({ tone: "ok", message: `Draft of ${result.words} words by ${result.source}. Read it and edit before publishing.` });
      } else {
        setDraftNote({ tone: "error", message: result.error });
      }
    });
  }

  function drawPicture() {
    setImageNote(null);
    startDrawing(async () => {
      const result = await generateSocialImage({
        articleSlug: usingArticle ? articleSlug : undefined,
        topic: source === "topic" ? topic : undefined,
        text,
        idea,
      });
      if (result.ok) {
        setImage({ src: result.image, description: result.description });
        setImageNote({ tone: "ok", message: `Picture: ${result.description}` });
      } else {
        setImageNote({ tone: "error", message: result.error });
      }
    });
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(shareLink ? `${text}\n\n${shareLink}` : text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (no HTTPS, or permission refused): the text can still be selected by hand.
    }
  }

  const hasSubject = usingArticle || topic.trim().length > 2;
  const canDraft = aiReady && !drafting && hasSubject;
  const canDraw = imagesReady && !drawing && (hasSubject || idea.trim().length > 2 || text.trim().length > 20);
  // `publishing` matters here: a second click would publish the post twice.
  const canPublish = !publishing && !drawing && text.trim().length > 0 && selected.length > 0 && text.length <= MAX_CHARS;

  return (
    <form action={formAction} className="space-y-5">
      <FormError message={state?.error} />

      {state?.outcomes && state.outcomes.length > 0 && (
        <ul className="space-y-2">
          {state.outcomes.map((outcome) => (
            <li
              key={outcome.accountId}
              className={cn(
                "flex items-start gap-2 rounded-xl border px-4 py-3 text-sm",
                outcome.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {outcome.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
              <span className="min-w-0">
                <span className="font-semibold">
                  {PLATFORM_LABEL[outcome.platform]} · {outcome.accountName}
                </span>
                {outcome.ok ? " — published." : ` — ${outcome.error}`}
                {outcome.permalink && (
                  <a href={outcome.permalink} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center gap-1 font-semibold underline">
                    View post <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Field label="Post about" htmlFor="s-source">
          <select id="s-source" className={selectClass} value={source} onChange={(e) => setSource(e.target.value as "article" | "topic")}>
            <option value="article" disabled={articles.length === 0}>
              A blog article
            </option>
            <option value="topic">My own topic</option>
          </select>
        </Field>

        {source === "article" ? (
          <Field label="Article" htmlFor="s-article" hint="The post links to this article.">
            <select id="s-article" className={selectClass} value={articleSlug} onChange={(e) => setArticleSlug(e.target.value)}>
              {articles.map((article) => (
                <option key={article.slug} value={article.slug}>
                  {article.title}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="Topic" htmlFor="s-topic" hint="A sentence is enough, e.g. why small shops should answer WhatsApp within an hour.">
            <input
              id="s-topic"
              className={inputClass}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              maxLength={500}
              placeholder="What is the post about?"
            />
          </Field>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
          <label htmlFor="s-text" className="block text-xs font-bold uppercase tracking-widest text-slate-500">
            Post
          </label>
          <div className="flex flex-wrap gap-2">
            {text.trim() && (
              <button type="button" onClick={copyText} className={btn.ghost}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy text"}
              </button>
            )}
            <button type="button" onClick={draft} disabled={!canDraft} className={btn.secondary}>
              {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {drafting ? "Writing…" : text ? "Write again" : "Write with AI"}
            </button>
          </div>
        </div>
        <textarea
          id="s-text"
          name="text"
          rows={9}
          className={cn(inputClass, "leading-relaxed")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write the post here, or let the AI draft about 100 words for you to edit."
        />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={cn(draftNote?.tone === "error" ? "text-red-600" : "text-slate-500")}>
            {draftNote?.message ??
              (aiReady ? "The AI writes about 100 words and a line of hashtags." : "The AI writer is off: an admin has to add the AI key above.")}
          </span>
          <span className={cn("tabular-nums", text.length > MAX_CHARS ? "font-semibold text-red-600" : "text-slate-500")}>
            {wordsIn(text)} words · {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </span>
        </div>
      </div>

      <div>
        <p className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">Image</p>
        <div className="flex flex-wrap items-start gap-2">
          <input
            aria-label="Picture idea"
            className={cn(inputClass, "min-w-0 flex-1 basis-64")}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={500}
            placeholder="Optional: describe the picture. Leave empty and the AI picks a scene from the post."
          />
          <button type="button" onClick={drawPicture} disabled={!canDraw} className={btn.secondary}>
            {drawing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {drawing ? "Drawing…" : image ? "New image" : "Generate image"}
          </button>
        </div>

        {image && (
          <figure className="mt-3 max-w-sm">
            <Image
              src={image.src}
              alt={image.description}
              width={1080}
              height={1080}
              unoptimized
              className={cn("h-auto w-full rounded-xl border border-slate-200", drawing && "opacity-50")}
            />
            <figcaption className="mt-2 flex flex-wrap gap-2">
              <a href={image.src} download="bitsol-post.jpg" className={btn.ghost}>
                <Download className="h-4 w-4" /> Download
              </a>
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  setImageNote(null);
                }}
                className={cn(btn.ghost, "text-slate-500 hover:bg-red-50 hover:text-red-600")}
              >
                <Trash2 className="h-4 w-4" /> Remove
              </button>
            </figcaption>
          </figure>
        )}

        <p className={cn("mt-1.5 text-xs", imageNote?.tone === "error" ? "text-red-600" : "text-slate-500")}>
          {imageNote?.message ??
            (imagesReady
              ? "Cloudflare FLUX draws a square photo for the post. With an image, LinkedIn shows the picture instead of a link card and the link goes into the text."
              : "Images are off: an admin has to add the Cloudflare token above.")}
        </p>
        <input type="hidden" name="image" value={image?.src ?? ""} />
        <input type="hidden" name="imageAlt" value={image?.description ?? ""} />
      </div>

      <Field
        label="Link"
        htmlFor="s-link"
        hint={usingArticle ? "Leave empty to share the article chosen above." : "Optional. A full address starting with https://"}
      >
        <input
          id="s-link"
          name="link"
          type="url"
          className={inputClass}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={articleUrl || "https://bitsolmarketing.com/…"}
        />
      </Field>
      <input type="hidden" name="articleSlug" value={usingArticle ? articleSlug : ""} />

      {accounts.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No account is connected, so this page cannot publish yet. Copy the text and download the image to post them on LinkedIn
          yourself, or connect LinkedIn above to publish from here.
        </p>
      ) : (
        <>
          <fieldset>
            <legend className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-500">Publish to</legend>
            <div className="flex flex-wrap gap-2">
              {accounts.map((account) => {
                const on = selected.includes(account.id);
                return (
                  <label
                    key={account.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition",
                      on ? "border-cyan-300 bg-cyan-50 text-slate-900" : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                    )}
                  >
                    <input
                      type="checkbox"
                      name="accounts"
                      value={account.id}
                      checked={on}
                      onChange={() => toggle(account.id)}
                      className="h-4 w-4 accent-cyan-600"
                    />
                    <span>
                      <span className="font-semibold">{account.name}</span>
                      <span className="ml-1.5 text-xs text-slate-500">{PLATFORM_LABEL[account.platform]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <ConfirmButton
              variant="primary"
              disabled={!canPublish}
              message={`Publish this post${image ? " and its image" : ""} to ${selected.length} account${selected.length === 1 ? "" : "s"}? It goes public straight away.`}
            >
              Publish now
            </ConfirmButton>
            <p className="text-xs text-slate-500">Posts go public immediately. There is no scheduling or undo from here.</p>
          </div>
        </>
      )}
    </form>
  );
}
