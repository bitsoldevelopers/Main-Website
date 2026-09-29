import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ExternalLink,
  Globe,
  Mail,
  MessageCircle,
  Pause,
  Pencil,
  Phone,
  Play,
  Reply,
  Square,
  StickyNote,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { paramFrom } from "@/lib/admin/queries";
import { listAssignees } from "@/lib/admin/queries-crm";
import { hasPermission } from "@/lib/admin/rbac";
import {
  LEAD_KIND_LABELS,
  LEAD_PRIORITIES,
  LEAD_PRIORITY_META,
  LEAD_STATUSES,
  LEAD_STATUS_META,
  extractPortfolioUrl,
  isLeadPriority,
  leadKind,
  leadSourceLabel,
  leadTopic,
  normalizeStatus,
} from "@/lib/admin/leads";
import { formatDate, initials, timeAgo } from "@/lib/admin/format";
import { deleteLead, updateLeadStatus } from "@/app/admin/actions";
import { markReplied, pauseLeadAutomation, resumeLeadAutomation, setTaskStatus, stopLeadAutomation } from "@/app/admin/actions-automation";
import { addLeadNote, assignLead, deleteLeadNote, setLeadFollowUp, setLeadPriority } from "@/app/admin/actions-crm";
import { addLeadTags, removeLeadTag, setOutreachEmail } from "@/app/admin/actions-leads";
import { stopReasonForStatus, stopReasonLabel } from "@/lib/automation/conditions";
import { PHONE_TYPE_LABELS, type PhoneType } from "@/lib/automation/import-parse";
import { SKIP_REASON_LABELS, messageBadge, relativeTime, runBadge, taskBadge } from "@/lib/automation/labels";
import { candidateEmails } from "@/lib/automation/lead-contacts";
import { getLeadProfile } from "@/lib/automation/lead-queries";
import { phoneDigits } from "@/lib/automation/normalize";
import { EMAIL_TYPES, EMAIL_TYPE_LABELS, SELECTION_REASON_LABELS } from "@/lib/automation/outreach-email";
import { hasEnoughFacts, isPersonalizerConfigured } from "@/lib/automation/personalize";
import { listActiveAutomations } from "@/lib/automation/queries";
import { SUPPRESSION_REASON_LABELS } from "@/lib/automation/suppression";
import { EMAIL_REASON_LABELS, type EmailReason } from "@/lib/automation/validate";
import { LeadTimeline } from "@/components/admin/automation/LeadTimeline";
import { CopyButton, PersonalizationForm, StartAutomationForm, TaskForm } from "@/components/admin/automation/SmallForms";
import { Hero, HeroStat, Tag, ValidityBadge, heroBtn } from "@/components/admin/automation/parts";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import { Callout, DbUnavailable, KeyValue, PageHeader, Panel, Pill, btn, inputClass, selectClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Lead" };

type SearchParams = Record<string, string | string[] | undefined>;

const PHONE_ORDER: PhoneType[] = ["PRIMARY", "SECONDARY", "TERTIARY", "COMPANY"];
const PHONE_ROLE: Record<PhoneType, string> = {
  PRIMARY: "Primary contact",
  SECONDARY: "Secondary contact",
  TERTIARY: "Secondary contact",
  COMPANY: "Company phone",
};

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{children}</h3>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

const missing = <span className="text-slate-400">—</span>;

export default async function LeadProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  await requireAdminPage("leads.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "leads.write") : false;
  const canOutreach = session ? hasPermission(session.role, "outreach.write") : false;

  const { id } = await params;
  const error = paramFrom((await searchParams).error);
  const [result, assigneesResult, automationsResult] = await Promise.all([getLeadProfile(id), listAssignees(), listActiveAutomations()]);

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="CRM" title="Lead" />
        <DbUnavailable error={result.error} />
      </>
    );
  }
  if (!result.data) notFound();

  const { lead, selection, suppression, sharedEmails } = result.data;
  const assignees = assigneesResult.ok ? assigneesResult.data : [];
  const automations = automationsResult.ok ? automationsResult.data : [];

  const status = normalizeStatus(lead.status);
  const priority = isLeadPriority(lead.priority) ? lead.priority : "NORMAL";
  const kind = leadKind(lead.subject);
  const portfolio = kind === "application" ? extractPortfolioUrl(lead.message) : null;
  const location = lead.contactLocation || [lead.city, lead.country].filter(Boolean).join(", ");
  // Server Component: rendered per request, so "now" is the request time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const followUpValue = lead.followUpAt ? lead.followUpAt.toISOString().slice(0, 10) : "";
  const followUpDue = lead.followUpAt && lead.followUpAt.getTime() < now;

  const stored = new Map(lead.emails.map((e) => [e.type, e]));
  const candidates = candidateEmails(lead);
  const outreach = selection.selected_email;
  const mailTo = outreach ?? candidates[0]?.email ?? "";
  const mailSubject = encodeURIComponent(kind === "application" ? "Your application to BITSOL Marketing" : kind === "prospect" ? "BITSOL Marketing" : "Re: your inquiry to BITSOL Marketing");

  const phones = lead.phones.length > 0 ? lead.phones : lead.phone ? [{ id: "legacy", type: "PRIMARY", phone: lead.phone, phoneKey: "" }] : [];
  const callPhone = phones.find((p) => p.type !== "COMPANY") ?? phones[0];

  const openRun = lead.runs.find((run) => run.status === "ACTIVE" || run.status === "PAUSED");
  const pastRuns = lead.runs.filter((run) => run !== openRun);
  const stopStatus = stopReasonForStatus(lead.status);
  const emailsSent = lead.messages.filter((m) => m.sentAt).length;
  const startBlocked = !outreach
    ? selection.selection_reason === "NO_EMAIL"
      ? "This lead has no email address."
      : "None of this lead's addresses may be emailed."
    : stopStatus
      ? `${stopReasonLabel(stopStatus)}. Change the status first if outreach should start again.`
      : undefined;
  const hasAttribution = lead.pageUrl || lead.utmSource || lead.utmMedium || lead.utmCampaign;
  const colleagues = lead.companyRef?.leads.filter((other) => other.id !== lead.id) ?? [];
  const openTasks = lead.tasks.filter((task) => task.status === "OPEN");

  return (
    <>
      <Link href="/admin/leads" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All leads
      </Link>

      <Hero
        avatar={
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-purple text-lg font-black text-brand-dark">
            {initials(lead.name)}
          </span>
        }
        eyebrow={LEAD_KIND_LABELS[kind]}
        title={lead.name}
        subtitle={[lead.jobTitle, lead.company, location].filter(Boolean).join(" · ") || (kind !== "prospect" ? leadTopic(lead.subject) : undefined)}
        meta={
          <>
            <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
            {priority !== "NORMAL" && <Pill tone={LEAD_PRIORITY_META[priority].tone}>{LEAD_PRIORITY_META[priority].label}</Pill>}
            <span>{leadSourceLabel(lead.source)}</span>
            <span>Added {timeAgo(lead.createdAt)}</span>
          </>
        }
        actions={
          <>
            {mailTo && (
              <a href={`mailto:${mailTo}?subject=${mailSubject}`} className={heroBtn.primary}>
                <Mail className="h-4 w-4" /> Email
              </a>
            )}
            {callPhone && (
              <a href={`tel:+${phoneDigits(callPhone.phone)}`} className={heroBtn.secondary}>
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {lead.linkedinUrl && (
              <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className={heroBtn.secondary}>
                <UserRound className="h-4 w-4" /> LinkedIn
              </a>
            )}
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer" className={heroBtn.secondary}>
                <Globe className="h-4 w-4" /> Website
              </a>
            )}
            {portfolio && (
              <a href={portfolio} target="_blank" rel="noopener noreferrer" className={heroBtn.secondary}>
                Portfolio <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {canWrite && (
              <>
                <a href="#notes" className={heroBtn.secondary}>
                  <StickyNote className="h-4 w-4" /> Add note
                </a>
                <a href="#assign" className={heroBtn.secondary}>
                  <UserPlus className="h-4 w-4" /> Assign
                </a>
              </>
            )}
            {canOutreach &&
              (openRun?.status === "ACTIVE" ? (
                <form action={pauseLeadAutomation}>
                  <input type="hidden" name="leadId" value={lead.id} />
                  <SubmitButton className={heroBtn.secondary} pendingText="Pausing…">
                    <Pause className="h-4 w-4" /> Pause automation
                  </SubmitButton>
                </form>
              ) : (
                <a href="#automation" className={heroBtn.secondary}>
                  <Play className="h-4 w-4" /> {openRun ? "Resume automation" : "Start automation"}
                </a>
              ))}
            {canWrite && (
              <Link href={`/admin/leads/${lead.id}/edit`} className={heroBtn.secondary}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            )}
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <HeroStat label="Outreach email" value={outreach ?? "None"} hint={SELECTION_REASON_LABELS[selection.selection_reason]} />
          <HeroStat
            label="Automation"
            value={openRun ? `${runBadge(openRun.status).label}: ${openRun.automation.name}` : lead.runs[0] ? `${runBadge(lead.runs[0].status).label}` : "Not started"}
            hint={openRun?.status === "ACTIVE" && lead.nextFollowUpAt ? `Next email ${relativeTime(lead.nextFollowUpAt, now)}` : emailsSent ? `${emailsSent} email${emailsSent === 1 ? "" : "s"} sent` : undefined}
          />
          <HeroStat label="Last contacted" value={lead.lastContactedAt ? timeAgo(lead.lastContactedAt) : "Never"} />
          <HeroStat label="Owner" value={lead.assignedTo ? lead.assignedTo.name || lead.assignedTo.email : "Unassigned"} hint={openTasks.length ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"}` : undefined} />
        </div>
      </Hero>

      {error && (
        <Callout tone="red" icon={AlertTriangle} title="That did not work" className="mb-6">
          {error}
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel
            title="Contact information"
            actions={
              canWrite ? (
                <Link href={`/admin/leads/${lead.id}/edit`} className={btn.ghost}>
                  <Pencil className="h-4 w-4" /> Edit
                </Link>
              ) : null
            }
          >
            <div className="grid gap-x-10 gap-y-7 xl:grid-cols-2">
              <div>
                <SubHeading>Contact</SubHeading>
                <dl className="divide-y divide-slate-100">
                  <Row label="First Name">{lead.firstName || (lead.lastName ? missing : lead.name.split(/\s+/)[0]) || missing}</Row>
                  <Row label="Last Name">{lead.lastName || (lead.firstName ? missing : lead.name.split(/\s+/).slice(1).join(" ")) || missing}</Row>
                  <Row label="Title">{lead.jobTitle || missing}</Row>
                  <Row label="Location">{location || missing}</Row>
                </dl>
              </div>

              <div>
                <SubHeading>Online</SubHeading>
                <dl className="divide-y divide-slate-100">
                  <Row label="LinkedIn">
                    {lead.linkedinUrl ? (
                      <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-700 hover:underline">
                        Open profile <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      missing
                    )}
                    {lead.linkedinUrl && <span className="mt-0.5 block break-all text-xs text-slate-500">{lead.linkedinUrl}</span>}
                  </Row>
                  <Row label="Website">
                    {lead.website ? (
                      <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-700 hover:underline">
                        Visit website <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      missing
                    )}
                    {lead.website && <span className="mt-0.5 block break-all text-xs text-slate-500">{lead.website}</span>}
                  </Row>
                </dl>
              </div>

              <div id="emails" className="scroll-mt-24 xl:col-span-2">
                <SubHeading>Emails</SubHeading>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {EMAIL_TYPES.map((type) => {
                    const row = stored.get(type);
                    const candidate = candidates.find((c) => c.type === type);
                    const address = row?.email ?? candidate?.email;
                    if (!address || !candidate) {
                      return (
                        <li key={type} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                          <span className="font-semibold text-slate-500">{EMAIL_TYPE_LABELS[type]}</span>
                          <span className="text-slate-400">Not provided</span>
                        </li>
                      );
                    }
                    const isOutreach = outreach === address;
                    const skipped = selection.skipped.find((s) => s.email === address);
                    const blocked = suppression[candidate.emailKey];
                    const others = sharedEmails[candidate.emailKey] ?? [];
                    const reason = row?.validityReason ?? "";
                    return (
                      <li key={type} className={`flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isOutreach ? "bg-cyan-50/60" : ""}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-500">{EMAIL_TYPE_LABELS[type]}</p>
                          <p className="flex flex-wrap items-center gap-2">
                            <a href={`mailto:${address}`} className="break-all text-sm font-semibold text-slate-900 hover:text-cyan-700">
                              {address}
                            </a>
                            <ValidityBadge validity={candidate.validity} />
                            {isOutreach && <Pill tone="cyan">Outreach</Pill>}
                            {row?.bouncedAt && <Pill tone="red">Bounced</Pill>}
                            {blocked && <Pill tone="red">{SUPPRESSION_REASON_LABELS[blocked]}</Pill>}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {candidate.validity !== "VALID" && reason && reason !== "OK" ? `${EMAIL_REASON_LABELS[reason as EmailReason] ?? reason}. ` : ""}
                            {skipped && !isOutreach ? `Not used for outreach: ${SKIP_REASON_LABELS[skipped.reason]}. ` : ""}
                            {others.length > 0 && (
                              <>
                                Duplicate: also on{" "}
                                {others.map((other, i) => (
                                  <span key={other.id}>
                                    {i > 0 && ", "}
                                    <Link href={`/admin/leads/${other.id}`} className="font-semibold text-cyan-700 hover:underline">
                                      {other.name}
                                    </Link>
                                  </span>
                                ))}
                                .
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <CopyButton text={address} />
                          {canWrite && row && !isOutreach && !skipped && (
                            <form action={setOutreachEmail}>
                              <input type="hidden" name="leadId" value={lead.id} />
                              <input type="hidden" name="emailId" value={row.id} />
                              <SubmitButton variant="secondary" pendingText="…" className="px-3 py-1.5 text-xs">
                                Use for outreach
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  <li className="flex flex-col gap-2 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-500">Selected Outreach Email</p>
                      <p className="break-all text-sm font-bold text-slate-900">{outreach ?? "None"}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        <span className="font-mono">{selection.selection_reason}</span> · {SELECTION_REASON_LABELS[selection.selection_reason]}
                        {selection.risky && ". This address is risky; a better one was not available"}
                      </p>
                    </div>
                    {canWrite && lead.outreachLocked && (
                      <form action={setOutreachEmail}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <input type="hidden" name="emailId" value="auto" />
                        <SubmitButton variant="ghost" pendingText="…" className="text-xs">
                          Choose automatically
                        </SubmitButton>
                      </form>
                    )}
                  </li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">Automations send to one address only. The three addresses are stored separately and none replaces another.</p>
              </div>

              <div className="xl:col-span-2">
                <SubHeading>Phones</SubHeading>
                {phones.length === 0 ? (
                  <p className="text-sm text-slate-400">No phone numbers.</p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {PHONE_ORDER.flatMap((type) => phones.filter((p) => p.type === type)).map((phone) => {
                      const digits = phoneDigits(phone.phone);
                      const type = phone.type as PhoneType;
                      return (
                        <li key={phone.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-500">
                              {PHONE_TYPE_LABELS[type] ?? phone.type} <span className="font-normal text-slate-400">· {PHONE_ROLE[type] ?? ""}</span>
                            </p>
                            <p className="truncate text-sm font-semibold text-slate-900">{phone.phone}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {digits.length >= 7 && (
                              <a href={`tel:+${digits}`} className={btn.icon} title="Call">
                                <Phone className="h-4 w-4" />
                                <span className="sr-only">Call {phone.phone}</span>
                              </a>
                            )}
                            {digits.length >= 10 && type !== "COMPANY" && (
                              <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className={btn.icon} title="WhatsApp">
                                <MessageCircle className="h-4 w-4" />
                                <span className="sr-only">WhatsApp {phone.phone}</span>
                              </a>
                            )}
                            <CopyButton text={phone.phone} label="" className="px-2" />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </Panel>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-cyan-700" /> Company
              </span>
            }
            actions={
              lead.companyRef ? (
                <Link href={`/admin/companies/${lead.companyRef.id}`} className={btn.ghost}>
                  Company page <ExternalLink className="h-4 w-4" />
                </Link>
              ) : null
            }
          >
            {!lead.company && !lead.companyRef && !lead.companyDescription ? (
              <p className="text-sm text-slate-500">No company on file for this lead.</p>
            ) : (
              <div className="space-y-6">
                <dl className="divide-y divide-slate-100">
                  <Row label="Company Name">{lead.companyRef?.name ?? lead.company ?? missing}</Row>
                  <Row label="Website">
                    {lead.companyRef?.website || lead.website ? (
                      <a href={(lead.companyRef?.website || lead.website) as string} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-700 hover:underline">
                        {lead.companyRef?.domain || lead.website}
                      </a>
                    ) : (
                      missing
                    )}
                  </Row>
                  <Row label="Company Phone">{lead.companyRef?.phone ?? phones.find((p) => p.type === "COMPANY")?.phone ?? missing}</Row>
                  <Row label="Location">{lead.companyRef?.location ?? <span className="text-slate-400">Not known</span>}</Row>
                  <Row label="Industry">{lead.companyRef?.industry ?? <span className="text-slate-400">Not known</span>}</Row>
                  <Row label="Employees">{lead.companyRef?.employees ?? <span className="text-slate-400">Not known</span>}</Row>
                </dl>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <SubHeading>Company Description</SubHeading>
                    {lead.companyDescription && (
                      <span className="flex items-center gap-1">
                        <CopyButton text={lead.companyDescription} />
                        {canWrite && (
                          <Link href={`/admin/leads/${lead.id}/edit#lead-description`} className={`${btn.ghost} px-2 py-1 text-xs`}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Link>
                        )}
                      </span>
                    )}
                  </div>
                  {lead.companyDescription ? (
                    <p className="whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-800">{lead.companyDescription}</p>
                  ) : (
                    <p className="text-sm text-slate-400">
                      None.{" "}
                      {canWrite && (
                        <Link href={`/admin/leads/${lead.id}/edit#lead-description`} className="font-semibold text-cyan-700 hover:underline">
                          Add one
                        </Link>
                      )}
                    </p>
                  )}
                </div>

                <div>
                  <SubHeading>Personalised line</SubHeading>
                  <PersonalizationForm
                    leadId={lead.id}
                    initial={lead.personalization ?? ""}
                    aiConfigured={isPersonalizerConfigured()}
                    hasFacts={hasEnoughFacts({ companyName: lead.company, website: lead.website, companyDescription: lead.companyDescription })}
                    canEdit={canWrite}
                  />
                </div>

                {lead.companyRef && (
                  <div>
                    <SubHeading>
                      Contacts at {lead.companyRef.name} ({lead.companyRef._count.leads})
                    </SubHeading>
                    <ul className="border-l-2 border-slate-200 pl-4">
                      {[lead, ...colleagues].map((person, i) => {
                        const personStatus = normalizeStatus(person.status);
                        const self = i === 0;
                        return (
                          <li key={person.id} className="relative py-1.5 text-sm before:absolute before:-left-4 before:top-1/2 before:h-px before:w-3 before:bg-slate-200">
                            {self ? (
                              <span className="font-semibold text-slate-900">{person.name}</span>
                            ) : (
                              <Link href={`/admin/leads/${person.id}`} className="font-semibold text-cyan-700 hover:underline">
                                {person.name}
                              </Link>
                            )}
                            {person.jobTitle && <span className="text-slate-500"> — {person.jobTitle}</span>}
                            {self ? <span className="ml-2 text-xs text-slate-400">this lead</span> : <Pill tone={LEAD_STATUS_META[personStatus].tone} className="ml-2">{LEAD_STATUS_META[personStatus].label}</Pill>}
                          </li>
                        );
                      })}
                    </ul>
                    {lead.companyRef._count.leads > colleagues.length + 1 && (
                      <Link href={`/admin/companies/${lead.companyRef.id}`} className="mt-2 inline-block text-xs font-semibold text-cyan-700 hover:underline">
                        All {lead.companyRef._count.leads} contacts
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>

          {kind !== "prospect" && lead.message && (
            <Panel title="Message" description={`${kind === "application" ? "Role" : "Service"}: ${leadTopic(lead.subject)}`}>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{lead.message}</p>
            </Panel>
          )}

          {lead.messages.length > 0 && (
            <Panel title={`Emails sent (${lead.messages.length})`} description="By automations. Open one to read what the lead received.">
              <ul className="space-y-2">
                {lead.messages.map((message) => {
                  const badge = messageBadge(message.status);
                  return (
                    <li key={message.id}>
                      <details className="group rounded-xl border border-slate-200">
                        <summary className="flex cursor-pointer list-none flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900 group-open:whitespace-normal">{message.subject}</span>
                            <span className="block text-xs text-slate-500">
                              To {message.toEmail} · {message.sentAt ? formatDate(message.sentAt, { time: true }) : "not sent"}
                              {message.openedAt && ` · opened ${timeAgo(message.openedAt)}`}
                              {message.provider === "test" && " · test mode, not delivered"}
                            </span>
                          </span>
                          <Pill tone={badge.tone} className="shrink-0 self-start sm:self-center">
                            {badge.label}
                          </Pill>
                        </summary>
                        <div className="border-t border-slate-100 px-4 py-4">
                          {message.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{message.error}</p>}
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{message.bodyText}</p>
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          <Panel title="Timeline" description="Everything that has happened to this lead, newest first.">
            <LeadTimeline items={lead.activities} />
          </Panel>

          <Panel id="notes" className="scroll-mt-24" title={`Notes (${lead.notes.length})`} description="Internal only — the lead never sees these.">
            {canWrite && (
              <form action={addLeadNote} className="mb-5 space-y-3">
                <input type="hidden" name="leadId" value={lead.id} />
                <textarea name="body" rows={3} required placeholder="Call summary, next step, anything the next person should know…" className={inputClass} />
                <SubmitButton pendingText="Adding…">Add note</SubmitButton>
              </form>
            )}
            {lead.notes.length === 0 ? (
              <p className="text-sm text-slate-500">No notes yet.</p>
            ) : (
              <ol className="space-y-4">
                {lead.notes.map((note) => (
                  <li key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>
                        <span className="font-semibold text-slate-900">{note.author}</span> · {timeAgo(note.createdAt)}
                      </span>
                      {canWrite && (
                        <form action={deleteLeadNote}>
                          <input type="hidden" name="id" value={note.id} />
                          <input type="hidden" name="leadId" value={lead.id} />
                          <button type="submit" className="text-slate-500 transition hover:text-red-600">
                            Delete
                          </button>
                        </form>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel id="automation" className="scroll-mt-24" title="Automation">
            {openRun ? (
              <div className="space-y-4">
                <div>
                  <p className="flex items-center gap-2">
                    <Pill tone={runBadge(openRun.status).tone}>{runBadge(openRun.status).label}</Pill>
                    <Link href={`/admin/automation/automations/${openRun.automation.id}`} className="min-w-0 truncate text-sm font-semibold text-cyan-700 hover:underline">
                      {openRun.automation.name}
                    </Link>
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {openRun.emailsSent} email{openRun.emailsSent === 1 ? "" : "s"} sent.
                    {openRun.status === "ACTIVE" && lead.followUps[0] && (
                      <>
                        {" "}
                        Next: <span className="font-semibold text-slate-900">{lead.followUps[0].title}</span>, <span title={formatDate(lead.followUps[0].dueAt, { time: true })}>{relativeTime(lead.followUps[0].dueAt, now)}</span>.
                      </>
                    )}
                    {openRun.status === "ACTIVE" && !lead.followUps[0] && openRun.emailsSent === 0 && " The first email goes out within a minute."}
                    {openRun.status === "PAUSED" && " Nothing is sent while it is paused."}
                  </p>
                  {openRun.automation.status !== "ACTIVE" && (
                    <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">The automation itself is {openRun.automation.status.toLowerCase()}, so nothing is sent.</p>
                  )}
                </div>
                {canOutreach && (
                  <div className="grid gap-2">
                    {openRun.status === "ACTIVE" ? (
                      <form action={pauseLeadAutomation}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <SubmitButton variant="secondary" pendingText="Pausing…" className="w-full">
                          <Pause className="h-4 w-4" /> Pause automation
                        </SubmitButton>
                      </form>
                    ) : (
                      <form action={resumeLeadAutomation}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <SubmitButton pendingText="Resuming…" className="w-full">
                          <Play className="h-4 w-4" /> Resume automation
                        </SubmitButton>
                      </form>
                    )}
                    <form action={stopLeadAutomation}>
                      <input type="hidden" name="leadId" value={lead.id} />
                      <ConfirmButton variant="ghost" message="Stop the automation for this lead? No more emails will be sent from it." className="w-full">
                        <Square className="h-4 w-4" /> Stop automation
                      </ConfirmButton>
                    </form>
                  </div>
                )}
              </div>
            ) : canOutreach ? (
              <StartAutomationForm leadId={lead.id} automations={automations} disabledReason={startBlocked} />
            ) : (
              <p className="text-sm text-slate-500">Not in an automation.</p>
            )}

            {canWrite && emailsSent > 0 && lead.status !== "REPLIED" && (
              <form action={markReplied} className="mt-4 border-t border-slate-100 pt-4">
                <input type="hidden" name="leadId" value={lead.id} />
                <SubmitButton variant="secondary" pendingText="Saving…" className="w-full">
                  <Reply className="h-4 w-4" /> Mark as replied
                </SubmitButton>
                <p className="mt-2 text-xs text-slate-500">Use this when the reply reached a person&apos;s inbox. It stops the automation and creates a task.</p>
              </form>
            )}

            {pastRuns.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                {pastRuns.map((run) => (
                  <li key={run.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-700">{run.automation.name}</span>
                      {run.emailsSent} sent · {formatDate(run.startedAt)}
                      {run.stopReason && <span className="block">{stopReasonLabel(run.stopReason)}</span>}
                    </span>
                    <Pill tone={runBadge(run.status).tone}>{runBadge(run.status).label}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Status">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
              <span className="text-xs text-slate-500">{LEAD_STATUS_META[status].hint}</span>
            </div>
            {canWrite && (
              <form action={updateLeadStatus} className="space-y-3">
                <input type="hidden" name="id" value={lead.id} />
                <select name="status" defaultValue={status} className={selectClass} aria-label="Lead status">
                  {LEAD_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {LEAD_STATUS_META[value].label}
                    </option>
                  ))}
                </select>
                <SubmitButton pendingText="Saving…" className="w-full">
                  Update status
                </SubmitButton>
              </form>
            )}
          </Panel>

          <Panel title={`Tasks (${openTasks.length} open)`}>
            {lead.tasks.length > 0 && (
              <ul className="mb-4 space-y-2">
                {lead.tasks.map((task) => (
                  <li key={task.id} className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 p-3">
                    <span className="min-w-0">
                      <span className={`block text-sm font-semibold ${task.status === "OPEN" ? "text-slate-900" : "text-slate-400 line-through"}`}>{task.title}</span>
                      <span className="block text-xs text-slate-500">
                        {task.dueAt ? `Due ${relativeTime(task.dueAt, now)}` : "No due date"}
                        {task.assignedTo && ` · ${task.assignedTo.name || task.assignedTo.email}`}
                      </span>
                    </span>
                    {canWrite ? (
                      <form action={setTaskStatus}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="status" value={task.status === "OPEN" ? "DONE" : "OPEN"} />
                        <SubmitButton variant="ghost" pendingText="…" className="px-2 py-1 text-xs">
                          {task.status === "OPEN" ? "Done" : "Reopen"}
                        </SubmitButton>
                      </form>
                    ) : (
                      <Pill tone={taskBadge(task.status).tone}>{taskBadge(task.status).label}</Pill>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && <TaskForm leadId={lead.id} compact assignees={assignees.map((u) => ({ id: u.id, name: u.name || u.email }))} />}
          </Panel>

          <Panel title="Tags">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {lead.tags.length === 0 && <span className="text-sm text-slate-400">No tags.</span>}
              {lead.tags.map(({ tag }) =>
                canWrite ? (
                  <form key={tag.id} action={removeLeadTag} className="inline-flex items-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                    <input type="hidden" name="leadId" value={lead.id} />
                    <input type="hidden" name="tagId" value={tag.id} />
                    <Link href={`/admin/leads?tag=${tag.id}`} className="py-0.5 pl-2 hover:text-slate-900">
                      {tag.name}
                    </Link>
                    <button type="submit" aria-label={`Remove tag ${tag.name}`} className="grid h-5 w-5 place-items-center rounded hover:bg-slate-200 hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </form>
                ) : (
                  <Tag key={tag.id} href={`/admin/leads?tag=${tag.id}`}>
                    {tag.name}
                  </Tag>
                )
              )}
            </div>
            {canWrite && (
              <form action={addLeadTags} className="flex gap-2">
                <input type="hidden" name="leadId" value={lead.id} />
                <input name="tags" placeholder="Add tags, comma separated" className={inputClass} aria-label="Tags to add" required />
                <SubmitButton variant="secondary" pendingText="…">
                  Add
                </SubmitButton>
              </form>
            )}
          </Panel>

          <Panel title="Priority">
            <form action={setLeadPriority} className="space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <select name="priority" defaultValue={priority} className={selectClass} aria-label="Priority" disabled={!canWrite}>
                {LEAD_PRIORITIES.map((value) => (
                  <option key={value} value={value}>
                    {LEAD_PRIORITY_META[value].label}
                  </option>
                ))}
              </select>
              {canWrite && (
                <SubmitButton pendingText="Saving…" className="w-full">
                  Set priority
                </SubmitButton>
              )}
            </form>
          </Panel>

          <Panel id="assign" className="scroll-mt-24" title="Assigned to">
            {assignees.length === 0 ? (
              <p className="text-sm text-slate-500">
                No assignable team accounts yet. Create them under{" "}
                <Link href="/admin/users" className="text-cyan-700 hover:underline">
                  Users
                </Link>{" "}
                with the Admin, Business Development Manager or Editor role.
              </p>
            ) : (
              <form action={assignLead} className="space-y-3">
                <input type="hidden" name="id" value={lead.id} />
                <select name="userId" defaultValue={lead.assignedTo?.id ?? ""} className={selectClass} aria-label="Assignee" disabled={!canWrite}>
                  <option value="">Unassigned</option>
                  {assignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
                {canWrite && (
                  <SubmitButton pendingText="Saving…" className="w-full">
                    Assign
                  </SubmitButton>
                )}
              </form>
            )}
          </Panel>

          <Panel title="Follow-up">
            {followUpDue && (
              <p className="mb-3 rounded-xl border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-700">
                Follow-up was due {timeAgo(lead.followUpAt as Date)}.
              </p>
            )}
            <form action={setLeadFollowUp} className="space-y-3">
              <input type="hidden" name="id" value={lead.id} />
              <input type="date" name="followUpAt" defaultValue={followUpValue} className={inputClass} aria-label="Follow-up date" disabled={!canWrite} />
              {canWrite && (
                <SubmitButton pendingText="Saving…" className="w-full">
                  {followUpValue ? "Update follow-up" : "Set follow-up"}
                </SubmitButton>
              )}
            </form>
            <p className="mt-3 text-xs text-slate-500">A reminder for a person. Clear the date and save to remove it. Automated follow-up emails are scheduled by the automation.</p>
          </Panel>

          <Panel title="Source" description="Where this lead came from.">
            <KeyValue
              items={[
                { label: "Lead source", value: leadSourceLabel(lead.source) },
                ...(lead.sourceName ? [{ label: "Source name", value: lead.sourceName }] : []),
                ...(lead.sourceWorksheet ? [{ label: "Worksheet", value: lead.sourceWorksheet }] : []),
                ...(lead.sourceRow ? [{ label: "Source row", value: String(lead.sourceRow) }] : []),
                ...(lead.sourceImportId
                  ? [
                      {
                        label: "Import",
                        value: (
                          <Link href={`/admin/automation/imports/${lead.sourceImportId}`} className="text-cyan-700 hover:underline">
                            Open the import
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(lead.pageUrl ? [{ label: "Submitted from", value: <span className="break-all font-mono text-xs">{lead.pageUrl}</span> }] : []),
                ...(lead.utmSource ? [{ label: "UTM source", value: lead.utmSource }] : []),
                ...(lead.utmMedium ? [{ label: "UTM medium", value: lead.utmMedium }] : []),
                ...(lead.utmCampaign
                  ? [
                      {
                        label: "UTM campaign",
                        value: (
                          <Link href={`/admin/leads?campaign=${encodeURIComponent(lead.utmCampaign)}`} className="text-cyan-700 hover:underline">
                            {lead.utmCampaign}
                          </Link>
                        ),
                      },
                    ]
                  : []),
                ...(lead.source === "website" && !hasAttribution ? [{ label: "Tracking", value: <span className="text-slate-500">No page or UTM data was captured.</span> }] : []),
                { label: "Received", value: formatDate(lead.createdAt, { time: true }) },
                { label: "Lead ID", value: <span className="break-all font-mono text-xs text-slate-500">{lead.id}</span> },
              ]}
            />
          </Panel>

          {canWrite && (
            <Panel title="Danger zone">
              <form action={deleteLead}>
                <input type="hidden" name="id" value={lead.id} />
                <input type="hidden" name="redirectTo" value="/admin/leads" />
                <ConfirmButton message="Delete this lead permanently, with its notes, emails and history?" className="w-full">
                  Delete lead
                </ConfirmButton>
              </form>
            </Panel>
          )}
        </aside>
      </div>
    </>
  );
}
