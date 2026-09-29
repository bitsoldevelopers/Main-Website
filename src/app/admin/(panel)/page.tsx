import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  FileText,
  GraduationCap,
  Inbox,
  Layers,
  Map,
  Plus,
  Sparkles,
  Tag,
  Users,
} from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getDashboard, type DashboardData } from "@/lib/admin/queries";
import { getPlatformCounts, recentActivity, type PlatformCounts } from "@/lib/admin/queries-cms";
import type { ActivityLog } from "@prisma/client";
import { LEAD_STATUS_META, leadKind, leadTopic, normalizeStatus } from "@/lib/admin/leads";
import { formatDate, initials, timeAgo } from "@/lib/admin/format";
import { services } from "@/lib/services";
import { projects } from "@/lib/portfolio";
import { plans } from "@/lib/pricing";
import {
  DbUnavailable,
  EmptyState,
  PageHeader,
  Panel,
  Pill,
  StatCard,
  btn,
  tdClass,
  thClass,
  trClass,
} from "@/components/admin/ui";
import { BarList } from "@/components/admin/BarList";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  await requireAdminPage();
  const [result, activityResult, countsResult] = await Promise.all([getDashboard(), recentActivity(), getPlatformCounts()]);

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
            <Link href="/admin/leads?status=NEW" className={btn.secondary}>
              <Inbox className="h-4 w-4" /> New leads
            </Link>
          </>
        }
      />

      {result.ok ? (
        <LiveSections data={result.data} activity={activityResult.ok ? activityResult.data : []} />
      ) : (
        <DbUnavailable error={result.error} className="mb-8" />
      )}

      <SiteInventory
        courses={result.ok ? result.data.courses : null}
        users={result.ok ? result.data.users : null}
        counts={countsResult.ok ? countsResult.data : null}
      />
    </>
  );
}

function LiveSections({ data, activity }: { data: DashboardData; activity: ActivityLog[] }) {
  const { leads, posts } = data;

  return (
    <div className="mb-8 space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="New leads"
          value={leads.fresh}
          hint={`${leads.last7} received in the last 7 days`}
          icon={Inbox}
          href="/admin/leads?status=NEW"
        />
        <StatCard
          label="Job applications"
          value={leads.applications}
          hint="Submitted through the Careers page"
          icon={Briefcase}
          tone="purple"
          href="/admin/leads?kind=application"
        />
        <StatCard
          label="Published articles"
          value={posts.published}
          hint={`${posts.last30} added in the last 30 days`}
          icon={FileText}
          tone="green"
          href="/admin/blog?status=published"
        />
        <StatCard
          label="Drafts"
          value={posts.drafts}
          hint="Hidden from /blog, the sitemap and the API"
          icon={Sparkles}
          tone="amber"
          href="/admin/blog?status=draft"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          bodyClassName="p-0"
          title="Recent leads"
          description="Latest contact-form inquiries and applications."
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
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className={thClass}>Who</th>
                    <th className={thClass}>Topic</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLeads.map((lead) => {
                    const status = normalizeStatus(lead.status);
                    return (
                      <tr key={lead.id} className={trClass}>
                        <td className={tdClass}>
                          <Link href={`/admin/leads/${lead.id}`} className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                              {initials(lead.name)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900 hover:text-cyan-700">{lead.name}</span>
                              <span className="block truncate text-xs text-slate-500">{lead.email}</span>
                            </span>
                          </Link>
                        </td>
                        <td className={tdClass}>
                          <span className="block text-slate-900">{leadTopic(lead.subject)}</span>
                          <span className="text-xs text-slate-500">
                            {leadKind(lead.subject) === "application" ? "Job application" : "Inquiry"}
                          </span>
                        </td>
                        <td className={tdClass}>
                          <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`} title={formatDate(lead.createdAt, { time: true })}>
                          {timeAgo(lead.createdAt)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Lead pipeline" description={`${leads.total} leads in total`}>
            <BarList
              items={leads.byStatus.map((row) => ({
                label: <Pill tone={LEAD_STATUS_META[row.status].tone}>{LEAD_STATUS_META[row.status].label}</Pill>,
                value: row.count,
                title: LEAD_STATUS_META[row.status].hint,
              }))}
            />
          </Panel>

          <Panel title="Articles per month" description="Created in the last six months">
            <BarList items={posts.byMonth.map((row) => ({ label: row.label, value: row.count }))} />
          </Panel>

          {leads.byTopic.length > 0 && (
            <Panel title="Leads by topic" description="What people ask about">
              <BarList items={leads.byTopic.map((row) => ({ label: row.label, value: row.count }))} />
            </Panel>
          )}

          <Panel
            title="Recent activity"
            description="Latest events from the audit log"
            actions={
              <Link href="/admin/activity" className={btn.ghost}>
                All <ArrowUpRight className="h-4 w-4" />
              </Link>
            }
          >
            {activity.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing logged yet.</p>
            ) : (
              <ol className="space-y-3">
                {activity.map((row) => (
                  <li key={row.id} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" />
                    <span className="min-w-0">
                      <span className="block truncate text-slate-800">
                        <span className="font-semibold text-slate-900">{row.actor}</span>{" "}
                        <span className="font-mono text-xs text-cyan-700">{row.action}</span>
                      </span>
                      {row.detail && <span className="block truncate text-xs text-slate-500">{row.detail}</span>}
                      <span className="block text-[11px] text-slate-400">{timeAgo(row.createdAt)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <Panel
        bodyClassName="p-0"
        title="Recent articles"
        description={`${posts.total} in the Blog table`}
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
                    <td className={tdClass}>
                      <Link href={`/admin/blog/${post.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                        {post.title}
                      </Link>
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">/blog/{post.slug}</span>
                    </td>
                    <td className={`${tdClass} text-slate-500`}>{post.author}</td>
                    <td className={tdClass}>
                      <Pill tone={post.published ? "green" : "amber"}>{post.published ? "Live" : "Draft"}</Pill>
                    </td>
                    <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(post.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function SiteInventory({ courses, users, counts }: { courses: number | null; users: number | null; counts: PlatformCounts | null }) {
  const items = [
    { label: "Services", value: services.length, hint: "Detail pages under /services", icon: Layers, href: "/admin/content#services" },
    { label: "Portfolio projects", value: projects.length, hint: "Case studies under /portfolio", icon: Tag, href: "/admin/content#portfolio" },
    { label: "Pricing plans", value: plans.length, hint: "Packages on /pricing", icon: Sparkles, href: "/admin/content#pricing" },
    { label: "City pages", value: 3, hint: "Lahore, Karachi, Islamabad", icon: Map, href: "/admin/seo" },
    { label: "Courses", value: courses ?? "—", hint: "Rows in the Course table", icon: GraduationCap, href: "/admin/courses" },
    { label: "Users", value: users ?? "—", hint: "Rows in the User table", icon: Users, href: "/admin/users" },
    {
      label: "Campaigns",
      value: counts?.campaigns ?? "—",
      hint: counts ? `${counts.activeCampaigns} active` : "Marketing campaigns",
      icon: Sparkles,
      href: "/admin/campaigns",
    },
    { label: "Media files", value: counts?.media ?? "—", hint: "Uploads under /uploads", icon: Tag, href: "/admin/media" },
    { label: "Redirects", value: counts?.redirects ?? "—", hint: "Active URL rules", icon: Map, href: "/admin/redirects" },
  ];

  return (
    <Panel title="Site inventory" description="Everything the public site is built from, and where to manage it.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-cyan-300 hover:bg-white"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-2xl font-bold tabular-nums text-slate-900">{item.value}</span>
              <span className="block truncate text-xs text-slate-500">
                <span className="font-semibold text-slate-600">{item.label}</span> · {item.hint}
              </span>
            </span>
            <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-cyan-700" />
          </Link>
        ))}
      </div>
    </Panel>
  );
}
