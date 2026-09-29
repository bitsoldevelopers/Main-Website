"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Download, Globe, Loader2, Mail, Phone, UserRound, X } from "lucide-react";
import { bulkLeadAction } from "@/app/admin/actions-leads";
import { initials, timeAgo, truncate } from "@/lib/admin/format";
import {
  LEAD_KIND_LABELS,
  LEAD_PRIORITY_META,
  LEAD_STATUSES,
  LEAD_STATUS_META,
  isLeadPriority,
  leadKind,
  leadSourceLabel,
  leadTopic,
  normalizeStatus,
} from "@/lib/admin/leads";
import type { BulkAction } from "@/lib/automation/bulk";
import { relativeTime, runBadge } from "@/lib/automation/labels";
import type { LeadListRow } from "@/lib/automation/lead-queries";
import { cn } from "@/lib/utils";
import { Pill, btn, inputClass, selectClass, tdClass, thClass } from "@/components/admin/ui";

interface Options {
  automations: { id: string; name: string; status: string }[];
  assignees: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}

const ACTIONS: { value: BulkAction | "EXPORT"; label: string; group: string; outreach?: boolean; destructive?: boolean }[] = [
  { value: "START_AUTOMATION", label: "Start automation", group: "Automation", outreach: true },
  { value: "PAUSE_AUTOMATION", label: "Pause automation", group: "Automation", outreach: true },
  { value: "RESUME_AUTOMATION", label: "Resume automation", group: "Automation", outreach: true },
  { value: "STOP_AUTOMATION", label: "Stop automation", group: "Automation", outreach: true, destructive: true },
  { value: "ASSIGN", label: "Assign", group: "Lead" },
  { value: "STATUS", label: "Change status", group: "Lead" },
  { value: "ADD_TAG", label: "Add tag", group: "Lead" },
  { value: "REMOVE_TAG", label: "Remove tag", group: "Lead" },
  { value: "EXPORT", label: "Export", group: "Lead" },
  { value: "DELETE", label: "Delete", group: "Lead", destructive: true },
];

/**
 * The lead list with selection and bulk actions. The rows come from the
 * server; this component only adds the checkboxes and the action bar, and
 * asks the server to refresh the rows after an action.
 */
export function LeadsTable({
  rows,
  options,
  canWrite,
  canOutreach,
  now,
}: {
  rows: LeadListRow[];
  options: Options;
  canWrite: boolean;
  canOutreach: boolean;
  /** When the rows were rendered on the server, for "in 2 d" labels. */
  now: number;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<BulkAction | "EXPORT" | "">("");
  const [value, setValue] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // A new page of rows arrived: selections of rows that are gone are dropped.
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const [seenIds, setSeenIds] = useState(ids);
  if (seenIds !== ids) {
    setSeenIds(ids);
    setSelected((current) => new Set([...current].filter((id) => ids.includes(id))));
  }

  const count = selected.size;
  const allSelected = rows.length > 0 && count === rows.length;
  const activeAutomations = options.automations.filter((a) => a.status === "ACTIVE");
  const available = ACTIONS.filter((a) => (a.outreach ? canOutreach : a.value === "EXPORT" || canWrite));
  const chosen = ACTIONS.find((a) => a.value === action);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setResult(null);
  }

  function choose(next: string) {
    setAction(next as BulkAction | "EXPORT" | "");
    setConfirming(false);
    setResult(null);
    setValue(next === "START_AUTOMATION" ? (activeAutomations[0]?.id ?? "") : "");
  }

  const needsValue = action === "START_AUTOMATION" || action === "STATUS" || action === "ADD_TAG" || action === "REMOVE_TAG";
  const ready = Boolean(action) && count > 0 && (!needsValue || Boolean(value.trim()));

  function apply() {
    if (!action || action === "EXPORT" || !ready) return;
    if (chosen?.destructive && !confirming) {
      setConfirming(true);
      return;
    }
    const payload = { ids: [...selected], action, value: action === "DELETE" ? "DELETE" : value };
    startTransition(async () => {
      const outcome = await bulkLeadAction(payload);
      setResult(outcome);
      setConfirming(false);
      if (outcome.ok) {
        setSelected(new Set());
        setAction("");
        router.refresh();
      }
    });
  }

  return (
    <>
      {(canWrite || canOutreach) && count > 0 && (
        <div className="sticky top-16 z-20 border-b border-cyan-200 bg-cyan-50 px-5 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <p className="flex shrink-0 items-center gap-2 text-sm font-bold text-cyan-900">
              {count} selected
              <button type="button" onClick={() => setSelected(new Set())} className="grid h-5 w-5 place-items-center rounded text-cyan-800 hover:bg-cyan-100" aria-label="Clear selection">
                <X className="h-3.5 w-3.5" />
              </button>
            </p>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <select value={action} onChange={(e) => choose(e.target.value)} className={cn(selectClass, "w-52 py-2")} aria-label="Bulk action">
                <option value="">Choose an action…</option>
                {["Automation", "Lead"].map((group) => {
                  const items = available.filter((a) => a.group === group);
                  return items.length ? (
                    <optgroup key={group} label={group}>
                      {items.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </select>

              {action === "START_AUTOMATION" && (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={cn(selectClass, "w-64 py-2")} aria-label="Automation">
                  {activeAutomations.length === 0 && <option value="">No automation is active</option>}
                  {activeAutomations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              )}
              {action === "ASSIGN" && (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={cn(selectClass, "w-56 py-2")} aria-label="Assign to">
                  <option value="">Nobody (unassign)</option>
                  {options.assignees.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              )}
              {action === "STATUS" && (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={cn(selectClass, "w-56 py-2")} aria-label="New status">
                  <option value="">Choose a status…</option>
                  {LEAD_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {LEAD_STATUS_META[status].label}
                    </option>
                  ))}
                </select>
              )}
              {action === "ADD_TAG" && (
                <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tag, or several separated by commas" className={cn(inputClass, "w-72 bg-white py-2")} aria-label="Tag to add" list="bulk-tags" />
              )}
              {action === "ADD_TAG" && (
                <datalist id="bulk-tags">
                  {options.tags.map((tag) => (
                    <option key={tag.id} value={tag.name} />
                  ))}
                </datalist>
              )}
              {action === "REMOVE_TAG" && (
                <select value={value} onChange={(e) => setValue(e.target.value)} className={cn(selectClass, "w-56 py-2")} aria-label="Tag to remove">
                  <option value="">Choose a tag…</option>
                  {options.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              )}

              {action === "EXPORT" ? (
                <a href={`/api/admin/leads/export?ids=${[...selected].join(",")}`} className={btn.primary}>
                  <Download className="h-4 w-4" /> Download CSV
                </a>
              ) : confirming ? (
                <span className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span className="text-slate-800">
                    {action === "DELETE"
                      ? `Delete ${count} lead${count === 1 ? "" : "s"} for good, with their notes, emails and history?`
                      : `Stop the automation for ${count} lead${count === 1 ? "" : "s"}? They will receive no more emails from it.`}
                  </span>
                  <button type="button" onClick={apply} disabled={pending} className={btn.danger}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {action === "DELETE" ? "Yes, delete" : "Yes, stop"}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} className={btn.ghost}>
                    Cancel
                  </button>
                </span>
              ) : (
                action && (
                  <button type="button" onClick={apply} disabled={!ready || pending} className={chosen?.destructive ? btn.danger : btn.primary}>
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Apply to {count}
                  </button>
                )
              )}
            </div>
          </div>
          {action === "START_AUTOMATION" && activeAutomations.length === 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Activate an automation first.{" "}
              <Link href="/admin/automation/automations" className="font-semibold underline">
                Automations
              </Link>
            </p>
          )}
        </div>
      )}

      {result && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 border-b px-5 py-3 text-sm",
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          )}
        >
          {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          {result.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px]">
          <thead>
            <tr>
              {(canWrite || canOutreach) && (
                <th className={cn(thClass, "w-10 pr-0")}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = count > 0 && !allSelected;
                    }}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(ids))}
                    aria-label="Select every lead on this page"
                  />
                </th>
              )}
              <th className={thClass}>Who</th>
              <th className={thClass}>Company</th>
              <th className={thClass}>Reach</th>
              <th className={thClass}>Status</th>
              <th className={thClass}>Automation</th>
              <th className={thClass}>Owner</th>
              <th className={thClass}>Added</th>
              <th className={cn(thClass, "text-right")}>
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((lead) => {
              const status = normalizeStatus(lead.status);
              const kind = leadKind(lead.subject);
              const run = lead.runs[0];
              const runState = run ? runBadge(run.status) : null;
              const location = lead.contactLocation || [lead.city, lead.country].filter(Boolean).join(", ");
              const email = lead.outreachEmail || lead.email;
              const hasPhone = Boolean(lead.phone) || lead._count.phones > 0;
              const checked = selected.has(lead.id);
              return (
                <tr key={lead.id} className={cn("border-t border-slate-100 transition-colors", checked ? "bg-cyan-50/60" : "hover:bg-slate-50")}>
                  {(canWrite || canOutreach) && (
                    <td className={cn(tdClass, "pr-0")}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(lead.id)} aria-label={`Select ${lead.name}`} />
                    </td>
                  )}
                  <td className={tdClass}>
                    <Link href={`/admin/leads/${lead.id}`} className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">{initials(lead.name)}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900 hover:text-cyan-700">{lead.name}</span>
                        <span className="block truncate text-xs text-slate-500">{lead.jobTitle || (kind === "prospect" ? "" : leadTopic(lead.subject))}</span>
                      </span>
                    </Link>
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      <Pill tone={kind === "application" ? "purple" : kind === "prospect" ? "cyan" : "slate"}>{LEAD_KIND_LABELS[kind]}</Pill>
                      {lead.tags.map(({ tag }) => (
                        <span key={tag.id} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {tag.name}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className={cn(tdClass, "max-w-[220px]")}>
                    <span className="block truncate text-slate-900">{lead.company || <span className="text-slate-400">—</span>}</span>
                    {location && <span className="block truncate text-xs text-slate-500">{location}</span>}
                    {kind !== "prospect" && lead.message && <span className="mt-1 block text-xs text-slate-500">{truncate(lead.message, 70)}</span>}
                  </td>
                  <td className={tdClass}>
                    <span className="block max-w-[220px] truncate text-xs text-slate-700" title={email || undefined}>
                      {email || <span className="text-slate-400">No email</span>}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5 text-slate-300">
                      <Mail className={cn("h-3.5 w-3.5", email && "text-emerald-600")} aria-label={email ? "Has an email" : "No email"} />
                      <Phone className={cn("h-3.5 w-3.5", hasPhone && "text-emerald-600")} aria-label={hasPhone ? "Has a phone number" : "No phone number"} />
                      <UserRound className={cn("h-3.5 w-3.5", lead.linkedinUrl && "text-emerald-600")} aria-label={lead.linkedinUrl ? "Has a LinkedIn profile" : "No LinkedIn profile"} />
                      <Globe className={cn("h-3.5 w-3.5", lead.website && "text-emerald-600")} aria-label={lead.website ? "Has a website" : "No website"} />
                    </span>
                  </td>
                  <td className={tdClass}>
                    <Pill tone={LEAD_STATUS_META[status].tone}>{LEAD_STATUS_META[status].label}</Pill>
                    {isLeadPriority(lead.priority) && lead.priority !== "NORMAL" && (
                      <Pill tone={LEAD_PRIORITY_META[lead.priority].tone} className="mt-1">
                        {LEAD_PRIORITY_META[lead.priority].label}
                      </Pill>
                    )}
                  </td>
                  <td className={tdClass}>
                    {run && runState ? (
                      <>
                        <Pill tone={runState.tone}>{runState.label}</Pill>
                        <span className="mt-1 block max-w-[180px] truncate text-xs text-slate-500">
                          {run.automation.name} · {run.emailsSent} sent
                        </span>
                        {run.status === "ACTIVE" && lead.nextFollowUpAt && <span className="block text-xs text-slate-500">Next {relativeTime(lead.nextFollowUpAt, now)}</span>}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Not started</span>
                    )}
                  </td>
                  <td className={cn(tdClass, "text-xs text-slate-600")}>{lead.assignedTo ? lead.assignedTo.name || lead.assignedTo.email : <span className="text-slate-400">Unassigned</span>}</td>
                  <td className={cn(tdClass, "whitespace-nowrap text-slate-500")}>
                    {timeAgo(lead.createdAt)}
                    <span className="block text-xs">{leadSourceLabel(lead.source)}</span>
                    {lead.lastContactedAt && <span className="block text-xs">Contacted {timeAgo(lead.lastContactedAt)}</span>}
                  </td>
                  <td className={cn(tdClass, "text-right")}>
                    <Link href={`/admin/leads/${lead.id}`} className={btn.ghost}>
                      Open <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
