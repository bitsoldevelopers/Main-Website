import type { Metadata } from "next";
import { Bot, CheckCircle2, GitBranch, MessageSquare, Rocket, Terminal, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { integrationFlags } from "@/lib/admin/queries";
import { Callout, KeyValue, PageHeader, Panel, Pill, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Content pipeline" };

const pipelineSteps = [
  { step: "1", title: "Pick topics", detail: "A free AI model (Gemini, then Groq, then OpenRouter) proposes three trending article topics, skipping slugs that already exist on the blog." },
  { step: "2", title: "Write articles", detail: "Each topic becomes a full HTML article with title, excerpt and tags, plus LinkedIn commentary. Articles that are too short or malformed are rejected, not published." },
  { step: "3", title: "Make the hero image", detail: "An image is generated (Cloudflare FLUX, or a branded title card) and stored through /api/blog-images." },
  { step: "4", title: "Publish", detail: "Articles are POSTed to /api/blog with the BLOG_API_KEY header; the blog, homepage and article URL are revalidated." },
  { step: "5", title: "Share", detail: "Each article is posted to the LinkedIn company page as an article card." },
];

const blogApi = [
  { method: "GET", path: "/api/blog?limit=100", auth: "none", note: "Published posts without body HTML (add full=1 to include it)" },
  { method: "GET", path: "/api/blog/[slug]", auth: "none", note: "One published post" },
  { method: "GET", path: "/api/blog/health", auth: "none", note: "Total and published counts" },
  { method: "POST", path: "/api/blog", auth: "x-api-key", note: "Create a post; 409 when the slug exists" },
  { method: "PATCH", path: "/api/blog/[slug]", auth: "x-api-key", note: "Update any field; revalidates old and new slug" },
  { method: "DELETE", path: "/api/blog/[slug]", auth: "x-api-key", note: "Delete a post" },
  { method: "POST", path: "/api/blog-images?name=[slug]", auth: "x-api-key", note: "Store a hero image (request body is the image); returns its URL" },
  { method: "GET", path: "/blog-images/[name]", auth: "none", note: "A stored hero image, cached for a year" },
];

const scripts = [
  { group: "Publishing", items: ["daily-content-automation.mjs", "publish-blog.mjs", "publish-seo-packages.mjs", "upload-blogs-api.mjs", "seed-seo-articles-2026.mjs"] },
  { group: "Social", items: ["post-to-linkedin.mjs", "schedule-linkedin-posts.mjs", "post-to-twitter.mjs", "linkedin-auth.mjs", "screenshot-posts.js"] },
  { group: "Maintenance", items: ["check-db.mjs", "check-live-blogs.mjs", "fix-blog-images.mjs", "patch-blog-images.mjs", "stagger-blog-dates.mjs", "check-backlinks.mjs"] },
];

export default async function ContentPipelinePage() {
  await requireAdminPage("automation.view");
  const flags = integrationFlags();

  return (
    <>
      <PageHeader
        eyebrow="Automation"
        title="Content pipeline & deploys"
        description="The machinery that keeps the site fed and deployed: the daily content pipeline, the deploy workflow, the blog API it uses, and the integrations behind them."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-cyan-700" /> Daily content pipeline
            </span>
          }
          description="scripts/daily-content-automation.mjs"
          actions={<Pill tone="amber">Switched off</Pill>}
        >
          <Callout tone="amber" className="mb-4" title="AI no longer writes articles">
            Switched off on 29 Sep 2026. The script now exits without doing anything, and the AI key is used only to
            draft short posts in Social. The steps below describe what it did, and would do again with
            AI_ARTICLE_WRITING=on.
          </Callout>
          <KeyValue
            className="mb-4"
            items={[
              { label: "Schedule", value: "Every day at 15:00 UTC (8:00 PM Pakistan time)" },
              { label: "Runs on", value: "GitHub Actions (.github/workflows/daily-content.yml); also runnable locally via scripts/run-daily-automation.bat" },
              { label: "Output", value: "None while switched off (was 3 articles per run, published live immediately)" },
              { label: "Logs", value: "scripts/logs/daily-YYYY-MM-DD.log, kept 30 days as a workflow artifact" },
              { label: "Manual run", value: "Actions tab → BITSOL Daily Content Automation → Run workflow" },
            ]}
          />
          <ol className="space-y-3">
            {pipelineSteps.map((item) => (
              <li key={item.step} className="flex gap-3 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-700">
                  {item.step}
                </span>
                <span>
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  <span className="block text-slate-500">{item.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="space-y-6">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-cyan-700" /> Deployment
              </span>
            }
            description=".github/workflows/deploy.yml"
          >
            <KeyValue
              items={[
                { label: "Trigger", value: "Every push to the main branch" },
                { label: "Build", value: "npm ci → prisma generate → next build (standalone output)" },
                { label: "Ship", value: "rsync of .next/standalone to Hostinger over SSH, up to 5 attempts" },
                { label: "Start", value: "npm start runs prisma migrate deploy, then server.js on the configured port" },
                { label: "Restart", value: "tmp/restart.txt is touched so the host restarts the Node app" },
              ]}
            />
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-cyan-700" /> Integrations
              </span>
            }
            description="Whether each secret is present in this environment (values are never shown)"
          >
            <ul className="divide-y divide-slate-100">
              {flags.map((flag) => (
                <li key={flag.key} className="flex items-center gap-3 py-2.5 text-sm">
                  {flag.configured ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-900">{flag.label}</span>
                    <span className="block truncate text-xs text-slate-500">{flag.usedBy}</span>
                  </span>
                  <Pill tone={flag.configured ? "green" : "amber"}>{flag.configured ? "Configured" : "Missing"}</Pill>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <Panel bodyClassName="p-0" title="Blog API" description="src/app/api/blog — what the automation and scripts call">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>Path</th>
                  <th className={thClass}>Auth</th>
                  <th className={thClass}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {blogApi.map((row) => (
                  <tr key={`${row.method}-${row.path}`} className={trClass}>
                    <td className={tdClass}>
                      <Pill tone={row.method === "GET" ? "slate" : row.method === "DELETE" ? "red" : "cyan"}>{row.method}</Pill>
                    </td>
                    <td className={`${tdClass} font-mono text-xs text-slate-900`}>{row.path}</td>
                    <td className={`${tdClass} font-mono text-xs text-slate-500`}>{row.auth}</td>
                    <td className={`${tdClass} text-slate-500`}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-700" /> Scripts in the repository
              </span>
            }
            description="scripts/ — run with node from the project root; not deployed to the server"
          >
            <div className="space-y-4">
              {scripts.map((group) => (
                <div key={group.group}>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">{group.group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map((file) => (
                      <span key={file} className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                        {file}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-cyan-700" /> Website chatbot
              </span>
            }
            description="public/chatbot embedded by components/ChatWidget.tsx"
          >
            <p className="text-sm text-slate-500">
              A standalone scripted assistant loaded in a same-origin iframe when a visitor opens the chat bubble. It has
              no server component and does not create leads; edits go to the HTML, CSS and JS under public/chatbot.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
