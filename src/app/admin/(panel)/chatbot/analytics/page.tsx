import type { Metadata } from "next";
import {
  AlertTriangle,
  Bot,
  CalendarCheck,
  Flame,
  Headset,
  MessagesSquare,
  Percent,
  PhoneForwarded,
  ReceiptText,
  Send,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { chatbotAnalytics, type AnalyticsChannel, type ChatbotAnalytics } from "@/lib/bot/analytics";
import { loadConfigState } from "@/lib/bot/config";
import { DEFAULT_BOT_CONFIG } from "@/data/marketing/bot";
import { findService } from "@/data/marketing/services";
import { humanise } from "@/lib/utils";
import { DbUnavailable, LinkTabs, PageHeader, StatCard } from "@/components/admin/ui";
import { Breakdown, DailyColumns } from "@/components/admin/chatbot/Charts";

export const metadata: Metadata = { title: "Chatbot analytics" };

const VIEWS = {
  overview: "Overview",
  sales: "Sales",
  marketing: "Marketing",
  support: "Support",
  ai: "AI & automation",
  admin: "Admin",
} as const;

type View = keyof typeof VIEWS;
const RANGES = [7, 30, 90] as const;
const CHANNELS: Array<{ value: AnalyticsChannel; label: string }> = [
  { value: "ALL", label: "Both channels" },
  { value: "WEB", label: "Website chat" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

export default async function ChatbotAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; days?: string; channel?: string }>;
}) {
  await requireAdminPage("chatbot.view");
  const params = await searchParams;
  const view: View = params.view && params.view in VIEWS ? (params.view as View) : "overview";
  const days = RANGES.find((range) => String(range) === params.days) ?? 30;
  const channel: AnalyticsChannel = CHANNELS.some((c) => c.value === params.channel) ? (params.channel as AnalyticsChannel) : "ALL";

  const [{ data, error }, configState] = await Promise.all([chatbotAnalytics(days, channel), loadConfigState()]);
  const url = (next: { view?: View; days?: number; channel?: AnalyticsChannel }) =>
    `/admin/chatbot/analytics?view=${next.view ?? view}&days=${next.days ?? days}&channel=${next.channel ?? channel}`;

  return (
    <>
      <PageHeader
        eyebrow="Chatbot"
        title="Chatbot Analytics"
        description={`What the assistant produced in the last ${days} days, shown for the team that acts on it.`}
      />

      {error && <DbUnavailable error={error} className="mb-6" />}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <LinkTabs current={view} tabs={(Object.keys(VIEWS) as View[]).map((key) => ({ label: VIEWS[key], value: key, href: url({ view: key }) }))} />
        <div className="flex flex-wrap gap-2">
          <LinkTabs current={channel} tabs={CHANNELS.map((c) => ({ label: c.label, value: c.value, href: url({ channel: c.value }) }))} />
          <LinkTabs current={String(days)} tabs={RANGES.map((range) => ({ label: `${range} days`, value: String(range), href: url({ days: range }) }))} />
        </div>
      </div>

      {view === "overview" && <Overview data={data} />}
      {view === "sales" && <Sales data={data} />}
      {view === "marketing" && <Marketing data={data} />}
      {view === "support" && <Support data={data} />}
      {view === "ai" && <Automation data={data} />}
      {view === "admin" && (
        <Admin
          data={data}
          customised={configState.customised}
          warnings={[...configState.warnings, ...configState.invalid.map((entry) => `Stored "${entry.section}" ignored: ${entry.issues[0]}`)]}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ Views ---

const pct = (value: number) => `${value}%`;
const serviceLabel = (label: string) => findService(label)?.name ?? label;
const leadsHref = (data: ChatbotAnalytics) =>
  data.channel === "WEB" ? "/admin/leads?source=chatbot" : data.channel === "WHATSAPP" ? "/admin/leads?source=whatsapp" : "/admin/leads";

function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function outcomes(data: ChatbotAnalytics) {
  return [
    { label: "Quotes requested", count: data.quotesRequested },
    { label: "Strategy calls requested", count: data.callsRequested },
    { label: "Demos requested", count: data.demosRequested },
    { label: "Growth plans requested", count: data.growthPlans },
    { label: "Consultation requests", count: data.meetings },
    { label: "Handed to a person", count: data.handovers },
    { label: "Support tickets", count: data.tickets },
  ].filter((row) => row.count > 0);
}

function Overview({ data }: { data: ChatbotAnalytics }) {
  return (
    <>
      <Tiles>
        <StatCard label="Conversations" value={data.conversations} hint="New threads" icon={MessagesSquare} />
        <StatCard label="New leads" value={data.newLeads} hint={`${data.hotLeads} hot or high priority`} icon={UserPlus} tone="green" href={leadsHref(data)} />
        <StatCard label="Lead rate" value={pct(data.conversations ? Math.round((data.newLeads / data.conversations) * 1000) / 10 : 0)} hint="Leads ÷ conversations" icon={Percent} tone="purple" />
        <StatCard label="Won" value={data.wonLeads} hint={`${pct(data.conversionRate)} of new leads`} icon={TrendingUp} tone="amber" />
      </Tiles>
      <div className="mb-6">
        <DailyColumns title="Conversations per day" rows={data.daily} />
      </div>
      <Grid>
        <Breakdown title="Outcomes" rows={outcomes(data)} labels={(label) => label} empty="No quotes, calls, tickets or handovers yet." />
        <Breakdown title="Lead temperature" rows={data.temperatures} />
        <Breakdown title="Service demand" rows={data.services} labels={serviceLabel} />
        <Breakdown title="Languages" rows={data.languages} />
        <Breakdown title="Country demand" rows={data.countries} labels={(label) => label} />
        <Breakdown title="Conversation sources" rows={data.sources} />
      </Grid>
    </>
  );
}

function Sales({ data }: { data: ChatbotAnalytics }) {
  return (
    <>
      <Tiles>
        <StatCard label="Qualified leads" value={data.qualifiedLeads} hint={`of ${data.newLeads} new leads`} icon={UserPlus} href={leadsHref(data)} />
        <StatCard label="Hot & high priority" value={data.hotLeads} hint="Call these first" icon={Flame} tone="red" href={`${leadsHref(data)}${leadsHref(data).includes("?") ? "&" : "?"}priority=HIGH`} />
        <StatCard label="Quotes requested" value={data.quotesRequested} icon={ReceiptText} tone="purple" />
        <StatCard label="Calls & demos" value={data.callsRequested + data.demosRequested + data.meetings} hint={`${data.meetings} consultation requests`} icon={CalendarCheck} tone="green" href="/admin/chatbot/requests?kind=MEETING" />
      </Tiles>
      <Tiles>
        <StatCard label="Won" value={data.wonLeads} icon={TrendingUp} tone="green" />
        <StatCard label="Lost" value={data.lostLeads} icon={TrendingDown} tone="slate" />
        <StatCard label="Enterprise opportunities" value={data.enterprise} icon={Sparkles} tone="purple" />
        <StatCard label="Handovers" value={data.handovers} icon={PhoneForwarded} tone="amber" href="/admin/chatbot/conversations?filter=handoff" />
      </Tiles>
      <Grid>
        <Breakdown title="Pipeline status" rows={data.stages} />
        <Breakdown title="Lead temperature" rows={data.temperatures} />
        <Breakdown title="Handovers by team" rows={data.handoversByTeam} labels={teamLabel} />
        <Breakdown title="Service demand" rows={data.services} labels={serviceLabel} />
        <Breakdown title="Intent" rows={data.intents} />
        <Breakdown title="Country" rows={data.countries} labels={(label) => label} />
      </Grid>
    </>
  );
}

function Marketing({ data }: { data: ChatbotAnalytics }) {
  return (
    <>
      <Tiles>
        <StatCard label="Conversations" value={data.conversations} icon={MessagesSquare} />
        <StatCard label="New leads" value={data.newLeads} icon={UserPlus} tone="green" />
        <StatCard label="Lead rate" value={pct(data.conversations ? Math.round((data.newLeads / data.conversations) * 1000) / 10 : 0)} hint="Leads ÷ conversations" icon={Percent} tone="purple" />
        <StatCard label="Follow-ups sent" value={data.followUpsSent} hint={`${data.optOuts} opt-outs`} icon={Send} tone="amber" />
      </Tiles>
      <div className="mb-6">
        <DailyColumns title="Conversations per day" rows={data.daily} />
      </div>
      <Grid>
        <Breakdown title="Conversation sources" rows={data.sources} />
        <Breakdown title="Pages and campaigns" rows={data.campaigns} labels={(label) => label} empty="No page or campaign attribution yet. Website chats record the page they started on; WhatsApp uses ref: codes and ad referrals." />
        <Breakdown title="Service demand" rows={data.services} labels={serviceLabel} />
        <Breakdown title="Languages" rows={data.languages} />
        <Breakdown title="Country demand" rows={data.countries} labels={(label) => label} />
        <Breakdown title="Most opened menus" rows={data.menus} empty="Menus are a WhatsApp feature." />
      </Grid>
    </>
  );
}

function Support({ data }: { data: ChatbotAnalytics }) {
  return (
    <>
      <Tiles>
        <StatCard label="Support tickets" value={data.tickets} icon={Headset} href="/admin/chatbot/requests?kind=TICKET" />
        <StatCard label="Handovers" value={data.handovers} icon={PhoneForwarded} tone="amber" href="/admin/chatbot/conversations?filter=handoff" />
        <StatCard label="Avg response time" value={data.responseSeconds == null ? "—" : formatSeconds(data.responseSeconds)} hint="Customer message → next reply" icon={Timer} tone="purple" />
        <StatCard label="Resolved by the assistant" value={pct(data.aiResolutionRate)} hint="Conversations never handed over" icon={Bot} tone="green" />
      </Tiles>
      <Grid>
        <Breakdown title="Handovers by team" rows={data.handoversByTeam} labels={teamLabel} />
        <Breakdown title="Ticket category" rows={data.ticketCategories} />
        <Breakdown title="Ticket status" rows={data.ticketStatuses} />
      </Grid>
    </>
  );
}

function Automation({ data }: { data: ChatbotAnalytics }) {
  const completion = data.flowsStarted ? Math.round((data.flowsCompleted / data.flowsStarted) * 1000) / 10 : 0;
  return (
    <>
      <Tiles>
        <StatCard label="AI resolution rate" value={pct(data.aiResolutionRate)} hint="Conversations never handed over" icon={Bot} tone="green" />
        <StatCard label="AI answers" value={data.aiReplies} hint={`${data.fallbacks} could not be answered`} icon={Sparkles} tone="purple" />
        <StatCard label="Flow completion" value={pct(completion)} hint={`${data.flowsCompleted} of ${data.flowsStarted} WhatsApp flows`} icon={Percent} />
        <StatCard label="Follow-ups sent" value={data.followUpsSent} hint={`${data.optOuts} opt-outs`} icon={Send} tone="amber" />
      </Tiles>
      <Grid>
        <Breakdown title="Completed flows" rows={data.flows} empty="Flows are a WhatsApp feature." />
        <Breakdown title="Most opened menus & services" rows={data.menus} empty="Menus are a WhatsApp feature." />
        <Breakdown title="Intent of leads" rows={data.intents} />
        <Breakdown title="Languages" rows={data.languages} />
      </Grid>
    </>
  );
}

function Admin({ data, customised, warnings }: { data: ChatbotAnalytics; customised: string[]; warnings: string[] }) {
  const sections = Object.keys(DEFAULT_BOT_CONFIG).length;
  return (
    <>
      <Tiles>
        <StatCard label="Customised sections" value={`${customised.length} / ${sections}`} hint="Chatbot Studio" icon={Sparkles} href="/admin/chatbot/studio" />
        <StatCard label="Configuration warnings" value={warnings.length} icon={AlertTriangle} tone={warnings.length ? "amber" : "green"} href="/admin/chatbot/studio" />
        <StatCard label="WhatsApp send failures" value={data.sendFailures} icon={AlertTriangle} tone={data.sendFailures ? "red" : "slate"} href="/admin/activity?entity=whatsapp" />
        <StatCard label="Opt-outs" value={data.optOuts} icon={TrendingDown} tone="slate" />
      </Tiles>
      <Grid>
        <Breakdown title="Assistant events" rows={data.events} />
        <Breakdown title="Customised sections" rows={customised.map((label) => ({ label, count: 1 }))} format={() => "custom"} empty="Every section is using the built-in defaults." />
        <Breakdown title="Languages" rows={data.languages} />
      </Grid>
    </>
  );
}

function teamLabel(label: string): string {
  const key = label as keyof typeof DEFAULT_BOT_CONFIG.teams;
  return DEFAULT_BOT_CONFIG.teams[key]?.label ?? humanise(label);
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}
