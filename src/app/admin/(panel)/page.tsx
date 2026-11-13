import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Briefcase,
  CalendarClock,
  CalendarPlus,
  CircleDot,
  CircleX,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  GraduationCap,
  Handshake,
  Inbox,
  Layers,
  Mail,
  Map,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  PenLine,
  Plus,
  Sparkles,
  Tag,
  Ticket,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ActivityLog } from "@prisma/client";
import { requireAdminPage } from "@/lib/admin/auth";
import { getDashboard, type DashboardData } from "@/lib/admin/queries";
import { getPlatformCounts, recentActivity, type PlatformCounts } from "@/lib/admin/queries-cms";
import { getChatStats, getDashboardExtras, sourceLabel, type ChatStats, type DashboardExtras } from "@/lib/admin/queries-dashboard";
import { LEAD_STATUS_META, leadKind, leadTopic, normalizeStatus, type LeadStatus } from "@/lib/admin/leads";
import { formatDate, initials, timeAgo } from "@/lib/admin/format";
import type { PillTone } from "@/lib/admin/leads";
import { services } from "@/lib/services";
import { projects } from "@/lib/portfolio";
import { plans } from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { DbUnavailable, EmptyState, PageHeader, Panel, Pill, btn, tdClass, thClass, toneLabel, trClass } from "@/components/admin/ui";
import { AnalyticsCarousel, type CarouselSlide } from "@/components/admin/AnalyticsCarousel";
import { AreaChart, ColumnChart, Meter, RadialGauge, SegmentBar } from "@/components/admin/charts";

export const metadata: Metadata = { title: "Dashboard" };

const LEADS = { one: "lead", other: "leads" };
const ARTICLES = { one: "article", other: "articles" };

/** Pipeline stages between first contact and a decision. */
const IN_PROGRESS: LeadStatus[] = ["CONTACTED", "REPLIED", "FOLLOW_UP", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "NEGOTIATION"];

export default async function DashboardPage() {
  await requireAdminPage();
  const [result, extrasResult, chatResult, activityResult, countsResult] = await Promise.all([
    getDashboard(),
    getDashboardExtras(),
    getChatStats(),
    recentActivity(),
    getPlatformCounts(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={formatDate(new Date())}
        title="Dashboard"
        description="What came in, what went out, and what the site is made of."
        actions={
          <>
            <Link href="/admin/leads/new" className={btn.secondary}>
              <Plus className="h-4 w-4" /> Add lead
            </Link>
            <Link href="/admin/blog/new" className={btn.primary}>
              <Plus className="h-4 w-4" /> New post
            </Link>
          </>
        }
      />

      {result.ok && extrasResult.ok ? (
        <LiveDashboard
          data={result.data}
          extras={extrasResult.data}
          chat={chatResult.ok ? chatResult.data : null}
          activity={activityResult.ok ? activityResult.data : []}
          counts={countsResult.ok ? countsResult.data : null}
        />
      ) : (
        <DbUnavailable error={result.ok ? (extrasResult.ok ? undefined : extrasResult.error) : result.error} className="mb-6" />
      )}

      <SiteInventory
        courses={result.ok ? result.data.courses : null}
        users={result.ok ? result.data.users : null}
        counts={countsResult.ok ? countsResult.data : null}
      />
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function percent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

/** Week-on-week change, or null when there is no earlier week to compare with. */
function change(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

function Delta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) return null;
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[0.8125rem] font-medium", up ? toneLabel.green : toneLabel.red, className)}>
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : "−"}
      {Math.abs(value).toFixed(Math.abs(value) < 10 ? 1 : 0)}%
    </span>
  );
}

function IconTile({ icon: Icon, tone, size = "md" }: { icon: LucideIcon; tone: PillTone; size?: "sm" | "md" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-md", toneLabel[tone], size === "sm" ? "h-7 w-7" : "h-[2.375rem] w-[2.375rem]")}>
      <Icon className={size === "sm" ? "h-4 w-4" : "h-5 w-5"} strokeWidth={1.75} />
    </span>
  );
}

const STATUS_ICON: Partial<Record<LeadStatus, LucideIcon>> = {
  NEW: Inbox,
  CONTACTED: Mail,
  REPLIED: MessageSquareText,
  QUALIFIED: BadgeCheck,
  MEETING_SCHEDULED: CalendarClock,
  PROPOSAL: FileText,
  NEGOTIATION: Handshake,
  WON: Trophy,
  LOST: CircleX,
  NOT_INTERESTED: CircleX,
};

const SOURCE_ICON: Record<string, LucideIcon> = {
  website: Globe,
  csv: FileSpreadsheet,
  google_sheets: FileSpreadsheet,
  manual: UserRoundPlus,
  chatbot: Bot,
  whatsapp: MessageCircle,
};

function activityTone(action: string): string {
  if (/delet|remov|fail|reject|lost/.test(action)) return "bg-adm-danger";
  if (/creat|import|add|publish|won/.test(action)) return "bg-adm-success";
  if (/login|sign|verif|setup|connect/.test(action)) return "bg-adm-info";
  if (/ticket|handoff|handover|warn/.test(action)) return "bg-adm-warning";
  return "bg-adm-primary";
}

// ─── Live sections ──────────────────────────────────────────────────────────

function LiveDashboard({
  data,
  extras,
  chat,
  activity,
  counts,
}: {
  data: DashboardData;
  extras: DashboardExtras;
  chat: ChatStats | null;
  activity: ActivityLog[];
  counts: PlatformCounts | null;
}) {
  const { leads, posts } = data;
  const last7 = extras.daily.slice(-7);
  const prev7 = extras.daily.slice(0, 7);
  const thisWeek = last7.reduce((sum, d) => sum + d.count, 0);
  const lastWeek = prev7.reduce((sum, d) => sum + d.count, 0);
  const fortnight = thisWeek + lastWeek;
  const weekChange = change(thisWeek, lastWeek);

  const statusCount = (s: LeadStatus) => leads.byStatus.find((row) => row.status === s)?.count ?? 0;
  const won = statusCount("WON");
  const inProgress = IN_PROGRESS.reduce((sum, s) => sum + statusCount(s), 0);
  const sourceTotal = extras.bySource.reduce((sum, s) => sum + s.count, 0);
  const websiteLeads = extras.bySource.find((s) => s.source === "website")?.count ?? 0;
  // Applications come in through the website form too; inquiries are the rest.
  const inboundInquiries = Math.max(0, websiteLeads - leads.applications);

  const slides: CarouselSlide[] = [
    {
      section: "Leads",
      title: "Lead overview",
      subtitle: `${fmt(thisWeek)} inbound in the last 7 days`,
      tiles: [
        { label: "Total leads", value: fmt(leads.total) },
        { label: "New", value: fmt(leads.fresh) },
        { label: "Applications", value: fmt(leads.applications) },
        { label: "Won", value: fmt(won) },
      ],
    },
    {
      section: "Content",
      title: "Publishing",
      subtitle: `${fmt(posts.last30)} ${posts.last30 === 1 ? "article" : "articles"} added in the last 30 days`,
      tiles: [
        { label: "Live articles", value: fmt(posts.published) },
        { label: "Drafts", value: fmt(posts.drafts) },
        { label: "Courses", value: fmt(data.courses) },
        { label: "Testimonials", value: counts ? fmt(counts.testimonials) : "—" },
      ],
    },
    chat
      ? {
          section: "Chatbot",
          title: "Assistant",
          subtitle: `${fmt(chat.conversations7)} conversations in the last 7 days`,
          tiles: [
            { label: "Chats", value: fmt(chat.conversations7) },
            { label: "WhatsApp", value: fmt(chat.whatsapp7) },
            { label: "Handovers", value: fmt(chat.handoffs7) },
            { label: "Open tickets", value: fmt(chat.openTickets) },
          ],
        }
      : {
          section: "Platform",
          title: "Marketing",
          subtitle: counts ? `${fmt(counts.activeCampaigns)} campaigns running` : "Campaigns, media and redirects",
          tiles: [
            { label: "Campaigns", value: counts ? fmt(counts.campaigns) : "—" },
            { label: "Media", value: counts ? fmt(counts.media) : "—" },
            { label: "Redirects", value: counts ? fmt(counts.redirects) : "—" },
            { label: "Users", value: fmt(data.users) },
          ],
        },
  ];

  return (
    <div className="mb-6 space-y-6">
      {/* Row 1: highlights, daily leads, inbound mix */}
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-12">
        <AnalyticsCarousel slides={slides} className="sm:col-span-2 xl:col-span-6" />

        <section className="adm-card flex flex-col overflow-hidden xl:col-span-3">
          <div className="px-6 pt-5">
            <h2 className="text-[1.125rem] text-slate-900">Inbound leads</h2>
            <p className="text-[0.8125rem] text-slate-500">Last 14 days</p>
            <p className="mt-4 text-[1.75rem] font-medium leading-none text-slate-900">{fmt(fortnight)}</p>
            <p className="mt-1.5 text-[0.8125rem] text-slate-500">{(fortnight / 14).toFixed(1)} a day on average</p>
          </div>
          <AreaChart
            className="mt-auto pt-4"
            height={104}
            label="Inbound leads per day"
            noun={LEADS}
            points={extras.daily.map((d) => ({ label: `${d.weekday}, ${d.label}`, value: d.count }))}
          />
        </section>

        <section className="adm-card flex flex-col p-6 xl:col-span-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[0.9375rem] text-slate-500">Website form</h2>
              <p className="mt-1 text-2xl font-medium text-slate-900">{fmt(websiteLeads)}</p>
            </div>
            <span className="text-[0.8125rem] text-slate-400">All time</span>
          </div>
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2">
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-adm-primary/15 text-adm-primary">
                  <Mail className="h-3 w-3" />
                </span>
                <span className="truncate">Inquiries</span>
              </p>
              <p className="mt-3 text-lg font-medium text-slate-900">{Math.round(percent(inboundInquiries, websiteLeads))}%</p>
              <p className="text-[0.8125rem] text-slate-500">{fmt(inboundInquiries)}</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="w-px flex-1 bg-slate-200" />
              <span className="my-1 grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[0.6875rem] font-medium text-slate-500">VS</span>
              <span className="w-px flex-1 bg-slate-200" />
            </div>
            <div className="min-w-0 text-end">
              <p className="flex min-w-0 items-center justify-end gap-1.5 text-[0.8125rem]">
                <span className="truncate">Applications</span>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-adm-chart-2/15 text-adm-chart-2">
                  <Briefcase className="h-3 w-3" />
                </span>
              </p>
              <p className="mt-3 text-lg font-medium text-slate-900">{Math.round(percent(leads.applications, websiteLeads))}%</p>
              <p className="text-[0.8125rem] text-slate-500">{fmt(leads.applications)}</p>
            </div>
          </div>
          <SegmentBar
            className="mt-6"
            parts={[
              { label: "Inquiries", value: inboundInquiries, color: "primary" },
              { label: "Applications", value: leads.applications, color: "second" },
            ]}
          />
        </section>
      </div>

      {/* Row 2: weekly report, support tracker */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Weekly lead report" description="Inbound leads per day, last 7 days">
          <div className="grid gap-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[2.375rem] font-medium leading-none text-slate-900">{fmt(thisWeek)}</p>
                <Delta value={weekChange} />
              </div>
              <p className="mt-3 text-[0.8125rem] text-slate-500">
                {lastWeek === 0
                  ? thisWeek === 0
                    ? "No inbound leads in the last two weeks."
                    : "Nothing came in the week before."
                  : `${fmt(lastWeek)} in the 7 days before.`}
              </p>
            </div>
            <ColumnChart
              height={150}
              label="Inbound leads per day, last 7 days"
              noun={LEADS}
              bars={last7.map((d) => ({ label: d.weekday, value: d.count, title: `${d.weekday}, ${d.label}` }))}
            />
          </div>
          <div className="mt-6 grid gap-5 rounded-md border border-slate-200 p-5 sm:grid-cols-3">
            {[
              { label: "New", value: leads.fresh, icon: Inbox, tone: "cyan" as const },
              { label: "In progress", value: inProgress, icon: Handshake, tone: "purple" as const },
              { label: "Won", value: won, icon: Trophy, tone: "green" as const },
            ].map((stat) => (
              <div key={stat.label} className="min-w-0">
                <p className="flex items-center gap-2 text-[0.9375rem] text-slate-900">
                  <IconTile icon={stat.icon} tone={stat.tone} size="sm" />
                  {stat.label}
                </p>
                <p className="mb-3 mt-3 text-lg font-medium text-slate-900">{fmt(stat.value)}</p>
                <Meter value={percent(stat.value, leads.total)} tone={stat.tone} label={`${stat.label}: ${Math.round(percent(stat.value, leads.total))}% of all leads`} />
              </div>
            ))}
          </div>
        </Panel>

        <SupportTracker chat={chat} />
      </div>

      {/* Row 3: topics, publishing, pipeline */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Panel
          title="Top topics"
          description="What people write to us about"
          actions={
            <Link href="/admin/leads" className={btn.ghost}>
              Leads <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {leads.byTopic.length === 0 ? (
            <p className="text-[0.9375rem] text-slate-500">No inquiries yet.</p>
          ) : (
            <ul className="space-y-5">
              {leads.byTopic.map((topic) => (
                <li key={topic.label} className="flex items-center gap-3">
                  <span className="grid h-[2.375rem] w-[2.375rem] shrink-0 place-items-center rounded-full bg-cyan-100 text-[0.8125rem] font-medium text-cyan-700">
                    {initials(topic.label)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <p className="truncate text-[0.9375rem] font-medium text-slate-900">{topic.label}</p>
                      <p className="shrink-0 text-[0.9375rem] tabular-nums text-slate-900">{fmt(topic.count)}</p>
                    </div>
                    <Meter value={percent(topic.count, Math.max(...leads.byTopic.map((t) => t.count)))} label={`${topic.label}: ${topic.count} leads`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Publishing"
          description="Articles created per month"
          actions={
            <Link href="/admin/blog" className={btn.ghost}>
              Blog <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          <div className="flex items-baseline gap-2">
            <p className="text-[1.75rem] font-medium leading-none text-slate-900">{fmt(posts.published)}</p>
            <p className="text-[0.8125rem] text-slate-500">live of {fmt(posts.total)}</p>
          </div>
          <ColumnChart
            className="mt-5"
            height={130}
            label="Articles created per month"
            noun={ARTICLES}
            bars={posts.byMonth.map((m) => ({ label: m.label, value: m.count }))}
          />
          <ul className="mt-6 space-y-4">
            {[
              { label: "Published", hint: "Live on /blog", value: posts.published, icon: FileText, tone: "green" as const },
              { label: "Drafts", hint: "Hidden from the site", value: posts.drafts, icon: PenLine, tone: "amber" as const },
              { label: "Last 30 days", hint: "Newly created", value: posts.last30, icon: CalendarPlus, tone: "cyan" as const },
            ].map((row) => (
              <li key={row.label} className="flex items-center gap-3">
                <IconTile icon={row.icon} tone={row.tone} />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9375rem] font-medium text-slate-900">{row.label}</p>
                  <p className="text-[0.8125rem] text-slate-500">{row.hint}</p>
                </div>
                <p className="text-[0.9375rem] font-medium tabular-nums text-slate-900">{fmt(row.value)}</p>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          className="md:col-span-2 xl:col-span-1"
          title="Lead pipeline"
          description={`${fmt(leads.total)} leads in the CRM`}
          actions={
            <Link href="/admin/leads/board" className={btn.ghost}>
              Board <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          <ul className="space-y-4">
            {leads.byStatus.map((row) => {
              const meta = LEAD_STATUS_META[row.status];
              return (
                <li key={row.status} className="flex items-center gap-3" title={meta.hint}>
                  <IconTile icon={STATUS_ICON[row.status] ?? CircleDot} tone={meta.tone} />
                  <Link href={`/admin/leads?status=${row.status}`} className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-slate-900 hover:text-cyan-700">
                    {meta.label}
                  </Link>
                  <span className="text-[0.9375rem] tabular-nums text-slate-900">{fmt(row.count)}</span>
                  <span className="w-12 text-end text-[0.8125rem] tabular-nums text-slate-500">{Math.round(percent(row.count, leads.total))}%</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      {/* Row 4: sources, recent leads */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="Lead sources" description="Where every lead in the CRM came from">
          <p className="mb-5 flex items-baseline gap-2">
            <span className="text-[1.75rem] font-medium leading-none text-slate-900">{fmt(sourceTotal)}</span>
            <span className="text-[0.8125rem] text-slate-500">leads</span>
          </p>
          {extras.bySource.length === 0 ? (
            <p className="text-[0.9375rem] text-slate-500">No leads yet.</p>
          ) : (
            <ul className="space-y-4">
              {extras.bySource.map((s) => (
                <li key={s.source} className="flex items-center gap-3">
                  <IconTile icon={SOURCE_ICON[s.source] ?? Inbox} tone="slate" />
                  <p className="min-w-0 flex-1 truncate text-[0.9375rem] font-medium text-slate-900">{sourceLabel(s.source)}</p>
                  <span className="text-[0.9375rem] tabular-nums text-slate-900">{fmt(s.count)}</span>
                  <Pill tone="slate" className="w-14 justify-center tabular-nums">
                    {Math.round(percent(s.count, sourceTotal))}%
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          className="xl:col-span-2"
          bodyClassName="p-0"
          title="Recent leads"
          description="Latest contact-form inquiries and applications"
          actions={
            <Link href="/admin/leads" className={btn.ghost}>
              All leads <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {data.recentLeads.length === 0 ? (
            <EmptyState icon={Inbox} title="No leads yet" description="Submissions from the contact form and careers page appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead>
                  <tr>
                    <th className={thClass}>Who</th>
                    <th className={thClass}>Topic</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Received</th>
                    <th className={cn(thClass, "w-12")}>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLeads.map((lead) => {
                    const status = normalizeStatus(lead.status);
                    return (
                      <tr key={lead.id} className={trClass}>
                        <td className={tdClass}>
                          <div className="flex items-center gap-3">
                            <span className="grid h-[2.375rem] w-[2.375rem] shrink-0 place-items-center rounded-full bg-cyan-100 text-[0.8125rem] font-medium text-cyan-700">
                              {initials(lead.name)}
                            </span>
                            <span className="min-w-0">
                              <Link href={`/admin/leads/${lead.id}`} className="block truncate font-medium text-slate-900 hover:text-cyan-700">
                                {lead.name}
                              </Link>
                              <span className="block truncate text-[0.8125rem] text-slate-500">{lead.email}</span>
                            </span>
                          </div>
                        </td>
                        <td className={tdClass}>
                          <span className="block text-slate-900">{leadTopic(lead.subject)}</span>
                          <span className="text-[0.8125rem] text-slate-500">
                            {leadKind(lead.subject) === "application" ? "Job application" : "Inquiry"}
                          </span>
                        </td>
                        <td className={tdClass}>
                          <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
                        </td>
                        <td className={cn(tdClass, "whitespace-nowrap text-slate-500")} title={formatDate(lead.createdAt, { time: true })}>
                          {timeAgo(lead.createdAt)}
                        </td>
                        <td className={tdClass}>
                          <Link href={`/admin/leads/${lead.id}`} className={btn.icon} aria-label={`Open ${lead.name}`}>
                            <Eye className="h-[1.125rem] w-[1.125rem]" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Row 5: activity timeline, recent articles */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Activity timeline"
          description="Latest events from the audit log"
          actions={
            <Link href="/admin/activity" className={btn.ghost}>
              All <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {activity.length === 0 ? (
            <p className="text-[0.9375rem] text-slate-500">Nothing logged yet.</p>
          ) : (
            <ol className="ms-1.5 border-s border-slate-200">
              {activity.map((row) => (
                <li key={row.id} className="relative pb-5 ps-6 last:pb-0">
                  <span className={cn("absolute -start-[0.4375rem] top-1 h-3.5 w-3.5 rounded-full ring-4 ring-adm-paper", activityTone(row.action))} aria-hidden />
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-[0.9375rem] text-slate-900">
                      <span className="font-medium">{row.actor}</span> <span className="font-mono text-[0.8125rem] text-slate-500">{row.action}</span>
                    </p>
                    <span className="shrink-0 text-[0.8125rem] text-slate-400" title={formatDate(row.createdAt, { time: true })}>
                      {timeAgo(row.createdAt)}
                    </span>
                  </div>
                  {row.detail && <p className="mt-0.5 truncate text-[0.8125rem] text-slate-500">{row.detail}</p>}
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel
          className="xl:col-span-2"
          bodyClassName="p-0"
          title="Recent articles"
          description={`${fmt(posts.total)} in the Blog table`}
          actions={
            <Link href="/admin/blog" className={btn.ghost}>
              All posts <ArrowUpRight className="h-4 w-4" />
            </Link>
          }
        >
          {data.recentPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No articles yet"
              action={
                <Link href="/admin/blog/new" className={btn.primary}>
                  <Plus className="h-4 w-4" /> Write the first one
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className={thClass}>Title</th>
                    <th className={thClass}>Author</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentPosts.map((post) => (
                    <tr key={post.id} className={trClass}>
                      <td className={cn(tdClass, "max-w-[22rem]")}>
                        <Link href={`/admin/blog/${post.id}`} className="block truncate font-medium text-slate-900 hover:text-cyan-700">
                          {post.title}
                        </Link>
                        <span className="mt-0.5 block truncate font-mono text-xs text-slate-400">/blog/{post.slug}</span>
                      </td>
                      <td className={cn(tdClass, "text-slate-500")}>{post.author}</td>
                      <td className={tdClass}>
                        <Pill tone={post.published ? "green" : "amber"}>{post.published ? "Live" : "Draft"}</Pill>
                      </td>
                      <td className={cn(tdClass, "whitespace-nowrap text-slate-500")}>{formatDate(post.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function SupportTracker({ chat }: { chat: ChatStats | null }) {
  return (
    <Panel
      title="Support tracker"
      description="Chatbot tickets and meetings, last 30 days"
      actions={
        <Link href="/admin/chatbot/requests" className={btn.ghost}>
          Requests <ArrowUpRight className="h-4 w-4" />
        </Link>
      }
    >
      {!chat ? (
        <EmptyState
          icon={Bot}
          title="Chatbot data unavailable"
          description="The chatbot tables were not found in this database. Apply the chatbot database update to see tickets and meetings here."
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:items-center">
          <div>
            <p className="text-[2.375rem] font-medium leading-none text-slate-900">{fmt(chat.requests30)}</p>
            <p className="mt-1.5 text-[0.8125rem] text-slate-500">Requests raised in chat</p>
            <ul className="mt-6 space-y-4">
              {[
                { label: "Open tickets", value: fmt(chat.openTickets), icon: Ticket, tone: "cyan" as const },
                { label: "Meetings to confirm", value: fmt(chat.pendingMeetings), icon: CalendarClock, tone: "amber" as const },
                { label: "Chats this week", value: `${fmt(chat.conversations7)} · ${fmt(chat.whatsapp7)} WhatsApp`, icon: MessagesSquare, tone: "purple" as const },
              ].map((row) => (
                <li key={row.label} className="flex items-center gap-3">
                  <IconTile icon={row.icon} tone={row.tone} />
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-medium text-slate-900">{row.label}</p>
                    <p className="text-[0.8125rem] text-slate-500">{row.value}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <RadialGauge value={chat.requests30 > 0 ? percent(chat.resolved30, chat.requests30) : null} label="Handled" />
        </div>
      )}
    </Panel>
  );
}

// ─── Inventory ──────────────────────────────────────────────────────────────

function SiteInventory({ courses, users, counts }: { courses: number | null; users: number | null; counts: PlatformCounts | null }) {
  const items: { label: string; value: number | string; hint: string; icon: LucideIcon; tone: PillTone; href: string }[] = [
    { label: "Services", value: services.length, hint: "Detail pages under /services", icon: Layers, tone: "cyan", href: "/admin/content#services" },
    { label: "Portfolio projects", value: projects.length, hint: "Case studies under /portfolio", icon: Tag, tone: "purple", href: "/admin/content#portfolio" },
    { label: "Pricing plans", value: plans.length, hint: "Packages on /pricing", icon: Sparkles, tone: "amber", href: "/admin/content#pricing" },
    { label: "City pages", value: 3, hint: "Lahore, Karachi, Islamabad", icon: Map, tone: "green", href: "/admin/seo" },
    { label: "Courses", value: courses ?? "—", hint: "Rows in the Course table", icon: GraduationCap, tone: "cyan", href: "/admin/courses" },
    { label: "Users", value: users ?? "—", hint: "Rows in the User table", icon: Users, tone: "purple", href: "/admin/users" },
    {
      label: "Campaigns",
      value: counts?.campaigns ?? "—",
      hint: counts ? `${counts.activeCampaigns} active` : "Marketing campaigns",
      icon: Sparkles,
      tone: "amber",
      href: "/admin/campaigns",
    },
    { label: "Media files", value: counts?.media ?? "—", hint: "Uploads under /uploads", icon: Tag, tone: "green", href: "/admin/media" },
    { label: "Redirects", value: counts?.redirects ?? "—", hint: "Active URL rules", icon: Map, tone: "slate", href: "/admin/redirects" },
  ];

  return (
    <Panel title="Site inventory" description="Everything the public site is built from, and where to manage it.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex items-center gap-4 rounded-md border border-slate-200 p-4 transition hover:border-cyan-300 hover:bg-cyan-50"
          >
            <IconTile icon={item.icon} tone={item.tone} />
            <span className="min-w-0">
              <span className="block text-xl font-medium text-slate-900">{typeof item.value === "number" ? fmt(item.value) : item.value}</span>
              <span className="block truncate text-[0.8125rem] text-slate-500">
                <span className="font-medium text-slate-700">{item.label}</span> · {item.hint}
              </span>
            </span>
            <ArrowUpRight className="ms-auto h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-cyan-700" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
