import type { Metadata } from "next";
import { ArrowRightLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listRedirects } from "@/lib/admin/queries-cms";
import { deleteRedirect, toggleRedirect } from "@/app/admin/actions-cms";
import { formatDate } from "@/lib/admin/format";
import {
  Callout,
  DbUnavailable,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  btn,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/SubmitButton";
import { RedirectForm } from "@/components/admin/RedirectForm";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  await requireAdminPage("seo.write");
  const result = await listRedirects();

  return (
    <>
      <PageHeader
        eyebrow="SEO"
        title="Redirects"
        description="Server-side rules for URLs that moved. The proxy caches them for a minute, so a new rule is live shortly after you add it."
      />

      <Panel title="Add a redirect" className="mb-6">
        <RedirectForm />
      </Panel>

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <Panel bodyClassName="p-0">
          {result.data.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title="No redirect rules yet"
              description="Add one whenever a page moves or is removed, so old links and Google keep working."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className={thClass}>Old URL</th>
                    <th className={thClass}>Redirects to</th>
                    <th className={thClass}>Type</th>
                    <th className={thClass}>Hits</th>
                    <th className={thClass}>Added</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((rule) => (
                    <tr key={rule.id} className={`${trClass} ${rule.active ? "" : "opacity-50"}`}>
                      <td className={`${tdClass} font-mono text-xs text-slate-900`}>{rule.fromPath}</td>
                      <td className={`${tdClass} break-all font-mono text-xs text-cyan-700`}>{rule.toPath}</td>
                      <td className={tdClass}>
                        <Pill tone={rule.permanent ? "green" : "amber"}>{rule.permanent ? "301" : "302"}</Pill>
                        {!rule.active && (
                          <Pill tone="slate" className="mt-1">
                            Off
                          </Pill>
                        )}
                      </td>
                      <td className={`${tdClass} tabular-nums text-slate-500`}>{rule.hits.toLocaleString()}</td>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(rule.createdAt)}</td>
                      <td className={`${tdClass} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <form action={toggleRedirect}>
                            <input type="hidden" name="id" value={rule.id} />
                            <input type="hidden" name="active" value={String(!rule.active)} />
                            <button type="submit" className={btn.ghost}>
                              {rule.active ? "Disable" : "Enable"}
                            </button>
                          </form>
                          <form action={deleteRedirect}>
                            <input type="hidden" name="id" value={rule.id} />
                            <ConfirmButton message={`Delete the redirect from ${rule.fromPath}?`} variant="icon" className="hover:text-red-600">
                              ✕
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <Callout tone="amber" className="mt-6" title="Redirects don't apply to /admin, /api or file URLs">
        Rules match extension-less public paths, ignore case and trailing slashes, and preserve the query string. Loops
        are blocked at save time and again at runtime.
      </Callout>
    </>
  );
}
