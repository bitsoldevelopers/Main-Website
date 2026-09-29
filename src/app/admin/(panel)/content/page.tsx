import type { Metadata } from "next";
import Link from "next/link";
import { Code2, ExternalLink } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { services } from "@/lib/services";
import { projects } from "@/lib/portfolio";
import { plans } from "@/lib/pricing";
import { journeyData } from "@/lib/journey";
import { contactInfo, servicesMenu, solutionsMenu, trainingMenu } from "@/lib/navigation";
import { Callout, KeyValue, PageHeader, Panel, Pill, btn, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Site content" };

/** Content that lives in code rather than in a table, and where to find it. */
const codeContent = [
  { name: "Services (8 detail pages)", file: "src/lib/services.ts", note: "Title, description, features, process, FAQ and meta tags per service." },
  { name: "Mega menu & search index", file: "src/lib/navigation.ts", note: "Services, Solutions and Training menus, plus contact details." },
  { name: "Portfolio (10 projects)", file: "src/lib/portfolio.ts", note: "Case-study cards and detail pages under /portfolio." },
  { name: "Pricing plans & add-ons", file: "src/lib/pricing.ts and src/app/(site)/pricing/PricingClient.tsx", note: "Plans in lib; add-ons and FAQ in the page." },
  { name: "Testimonials", file: "Database — edit at /admin/testimonials", note: "Falls back to the five built-in cards while the table is empty." },
  { name: "Partners (4 logos)", file: "src/components/home/Partners.tsx", note: "Meta, AUDI Pakistan, Shahnawaz Motors, Microsoft." },
  { name: "Homepage FAQ & stats", file: "FAQ in database — edit at /admin/faqs; stats in src/app/(site)/page.tsx", note: "FAQ is also emitted as FAQPage schema." },
  { name: "About: mission, CEO message, values", file: "src/app/(site)/about/AboutClient.tsx", note: "Journey timeline data is in src/lib/journey.ts." },
  { name: "Careers roles (3)", file: "src/app/(site)/careers/CareersClient.tsx", note: "Role ids must match roleTitles in src/app/api/apply/route.ts." },
  { name: "Academy courses (3, hardcoded)", file: "src/app/(site)/courses/CoursesClient.tsx", note: "Not yet read from the Course table." },
  { name: "Trading page services (6)", file: "src/app/(site)/trading/TradingClient.tsx", note: "PSX, PMEX, Binance, risk, signals, analytics." },
  { name: "AI Solutions page", file: "src/app/(site)/ai-solutions/AISolutionsClient.tsx", note: "Chatbots, agents, voice, automation showcase." },
  { name: "City pages (3)", file: "src/app/(site)/digital-marketing-agency-{lahore,karachi,islamabad}/page.tsx", note: "Each carries its own FAQ and LocalBusiness schema." },
  { name: "Legal pages (5)", file: "src/app/(site)/{terms,privacy,cookies,refund,compliance}/page.tsx", note: "All noindex; rendered through components/LegalPage.tsx." },
  { name: "Footer links & tagline", file: "src/components/Footer.tsx", note: "Four link columns and social icons." },
  { name: "Chatbot", file: "public/chatbot/", note: "Standalone scripted bot embedded by components/ChatWidget.tsx in an iframe." },
];

export default async function ContentPage() {
  await requireAdminPage("content.write");
  const menuCount = (menu: typeof servicesMenu) => menu.reduce((n, col) => n + col.items.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Site content"
        description="Most of the marketing site is defined in code, not in the database. This page shows what is live and which file each piece comes from, so edits go to the right place."
      />

      <Callout tone="cyan" icon={Code2} className="mb-8" title="Editing these means a code change and a deploy">
        Pushing to the main branch triggers the Hostinger deploy workflow. Blog posts and courses are the only content
        edited from the database.
      </Callout>

      <div className="space-y-8">
        <Panel id="services" bodyClassName="p-0" title="Services" description="src/lib/services.ts — each entry is a page at /services/[slug]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={thClass}>Service</th>
                  <th className={thClass}>Meta title</th>
                  <th className={thClass}>Features</th>
                  <th className={thClass}>Process</th>
                  <th className={thClass}>FAQ</th>
                  <th className={`${thClass} text-right`}>Page</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.slug} className={trClass}>
                    <td className={`${tdClass} max-w-sm`}>
                      <span className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: service.iconBg, color: service.iconColor }}>
                          <service.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-slate-900">{service.title}</span>
                          <span className="block truncate text-xs text-slate-500">{service.desc}</span>
                        </span>
                      </span>
                    </td>
                    <td className={`${tdClass} text-slate-500`}>{service.metaTitle}</td>
                    <td className={`${tdClass} text-slate-500`}>{service.features.length}</td>
                    <td className={`${tdClass} text-slate-500`}>{service.processSteps.length}</td>
                    <td className={`${tdClass} text-slate-500`}>{service.faq.length}</td>
                    <td className={`${tdClass} text-right`}>
                      <a href={`/services/${service.slug}`} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
                        /services/{service.slug} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Navigation menus" description="src/lib/navigation.ts">
            <KeyValue
              items={[
                { label: "Services menu", value: `${servicesMenu.length} columns · ${menuCount(servicesMenu)} links` },
                { label: "Solutions menu", value: `${solutionsMenu.length} columns · ${menuCount(solutionsMenu)} links` },
                { label: "Training menu", value: `${trainingMenu.length} columns · ${menuCount(trainingMenu)} links (all point to /courses)` },
                { label: "Primary nav", value: "Home · About · Services · Solutions · Training · Portfolio · Blog · Contact" },
              ]}
            />
          </Panel>

          <Panel title="Contact details" description="src/lib/navigation.ts (contactInfo) and the Organization schema in src/app/layout.tsx">
            <KeyValue
              items={[
                { label: "Phone", value: contactInfo.phone },
                { label: "WhatsApp", value: `+${contactInfo.whatsapp} (forms open this number after submit)` },
                { label: "Email", value: contactInfo.email },
                {
                  label: "Social",
                  value: (
                    <span className="flex flex-wrap gap-3">
                      {Object.entries(contactInfo.social).map(([name, url]) => (
                        <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="capitalize text-cyan-700 hover:underline">
                          {name}
                        </a>
                      ))}
                    </span>
                  ),
                },
                { label: "Lead notifications", value: "Emailed via Resend to the address set in src/app/api/contact/route.ts and api/apply/route.ts" },
              ]}
            />
          </Panel>
        </div>

        <Panel id="portfolio" bodyClassName="p-0" title="Portfolio" description="src/lib/portfolio.ts — each entry is a page at /portfolio/[slug]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={thClass}>Project</th>
                  <th className={thClass}>Category</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Year</th>
                  <th className={thClass}>Stack</th>
                  <th className={`${thClass} text-right`}>Page</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.slug} className={trClass}>
                    <td className={`${tdClass} max-w-xs`}>
                      <span className="block font-semibold text-slate-900">{project.title}</span>
                      <span className="block truncate text-xs text-slate-500">{project.desc}</span>
                    </td>
                    <td className={tdClass}>
                      <Pill tone="purple">{project.category}</Pill>
                    </td>
                    <td className={`${tdClass} text-slate-500`}>{project.client}</td>
                    <td className={`${tdClass} text-slate-500`}>{project.year}</td>
                    <td className={`${tdClass} text-xs text-slate-500`}>{project.tech.join(", ")}</td>
                    <td className={`${tdClass} text-right`}>
                      <a href={`/portfolio/${project.slug}`} target="_blank" rel="noopener noreferrer" className={btn.ghost}>
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel id="pricing" title="Pricing plans" description="src/lib/pricing.ts — shown on /pricing and the homepage CTA">
            <div className="space-y-3">
              {plans.map((plan) => (
                <div key={plan.name} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: plan.bg, color: plan.color }}>
                    <plan.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{plan.name}</span>
                      {plan.popular && <Pill tone="cyan">Most popular</Pill>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{plan.desc}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold text-slate-900">
                      {plan.price}
                      <span className="text-xs font-normal text-slate-500">{plan.period}</span>
                    </span>
                    <span className="block text-xs text-slate-500">{plan.features.length} features</span>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Company journey" description="src/lib/journey.ts — the orbital timeline on /about">
            <ol className="space-y-2">
              {journeyData.map((item) => (
                <li key={item.id} className="flex items-center gap-3 text-sm">
                  <Pill tone={item.status === "completed" ? "green" : item.status === "in-progress" ? "amber" : "slate"}>
                    {item.status}
                  </Pill>
                  <span className="font-semibold text-slate-900">{item.title}</span>
                  <span className="ml-auto whitespace-nowrap text-xs text-slate-500">{item.date}</span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <Panel bodyClassName="p-0" title="Where everything else lives" description="Content that is not exported from a data file">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={thClass}>Content</th>
                  <th className={thClass}>File</th>
                  <th className={thClass}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {codeContent.map((row) => (
                  <tr key={row.name} className={trClass}>
                    <td className={`${tdClass} whitespace-nowrap font-semibold text-slate-900`}>{row.name}</td>
                    <td className={`${tdClass} font-mono text-xs text-cyan-700/90`}>{row.file}</td>
                    <td className={`${tdClass} text-slate-500`}>{row.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <p className="text-xs text-slate-500">
          Blog articles are managed under <Link href="/admin/blog" className="text-cyan-700 hover:underline">Blog</Link>, courses under{" "}
          <Link href="/admin/courses" className="text-cyan-700 hover:underline">Courses</Link>.
        </p>
      </div>
    </>
  );
}
