import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { PageHeader, Panel } from "@/components/admin/ui";
import { CampaignForm } from "@/components/admin/CampaignForm";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  await requireAdminPage("campaigns.write");
  return (
    <>
      <Link href="/admin/campaigns" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All campaigns
      </Link>
      <PageHeader
        eyebrow="Marketing"
        title="New campaign"
        description="Set the UTM campaign tag here, use it in your ad URLs (utm_campaign=…), and leads will attribute themselves."
      />
      <Panel className="max-w-3xl">
        <CampaignForm />
      </Panel>
    </>
  );
}
