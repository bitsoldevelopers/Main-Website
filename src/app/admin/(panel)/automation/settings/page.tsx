import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, Search, ShieldOff } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate } from "@/lib/admin/format";
import { pageFrom, paramFrom } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { removeSuppression } from "@/app/admin/actions-automation";
import { getSenderSettings, getSetupStatus, listSuppression } from "@/lib/automation/queries";
import { SUPPRESSION_REASON_LABELS } from "@/lib/automation/suppression";
import type { SuppressionReason } from "@/lib/automation/outreach-email";
import { SenderSettingsForm, SuppressionForm } from "@/components/admin/automation/SmallForms";
import { ConfirmButton } from "@/components/admin/SubmitButton";
import { DbUnavailable, EmptyState, KeyValue, PageHeader, Pagination, Panel, Pill, btn, inputClass, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Outreach settings" };

type SearchParams = Record<string, string | string[] | undefined>;

const ENVIRONMENT: { name: string; purpose: string; required: string }[] = [
  { name: "RESEND_API_KEY", purpose: "Sends the emails (already used for lead notifications).", required: "Required to send" },
  { name: "AUTOMATION_SECRET", purpose: "Encrypts Google tokens and signs unsubscribe links. Falls back to ADMIN_SECRET.", required: "Recommended" },
  { name: "GOOGLE_CLIENT_ID", purpose: "OAuth client for Google Sheets.", required: "For Google Sheets" },
  { name: "GOOGLE_CLIENT_SECRET", purpose: "OAuth client secret for Google Sheets.", required: "For Google Sheets" },
  { name: "RESEND_WEBHOOK_SECRET", purpose: "Verifies delivery, bounce, open and reply events from Resend.", required: "For tracking" },
  { name: "AUTOMATION_CRON_SECRET", purpose: "Enables /api/automation/cron for a host cron job.", required: "Recommended" },
  { name: "OUTREACH_EMAIL_MODE", purpose: "Set to \"test\" to record emails without delivering them.", required: "Optional" },
  { name: "AUTOMATION_SCHEDULER", purpose: "Set to \"off\" to rely on the cron endpoint alone.", required: "Optional" },
  { name: "GEMINI_API_KEY", purpose: "AI Personalize drafts (or GROQ_API_KEY / OPENROUTER_API_KEY).", required: "Optional" },
];

export default async function OutreachSettingsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canManage = session ? hasPermission(session.role, "outreach.manage") : false;
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const sp = await searchParams;
  const q = paramFrom(sp.q);

  const [sender, setup, suppression] = await Promise.all([getSenderSettings(), getSetupStatus(), listSuppression({ page: pageFrom(sp.page), q: q || undefined })]);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://bitsolmarketing.com").replace(/\/+$/, "");

  return (
    <>
      <PageHeader
        eyebrow="Lead automation"
        title="Settings"
        description="Who outreach email is sent as, how fast, and who must never receive it. Credentials live in the server's environment variables, not here."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Sender" description="Applies to every automation.">
            {sender.ok ? <SenderSettingsForm settings={sender.data.settings} canEdit={canManage} /> : <DbUnavailable error={sender.error} />}
          </Panel>

          <Panel
            id="suppression"
            bodyClassName="p-0"
            title="Suppression list"
            description="Addresses and domains that are never emailed, whatever list they turn up in. Unsubscribes and bounces are added automatically."
          >
            <div className="space-y-4 border-b border-slate-100 p-5">
              {canWrite && <SuppressionForm />}
              <form method="get" action="/admin/automation/settings#suppression" className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input type="search" name="q" defaultValue={q} placeholder="Find an address or domain" className={`${inputClass} pl-9`} aria-label="Search the suppression list" />
                </div>
                <button type="submit" className={btn.secondary}>
                  Search
                </button>
              </form>
            </div>
            {!suppression.ok ? (
              <div className="p-5">
                <DbUnavailable error={suppression.error} />
              </div>
            ) : suppression.data.items.length === 0 ? (
              <EmptyState icon={ShieldOff} title={q ? "Nothing matches" : "The list is empty"} description={q ? undefined : "Nobody has unsubscribed or bounced yet."} />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead>
                      <tr>
                        <th className={thClass}>Address or domain</th>
                        <th className={thClass}>Reason</th>
                        <th className={thClass}>Added</th>
                        <th className={thClass}>
                          <span className="sr-only">Remove</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppression.data.items.map((entry) => {
                        const optOut = entry.reason === "UNSUBSCRIBED" || entry.reason === "COMPLAINED";
                        return (
                          <tr key={entry.id} className={trClass}>
                            <td className={tdClass}>
                              <span className="font-mono text-xs text-slate-900">{entry.value}</span>
                              {entry.note && <span className="mt-0.5 block text-xs text-slate-500">{entry.note}</span>}
                            </td>
                            <td className={tdClass}>
                              <Pill tone={optOut ? "red" : entry.reason === "BOUNCED" ? "amber" : "slate"}>
                                {SUPPRESSION_REASON_LABELS[entry.reason as SuppressionReason] ?? entry.reason}
                              </Pill>
                            </td>
                            <td className={`${tdClass} text-slate-500`}>
                              {formatDate(entry.createdAt)}
                              {entry.source && <span className="block text-xs">{entry.source}</span>}
                            </td>
                            <td className={`${tdClass} text-right`}>
                              {optOut ? (
                                <span className="text-xs text-slate-400" title="The recipient asked not to be emailed; that is theirs to undo, not ours.">
                                  Permanent
                                </span>
                              ) : canManage ? (
                                <form action={removeSuppression}>
                                  <input type="hidden" name="id" value={entry.id} />
                                  <ConfirmButton variant="ghost" message={`Allow emailing ${entry.value} again?`}>
                                    Remove
                                  </ConfirmButton>
                                </form>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={suppression.data.page}
                  totalPages={suppression.data.totalPages}
                  total={suppression.data.total}
                  noun={suppression.data.total === 1 ? "entry" : "entries"}
                  hrefFor={(n) => `/admin/automation/settings?${new URLSearchParams({ ...(q ? { q } : {}), page: String(n) })}#suppression`}
                />
              </>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          {setup.ok && (
            <Panel title="Status" description="In this environment, right now">
              <ul className="divide-y divide-slate-100">
                {setup.data.items.map((item) => (
                  <li key={item.key} className="flex items-start gap-3 py-2.5 text-sm">
                    {item.done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <CircleDashed className={`mt-0.5 h-4 w-4 shrink-0 ${item.required ? "text-amber-600" : "text-slate-400"}`} />}
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900">{item.label}</span>
                      <span className="block text-xs leading-relaxed text-slate-500">{item.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title="Environment variables" description="Whether each is set here. Values are never shown.">
            <ul className="divide-y divide-slate-100">
              {ENVIRONMENT.map((variable) => {
                const set = Boolean(process.env[variable.name]);
                return (
                  <li key={variable.name} className="py-2.5">
                    <p className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900">{variable.name}</span>
                      <Pill tone={set ? "green" : "slate"}>{set ? "Set" : "Not set"}</Pill>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {variable.purpose} <span className="text-slate-400">· {variable.required}</span>
                    </p>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Endpoints to register" description="With the services that call back into the site">
            <KeyValue
              items={[
                { label: "Google redirect URI", value: <span className="break-all font-mono text-xs">{siteUrl}/api/admin/google/callback</span> },
                { label: "Resend webhook", value: <span className="break-all font-mono text-xs">{siteUrl}/api/webhooks/resend</span> },
                { label: "Cron job", value: <span className="break-all font-mono text-xs">{siteUrl}/api/automation/cron</span> },
                { label: "Unsubscribe", value: <span className="break-all font-mono text-xs">{siteUrl}/unsubscribe</span> },
              ]}
            />
          </Panel>
        </div>
      </div>
    </>
  );
}
