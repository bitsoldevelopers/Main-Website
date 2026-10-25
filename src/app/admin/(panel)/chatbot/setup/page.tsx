import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Bot, CheckCircle2, Clock, Mail, MessageSquare, Webhook, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { config } from "@/lib/config";
import { isMailConfigured } from "@/lib/notify";
import { checkConnection, type ConnectionCheck } from "@/lib/whatsapp/client";
import { webhookHistory } from "@/lib/whatsapp/diagnostics";
import { WHATSAPP_FIELDS } from "@/lib/whatsapp/fields";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import { checkAiProvider } from "@/lib/ai/health";
import { chatbotHealth } from "@/lib/chatbot/queries";
import { loadKnowledge } from "@/lib/ai/knowledge";
import { SECTION_KEYS } from "@/lib/bot/schema";
import { formatDate, timeAgo, truncate } from "@/lib/admin/format";
import { Callout, KeyValue, PageHeader, Panel, Pill } from "@/components/admin/ui";
import { WebhookValues, WhatsAppChecks, WhatsAppDetailsForm, type WhatsAppFieldView } from "@/components/admin/chatbot/WhatsAppSetup";

export const metadata: Metadata = { title: "Chatbot setup" };
export const dynamic = "force-dynamic";

/**
 * What the chatbot is wired to, and where WhatsApp is connected. WhatsApp
 * details are entered here (stored encrypted) or set as server variables;
 * everything else is a server variable this page names, never shows.
 */
export default async function ChatbotSetupPage() {
  await requireAdminPage("chatbot.manage");

  const whatsapp = await getWhatsAppSettings({ fresh: true });
  const [connection, history, health, knowledge, ai] = await Promise.all([
    whatsapp.enabled
      ? checkConnection(whatsapp)
      : Promise.resolve<ConnectionCheck>({ ok: false, detail: "No phone number ID or access token yet." }),
    webhookHistory(),
    chatbotHealth(),
    loadKnowledge({ fresh: true }),
    checkAiProvider(),
  ]);

  const cards = [
    {
      icon: Bot,
      name: "AI provider",
      // Green means the provider answered this server just now, not merely that a key is present.
      configured: ai.ok,
      detail: ai.detail,
      env: "ANTHROPIC_API_KEY. Optional: AI_PROVIDER (claude, gemini, openai, ollama; a comma list such as claude,gemini adds fallbacks), AI_MODEL, AI_EXTRACTION_MODEL, AI_EFFORT, AI_MAX_TOKENS, AI_REFUSAL_FALLBACK",
    },
    {
      icon: MessageSquare,
      name: "WhatsApp: sending",
      // Green means Meta answered this server, not merely that a value is present.
      configured: connection.ok,
      detail: connection.ok ? `${connection.detail}${whatsapp.autoReply ? "" : " · replies are switched off"}` : connection.detail,
      env: "Entered below, or WHATSAPP_PHONE_ID and WHATSAPP_TOKEN",
    },
    {
      icon: Webhook,
      name: "WhatsApp: receiving",
      configured: whatsapp.webhookReady,
      detail: !whatsapp.webhookReady
        ? "Meta's deliveries are refused until a verify token and the app secret are set."
        : history?.verifiedAt
          ? `Verify token and app secret set. Meta verified the callback URL ${timeAgo(history.verifiedAt)}.`
          : "Verify token and app secret set. This site has no record of Meta verifying the callback URL yet.",
      env: "Entered below, or WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET",
    },
    {
      icon: Mail,
      name: "Team notifications",
      configured: isMailConfigured(),
      detail: isMailConfigured()
        ? `Emails go to ${config.routing.salesEmail} unless a team in Chatbot Studio has its own inbox. Everything is also written to the activity log.`
        : "RESEND_API_KEY is not set: leads, tickets and handovers are written to the activity log only.",
      env: "RESEND_API_KEY, CHATBOT_NOTIFY_EMAIL",
    },
    {
      icon: Clock,
      name: "Follow-up cron",
      configured: Boolean(config.cron.secret),
      detail: config.cron.secret ? "Secret set. Call /api/cron/follow-ups every 15–30 minutes." : "No secret: WhatsApp follow-ups are never sent.",
      env: "CHATBOT_CRON_SECRET (falls back to AUTOMATION_CRON_SECRET)",
    },
    {
      icon: BookOpen,
      name: "Knowledge base",
      configured: knowledge.entries.length > 0,
      detail:
        knowledge.source === "database"
          ? `${knowledge.entries.length} published entries from Admin → Chatbot → Knowledge Base`
          : `Using the ${knowledge.entries.length} built-in entries. Import them under Knowledge Base to edit.`,
      env: "No variables — managed in the panel",
    },
  ];

  // Secrets stay on the server: the form learns where each value comes from and how a saved secret ends.
  const fields: WhatsAppFieldView[] = WHATSAPP_FIELDS.map((field) => {
    const value = whatsapp.values[field.key];
    return {
      key: field.key,
      label: field.label,
      hint: field.hint,
      secret: field.secret,
      numeric: Boolean(field.numeric),
      source: whatsapp.sources[field.key],
      current: field.secret ? "" : value,
      ending: field.secret && value ? value.slice(-4) : "",
    };
  });
  const savedHere = Object.values(whatsapp.sources).some((source) => source === "panel");

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="Chatbot Setup"
        description="What the assistant is wired to on this server. WhatsApp is connected on this page. Other credentials are server variables in Hostinger, which this page names but never shows."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <div key={card.name} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${card.configured ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              <card.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{card.name}</h3>
                <Pill tone={card.configured ? "green" : "amber"}>
                  {card.configured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {card.configured ? "Configured" : "Not configured"}
                </Pill>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{card.detail}</p>
              <p className="mt-2 break-all font-mono text-[10px] text-slate-500">{card.env}</p>
            </div>
          </div>
        ))}
      </div>

      <section id="whatsapp" className="mt-10 scroll-mt-24">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Connect WhatsApp</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
            Details saved here are stored encrypted and work at once, with no redeploy. A value saved here wins over a server variable of the same
            name. Meta calls the live site, so connect WhatsApp on the live site&apos;s admin panel.
          </p>
        </div>

        {whatsapp.error && (
          <Callout tone="amber" className="mb-6" title="The saved WhatsApp details could not be read">
            Only server variables apply until the database answers again ({whatsapp.error}).
          </Callout>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel title="WhatsApp details" description="From Meta for Developers and Business Settings. A secret is never shown again once saved.">
            <WhatsAppDetailsForm fields={fields} autoReply={whatsapp.autoReply} savedHere={savedHere} />
          </Panel>
          <Panel title="Webhook for Meta" description="The two values Meta's webhook form asks for.">
            <WebhookValues webhookUrl={whatsapp.webhookUrl} verifyToken={whatsapp.verifyToken} verifyTokenSource={whatsapp.sources.WHATSAPP_VERIFY_TOKEN} />
          </Panel>
        </div>

        <Panel
          className="mt-6"
          title="Check the setup"
          description="Asks Meta about the app, the token and the number, and calls the callback URL the way Meta does. It sends no message to anyone."
        >
          <WhatsAppChecks />
        </Panel>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Panel title="Follow-up cron" description="WhatsApp check-ins for quiet leads, timed in Chatbot Studio → Follow-up timing.">
          <pre className="overflow-x-auto rounded-xl bg-slate-100 px-3 py-2 font-mono text-[11px] text-slate-900">
            {`*/20 * * * * curl -fsS -H "Authorization: Bearer <secret>" ${config.appUrl}/api/cron/follow-ups`}
          </pre>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Add it next to the lead-automation cron in Hostinger. Safe to call more often: each lead gets at most one message per configured step.
          </p>
        </Panel>

        <Panel title="Configuration" description="Chatbot Studio sections saved over the defaults.">
          <KeyValue
            items={[
              { label: "Customised sections", value: health.ok ? `${health.data.customisedSections} of ${SECTION_KEYS.length}` : "—" },
              { label: "Knowledge entries", value: health.ok ? `${health.data.knowledgeRows} (${health.data.knowledgePublished} published)` : "—" },
              { label: "Website widget", value: "Live on every public page, and at /chat" },
              {
                label: "Edit",
                value: (
                  <Link href="/admin/chatbot/studio" className="font-semibold text-cyan-700 hover:underline">
                    Open Chatbot Studio
                  </Link>
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="Recent questions" description="What people actually ask — the highest-value knowledge-base edits to make next." className="lg:col-span-2">
          {!health.ok ? (
            <p className="text-sm text-slate-500">{health.error}</p>
          ) : health.data.recentQuestions.length === 0 ? (
            <p className="text-sm text-slate-500">No questions recorded yet. They appear here as soon as people start chatting.</p>
          ) : (
            <ul className="space-y-2.5">
              {health.data.recentQuestions.map((question) => (
                <li key={question.id} className="border-l-2 border-slate-200 pl-3">
                  <Link href={`/admin/chatbot/conversations/${question.conversationId}`} className="text-sm text-slate-900 hover:underline">
                    {truncate(question.content, 150)}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {question.language ?? "EN"} · {formatDate(question.createdAt, { time: true })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Callout tone="cyan" className="mt-6" title="How training works">
        The assistant is grounded, not fine-tuned. It answers from the published knowledge base, the services catalogue and the contact details,
        voice and prices in Chatbot Studio, and says it is not sure — and offers a person — when nothing matches. To improve an answer, edit the
        entry; the change takes effect within 30 seconds.
      </Callout>
    </>
  );
}
