import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadConfigState } from "@/lib/bot/config";
import { SECTION_KEYS, type SectionKey } from "@/lib/bot/schema";
import { SECTION_INFO } from "@/lib/bot/sections";
import { DEFAULT_BOT_CONFIG } from "@/data/marketing/bot";
import { Callout, PageHeader } from "@/components/admin/ui";
import { SectionEditor } from "@/components/admin/chatbot/SectionEditor";

export const metadata: Metadata = { title: "Chatbot Studio" };

const HINTS: Partial<Record<SectionKey, string[]>> = {
  contact: ["These contact details are the only ones the assistant may give out, on the website and on WhatsApp."],
  personality: ["The voice and standing instructions are added to every answer on the website chat and on WhatsApp."],
  pricing: [
    "Only prices listed here are ever quoted, on either channel. To change WhatBot Pro's price, edit its summary text.",
    "`intents` decides when a price is shown — e.g. WHATBOT_PRO, WHATSAPP_CHATBOT.",
  ],
  messages: [
    "Placeholders: {name}, {company}, {service}, {team}, {reference}, {phone}, {whatsapp}, {hours}, {nextOpen}, {website}, {whatbotUrl}.",
    'Text inside [[ … ]] is left out when a placeholder in it is empty: "Thanks[[, {name}]]!"',
    "Each message has `en`, and optionally `ur_roman`, `ur` and `pa`. Missing languages fall back sensibly.",
  ],
  menu: [
    "Menu titles show at most 24 characters in a WhatsApp list; menus longer than ten rows are paged automatically.",
    "`children` lists node ids. A service node's `actions` are button ids from the Buttons section.",
  ],
  flows: [
    "`field` is what a question fills (name, company, website, country, businessType, service, budget, timeline…). A question is skipped when the customer already said it.",
    "`completion` is what the flow creates: lead, quote, brief, ticket or meeting.",
  ],
  teams: ["`emails` receive the team's handovers and hot-lead alerts. `ownerEmails` must match admin user accounts; new leads are assigned to the least busy one."],
  followUp: [
    "Steps are hours after the customer's last message. WhatsApp allows free-form messages for 24 hours; later steps need an approved `template`.",
    "Follow-ups are sent by the cron job described under Chatbot Setup.",
  ],
  proof: ['Add only verified work. Each item: { "title", "summary", "link" (optional) }.'],
  sources: ["Share links like https://wa.me/923120141581?text=Hi%20BITSOL%20ref:qr:expo24 — code `qr`, campaign `expo24`."],
};

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTION_KEYS.includes(section as SectionKey)) notFound();
  const key = section as SectionKey;

  await requireAdminPage("chatbot.manage");
  const state = await loadConfigState({ fresh: true });
  const info = SECTION_INFO[key];

  return (
    <>
      <Link href="/admin/chatbot/studio" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Chatbot Studio
      </Link>
      <PageHeader eyebrow={info.group} title={info.title} description={info.description} />

      {HINTS[key] && (
        <Callout tone="cyan" className="mb-4">
          <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
            {HINTS[key]!.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </Callout>
      )}

      <SectionEditor section={key} value={state.config[key]} defaults={DEFAULT_BOT_CONFIG[key]} customised={state.customised.includes(key)} />
    </>
  );
}
