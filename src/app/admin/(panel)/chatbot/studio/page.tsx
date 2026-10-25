import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Bot, ChevronRight, FlaskConical } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { loadConfigState } from "@/lib/bot/config";
import { SECTION_KEYS } from "@/lib/bot/schema";
import { SECTION_INFO } from "@/lib/bot/sections";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { Callout, PageHeader, Pill, StatCard, btn } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Chatbot Studio" };

export default async function ChatbotStudioPage() {
  await requireAdminPage("chatbot.manage");
  const [state, whatsapp] = await Promise.all([loadConfigState({ fresh: true }), getWhatsAppSettings()]);
  const groups = Array.from(new Set(SECTION_KEYS.map((key) => SECTION_INFO[key].group)));
  const { nodes } = state.config.menu;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="Chatbot Studio"
        description="Everything the assistant says and does — contact details, voice, menus, questions, prices, teams, scoring and automation — editable here without touching code. Contact details, personality and pricing also shape the website chat."
        actions={
          <>
            <Link href="/admin/chatbot/simulator" className={btn.primary}>
              <FlaskConical className="h-4 w-4" /> Try it
            </Link>
            <Link href="/admin/chatbot/analytics" className={btn.secondary}>
              <BarChart3 className="h-4 w-4" /> Analytics
            </Link>
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Menu items" value={Object.keys(nodes).length} icon={Bot} />
        <StatCard label="Qualification flows" value={Object.keys(state.config.flows).length} icon={Bot} tone="purple" />
        <StatCard label="Published prices" value={state.config.pricing.length} icon={Bot} tone="green" />
        <StatCard label="Customised sections" value={`${state.customised.length} / ${SECTION_KEYS.length}`} icon={Bot} tone="amber" />
      </div>

      <div className="mb-6 space-y-3">
        {state.error && (
          <Callout tone="amber" title="Using the built-in defaults">
            The stored configuration could not be read ({state.error}). The assistant keeps working with the defaults.
          </Callout>
        )}
        {state.invalid.map((entry) => (
          <Callout key={entry.section} tone="red" title={`Stored "${SECTION_INFO[entry.section].title}" is being ignored`}>
            It no longer matches the expected format, so the default is in use: {entry.issues.slice(0, 3).join("; ")}
          </Callout>
        ))}
        {state.warnings.length > 0 && (
          <Callout tone="amber" title={`${state.warnings.length} configuration warning${state.warnings.length === 1 ? "" : "s"}`}>
            <ul className="list-disc pl-4">
              {state.warnings.slice(0, 8).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Callout>
        )}
        {!whatsapp.enabled && (
          <Callout tone="cyan" title="WhatsApp is not connected on this server">
            Changes save normally, the website chat uses them, and the simulator works. WhatsApp customers will not receive replies until the number is connected under{" "}
            <Link href="/admin/chatbot/setup" className="font-semibold underline">
              Chatbot Setup
            </Link>
            .
          </Callout>
        )}
      </div>

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{group}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SECTION_KEYS.filter((key) => SECTION_INFO[key].group === group).map((key) => (
                <Link
                  key={key}
                  href={`/admin/chatbot/studio/${key}`}
                  className="group flex h-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-900">{SECTION_INFO[key].title}</p>
                      {state.customised.includes(key) ? <Pill tone="cyan">Customised</Pill> : <Pill tone="slate">Default</Pill>}
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{SECTION_INFO[key].description}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-700" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
