import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, Globe, Phone, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { LEAD_STATUS_META, normalizeStatus } from "@/lib/admin/leads";
import { getCompany } from "@/lib/automation/lead-queries";
import { phoneDigits } from "@/lib/automation/normalize";
import { CopyButton } from "@/components/admin/automation/SmallForms";
import { Hero, HeroStat, heroBtn } from "@/components/admin/automation/parts";
import { DbUnavailable, EmptyState, KeyValue, PageHeader, Panel, Pill, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("leads.read");
  const { id } = await params;
  const result = await getCompany(id);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="CRM" title="Company" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  const company = result.data;
  if (!company) notFound();

  const locations = [...new Set(company.leads.map((lead) => lead.contactLocation).filter((l): l is string => Boolean(l)))];
  const contacted = company.leads.filter((lead) => lead.lastContactedAt).length;

  return (
    <>
      <Link href="/admin/companies" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All companies
      </Link>

      <Hero
        avatar={
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-cyan-300">
            <Building2 className="h-6 w-6" />
          </span>
        }
        eyebrow="Company"
        title={company.name}
        subtitle={company.domain ?? undefined}
        actions={
          <>
            {company.website && (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className={heroBtn.primary}>
                <Globe className="h-4 w-4" /> Visit website
              </a>
            )}
            {company.phone && (
              <a href={`tel:+${phoneDigits(company.phone)}`} className={heroBtn.secondary}>
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            <Link href={`/admin/leads?company=${encodeURIComponent(company.name)}`} className={heroBtn.secondary}>
              <Users className="h-4 w-4" /> In the lead list
            </Link>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <HeroStat label="Contacts" value={company.leads.length.toLocaleString()} />
          <HeroStat label="Contacted" value={`${contacted} of ${company.leads.length}`} />
          <HeroStat label="In the CRM since" value={formatDate(company.createdAt)} />
        </div>
      </Hero>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel bodyClassName="p-0" title={`Contacts (${company.leads.length})`} description="Everyone at this company who is a lead.">
            {company.leads.length === 0 ? (
              <EmptyState icon={Users} title="No contacts" description="The leads that belonged to this company were deleted or moved." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Contact</th>
                      <th className={thClass}>Email</th>
                      <th className={thClass}>Status</th>
                      <th className={thClass}>Last contacted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {company.leads.map((lead) => {
                      const status = normalizeStatus(lead.status);
                      return (
                        <tr key={lead.id} className={trClass}>
                          <td className={tdClass}>
                            <Link href={`/admin/leads/${lead.id}`} className="font-semibold text-slate-900 hover:text-cyan-700">
                              {lead.name}
                            </Link>
                            <span className="block text-xs text-slate-500">{[lead.jobTitle, lead.contactLocation].filter(Boolean).join(" · ")}</span>
                          </td>
                          <td className={`${tdClass} text-slate-600`}>{lead.outreachEmail || lead.email || <span className="text-slate-400">No email</span>}</td>
                          <td className={tdClass}>
                            <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
                          </td>
                          <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : "Never"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Company description" actions={company.description ? <CopyButton text={company.description} /> : null}>
            {company.description ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">{company.description}</p>
            ) : (
              <p className="text-sm text-slate-400">None on file.</p>
            )}
          </Panel>
        </div>

        <Panel title="Details" className="lg:self-start">
          <KeyValue
            items={[
              { label: "Company name", value: company.name },
              {
                label: "Website",
                value: company.website ? (
                  <a href={company.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-cyan-700 hover:underline">
                    {company.domain ?? company.website} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
              },
              { label: "Company phone", value: company.phone ?? <span className="text-slate-400">—</span> },
              {
                label: "Location",
                value: company.location ?? (locations.length ? <span title="Where its contacts are">{locations.slice(0, 3).join("; ")}</span> : <span className="text-slate-400">Not known</span>),
              },
              { label: "Industry", value: company.industry ?? <span className="text-slate-400">Not known</span> },
              { label: "Employees", value: company.employees ?? <span className="text-slate-400">Not known</span> },
            ]}
          />
          <p className="mt-3 text-xs text-slate-500">Industry and employee count are not in the prospect sheet. They stay empty until a source provides them.</p>
        </Panel>
      </div>
    </>
  );
}
