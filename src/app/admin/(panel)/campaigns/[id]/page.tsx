import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, LinkIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getCampaign } from "@/lib/admin/queries-crm";
import { LEAD_STATUS_META, normalizeStatus } from "@/lib/admin/leads";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { deleteCampaign } from "@/app/admin/actions-crm";
import { DbUnavailable, KeyValue, PageHeader, Panel, Pill, btn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/SubmitButton";
import { CampaignForm } from "@/components/admin/CampaignForm";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = { title: "Campaign" };

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("campaigns.read");
  const { id } = await params;
  const result = await getCampaign(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Marketing" title="Campaign" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  if (!result.data) notFound();
  const { campaign, leads, leadCount } = result.data;

  const trackedUrl = campaign.utmCampaign
    ? `${SITE_URL}${campaign.landingPage?.startsWith("/") ? campaign.landingPage : "/"}?utm_source=${encodeURIComponent(
        campaign.utmSource || campaign.platform.toLowerCase()
      )}&utm_medium=${encodeURIComponent(campaign.utmMedium || "cpc")}&utm_campaign=${encodeURIComponent(campaign.utmCampaign)}`
    : null;

  return (
    <>
      <Link href="/admin/campaigns" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>

      <PageHeader
        eyebrow="Marketing"
        title={campaign.name}
        description={`${campaign.platform} · ${campaign.status.toLowerCase()} · created ${formatDate(campaign.createdAt)}`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Panel title="Edit campaign">
            <CampaignForm
              initial={{
                id: campaign.id,
                name: campaign.name,
                platform: campaign.platform,
                objective: campaign.objective ?? "",
                budget: campaign.budget != null ? String(campaign.budget) : "",
                startDate: campaign.startDate ? campaign.startDate.toISOString().slice(0, 10) : "",
                endDate: campaign.endDate ? campaign.endDate.toISOString().slice(0, 10) : "",
                status: campaign.status,
                landingPage: campaign.landingPage ?? "",
                utmSource: campaign.utmSource ?? "",
                utmMedium: campaign.utmMedium ?? "",
                utmCampaign: campaign.utmCampaign ?? "",
                notes: campaign.notes ?? "",
              }}
            />
          </Panel>

          <Panel
            title={`Attributed leads (${leadCount})`}
            description={
              campaign.utmCampaign
                ? `Leads that arrived with utm_campaign=${campaign.utmCampaign}.`
                : "Set a UTM campaign tag above to start attributing leads."
            }
            actions={
              campaign.utmCampaign && leadCount > 0 ? (
                <Link href={`/admin/leads?campaign=${encodeURIComponent(campaign.utmCampaign)}`} className={btn.ghost}>
                  View all <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : undefined
            }
            bodyClassName="p-0"
          >
            {leads.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">No leads attributed to this campaign yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Lead</th>
                      <th className={thClass}>Service</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Received</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const status = normalizeStatus(lead.status);
                      return (
                        <tr key={lead.id} className={trClass}>
                          <td className={tdClass}>
                            <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                              {lead.name}
                            </Link>
                            <span className="block text-xs text-slate-500">{lead.email}</span>
                          </td>
                          <td className={`${tdClass} text-slate-500`}>{lead.subject}</td>
                          <td className={tdClass}>
                            <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
                          </td>
                          <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{timeAgo(lead.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Tracked URL" description="Paste this as the ad destination so leads carry the campaign tag.">
            {trackedUrl ? (
              <p className="break-all rounded-xl bg-slate-100 px-3 py-2 font-mono text-xs text-cyan-700">{trackedUrl}</p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-slate-500">
                <LinkIcon className="mt-0.5 h-4 w-4 shrink-0" /> Set a UTM campaign tag to generate the tracked URL.
              </p>
            )}
          </Panel>

          <Panel title="Summary">
            <KeyValue
              items={[
                { label: "Objective", value: campaign.objective || "—" },
                { label: "Budget", value: campaign.budget != null ? `$${campaign.budget.toLocaleString()}` : "—" },
                {
                  label: "Schedule",
                  value:
                    campaign.startDate || campaign.endDate
                      ? `${campaign.startDate ? formatDate(campaign.startDate) : "…"} → ${campaign.endDate ? formatDate(campaign.endDate) : "…"}`
                      : "—",
                },
                { label: "Landing page", value: campaign.landingPage || "—" },
                { label: "Leads", value: leadCount },
              ]}
            />
          </Panel>

          <Panel title="Danger zone">
            <form action={deleteCampaign}>
              <input type="hidden" name="id" value={campaign.id} />
              <ConfirmButton message="Delete this campaign? Attributed leads keep their UTM data." className="w-full">
                Delete campaign
              </ConfirmButton>
            </form>
          </Panel>
        </aside>
      </div>
    </>
  );
}
