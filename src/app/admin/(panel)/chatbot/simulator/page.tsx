import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { config } from "@/lib/config";
import { Callout, PageHeader } from "@/components/admin/ui";
import { BotSimulator } from "@/components/admin/chatbot/BotSimulator";

export const metadata: Metadata = { title: "Chatbot Simulator" };

export default async function SimulatorPage() {
  await requireAdminPage("chatbot.manage");

  return (
    <>
      <Link href="/admin/chatbot/studio" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Chatbot Studio
      </Link>
      <PageHeader
        eyebrow="Chatbot"
        title="Simulator"
        description="Talk to the assistant exactly as a WhatsApp customer would, with the live configuration and the real AI model. Nothing is sent to WhatsApp and nothing is written to the CRM."
      />
      {!config.ai.configured && (
        <Callout tone="amber" className="mb-4" title="No AI provider key on this server">
          Menus, flows, handovers and scoring work. Open questions get the “having trouble replying” message until an AI key is set under{" "}
          <Link href="/admin/chatbot/setup" className="font-semibold underline">
            Chatbot Setup
          </Link>
          .
        </Callout>
      )}
      <p className="mb-4 text-xs text-slate-500">The phone number decides the detected country — try +971 for UAE or +44 for the UK.</p>
      <BotSimulator />
    </>
  );
}
