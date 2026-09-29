"use client";

import { useActionState, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, Loader2, Sparkles, XCircle } from "lucide-react";
import { draftSocialCopy, publishSocialPost, type PublishState } from "@/app/admin/actions-social";
import type { ArticleOption, SocialAccountView } from "@/lib/admin/social/accounts";
import type { SocialPlatform } from "@/lib/admin/social/platforms";
import { cn } from "@/lib/utils";
import { Field, FormError, btn, inputClass, selectClass } from "./ui";
import { ConfirmButton } from "./SubmitButton";

const PLATFORM_LABEL: Record<SocialPlatform, string> = { LINKEDIN: "LinkedIn", FACEBOOK: "Facebook" };
const MAX_CHARS = 3000;

function wordsIn(text: string): number {
  return text.split(/\s+/).filter((word) => word && !word.startsWith("#")).length;
}

export function SocialComposer({
  accounts,
  articles,
  aiReady,
  siteUrl,
}: {
  accounts: SocialAccountView[];
  articles: ArticleOption[];
  aiReady: boolean;
  siteUrl: string;
}) {
  const [state, formAction, publishing] = useActionState<PublishState, FormData>(publishSocialPost, null);
  const [drafting, startDraft] = useTransition();

  const [source, setSource] = useState<"article" | "topic">(articles.length > 0 ? "article" : "topic");
  const [articleSlug, setArticleSlug] = useState(articles[0]?.slug ?? "");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [selected, setSelected] = useState<string[]>(() => accounts.map((a) => a.id));
  const [draftNote, setDraftNote] = useState<{ tone: "ok" | "error"; message: string } | null>(null);

  const usingArticle = source === "article" && articleSlug !== "";
  const articleUrl = usingArticle ? `${siteUrl}/blog/${articleSlug}` : "";

  // A published post leaves the box empty for the next one. Done while
  // rendering, when a new result arrives, rather than in an effect.
  const [handled, setHandled] = useState<PublishState>(null);
  if (state !== handled) {
    setHandled(state);
    if (state?.ok) {
      setText("");
      setDraftNote(null);
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

  const canDraft = aiReady && !drafting && (usingArticle || topic.trim().length > 2);
  // `publishing` matters here: a second click would publish the post twice.
  const canPublish = !publishing && text.trim().length > 0 && selected.length > 0 && text.length <= MAX_CHARS;

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
          <button type="button" onClick={draft} disabled={!canDraft} className={btn.secondary}>
            {drafting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {drafting ? "Writing…" : text ? "Write again" : "Write with AI"}
          </button>
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
              (aiReady ? "The AI writes about 100 words and a line of hashtags." : "The AI writer is off: no AI key is set on the server.")}
          </span>
          <span className={cn("tabular-nums", text.length > MAX_CHARS ? "font-semibold text-red-600" : "text-slate-500")}>
            {wordsIn(text)} words · {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
          </span>
        </div>
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
          message={`Publish this post to ${selected.length} account${selected.length === 1 ? "" : "s"}? It goes public straight away.`}
        >
          Publish now
        </ConfirmButton>
        <p className="text-xs text-slate-500">Posts go public immediately. There is no scheduling or undo from here.</p>
      </div>
    </form>
  );
}
