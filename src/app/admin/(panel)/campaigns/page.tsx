import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Megaphone, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listCampaigns } from "@/lib/admin/queries-crm";
import { formatDate } from "@/lib/admin/format";
import {
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
import type { PillTone } from "@/lib/admin/leads";

export const metadata: Metadata = { title: "Campaigns" };

const STATUS_TONES: Record<string, PillTone> = {
  DRAFT: "slate",
  ACTIVE: "green",
  PAUSED: "amber",
  COMPLETED: "purple",
};

export default async function CampaignsPage() {
  await requireAdminPage("campaigns.read");
  const result = await listCampaigns();

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Campaigns"
        description="One row per paid or organic push. Give each campaign a UTM campaign tag and every lead that arrives with it is attributed automatically."
        actions={
          <Link href="/admin/campaigns/new" className={btn.primary}>
            <Plus className="h-4 w-4" /> New campaign
          </Link>
        }
      />

      {!result.ok ? (
        <DbUnavailable error={result.error} />
      ) : (
        <Panel bodyClassName="p-0">
          {result.data.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Create one for your next Meta or Google push, set its UTM campaign tag, and use that tag in your ad URLs."
              action={
                <Link href="/admin/campaigns/new" className={btn.primary}>
                  <Plus className="h-4 w-4" /> New campaign
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr>
                    <th className={thClass}>Campaign</th>
                    <th className={thClass}>Platform</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Budget</th>
                    <th className={thClass}>Runs</th>
                    <th className={thClass}>Leads</th>
                    <th className={`${thClass} text-right`}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.map((campaign) => (
                    <tr key={campaign.id} className={trClass}>
                      <td className={tdClass}>
                        <Link href={`/admin/campaigns/${campaign.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                          {campaign.name}
                        </Link>
                        {campaign.utmCampaign && (
                          <span className="mt-0.5 block font-mono text-xs text-slate-500">{campaign.utmCampaign}</span>
                        )}
                      </td>
                      <td className={`${tdClass} text-slate-500`}>{campaign.platform}</td>
                      <td className={tdClass}>
                        <Pill tone={STATUS_TONES[campaign.status] ?? "slate"}>{campaign.status}</Pill>
                      </td>
                      <td className={`${tdClass} tabular-nums text-slate-500`}>
                        {campaign.budget != null ? `$${campaign.budget.toLocaleString()}` : "—"}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-slate-500`}>
                        {campaign.startDate ? formatDate(campaign.startDate) : "—"}
                        {campaign.endDate ? ` → ${formatDate(campaign.endDate)}` : ""}
                      </td>
                      <td className={`${tdClass} tabular-nums`}>
                        {campaign.utmCampaign ? (
                          <Link
                            href={`/admin/leads?campaign=${encodeURIComponent(campaign.utmCampaign)}`}
                            className="font-semibold text-cyan-700 hover:underline"
                          >
                            {campaign.leadCount}
                          </Link>
                        ) : (
                          <span className="text-slate-500" title="Set a UTM campaign tag to attribute leads.">
                            —
                          </span>
                        )}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Link href={`/admin/campaigns/${campaign.id}`} className={btn.ghost}>
                          Open <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </>
  );
}
