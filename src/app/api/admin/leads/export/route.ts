import { NextResponse, type NextRequest } from "next/server";
import { actorLabel } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { LEAD_STATUS_META, leadSourceLabel, normalizeStatus } from "@/lib/admin/leads";
import { adminApi } from "@/lib/automation/api";
import { SHEET_COLUMNS } from "@/lib/automation/columns";
import { EXPORT_LIMIT, FILTER_KEYS, leadsForExport, type LeadListFilters } from "@/lib/automation/lead-queries";
import { toCsv } from "@/lib/automation/sources/csv";

/**
 * CSV export of leads: the ones selected in the list (`ids`), or everything
 * the current filters match. The first fifteen columns are the prospect
 * sheet's own, in its order and under its titles, so an export can be opened
 * next to the source sheet or imported again.
 */
export async function GET(req: NextRequest) {
  return adminApi("leads.read", async (session) => {
    const params = req.nextUrl.searchParams;
    const ids = (params.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^[a-z0-9]{10,40}$/i.test(id))
      .slice(0, EXPORT_LIMIT);

    const filters: Omit<LeadListFilters, "page"> = {};
    for (const key of FILTER_KEYS) {
      const value = params.get(key)?.trim();
      if (value) filters[key] = value;
    }

    const leads = await leadsForExport(ids.length > 0 ? { ids } : { filters });
    const email = (lead: (typeof leads)[number], type: string) => lead.emails.find((e) => e.type === type)?.email ?? (type === "PRIMARY" && lead.emails.length === 0 ? lead.email : "");
    const phone = (lead: (typeof leads)[number], type: string) => lead.phones.find((p) => p.type === type)?.phone ?? (type === "PRIMARY" && lead.phones.length === 0 ? (lead.phone ?? "") : "");

    const headers = [
      ...SHEET_COLUMNS.map((column) => column.header),
      "Outreach Email",
      "Lead Status",
      "Lead Source",
      "Source Name",
      "Source Worksheet",
      "Source Row",
      "Tags",
      "Assigned To",
      "Last Contacted",
      "Next Follow-up",
      "Created",
      "Lead ID",
    ];
    const iso = (date: Date | null) => (date ? date.toISOString() : "");
    const rows = leads.map((lead) => [
      lead.firstName ?? (lead.lastName ? "" : lead.name),
      lead.lastName ?? "",
      lead.jobTitle ?? "",
      lead.company ?? "",
      lead.website ?? "",
      lead.linkedinUrl ?? "",
      email(lead, "PRIMARY"),
      email(lead, "SECONDARY"),
      email(lead, "PERSONAL"),
      phone(lead, "PRIMARY"),
      phone(lead, "COMPANY"),
      phone(lead, "SECONDARY"),
      phone(lead, "TERTIARY"),
      lead.contactLocation ?? [lead.city, lead.country].filter(Boolean).join(", "),
      lead.companyDescription ?? "",
      lead.outreachEmail ?? "",
      LEAD_STATUS_META[normalizeStatus(lead.status)].label,
      leadSourceLabel(lead.source),
      lead.sourceName ?? "",
      lead.sourceWorksheet ?? "",
      lead.sourceRow ?? "",
      lead.tags.map((t) => t.tag.name).join("; "),
      lead.assignedTo ? lead.assignedTo.name || lead.assignedTo.email : "",
      iso(lead.lastContactedAt),
      iso(lead.nextFollowUpAt ?? lead.followUpAt),
      iso(lead.createdAt),
      lead.id,
    ]);

    void logActivity({ actor: actorLabel(session), action: "lead.exported", entity: "lead", detail: `${leads.length} leads` });
    const stamp = new Date().toISOString().slice(0, 10);
    // The byte order mark makes Excel read the file as UTF-8.
    return new NextResponse(`﻿${toCsv(headers, rows)}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bitsol-leads-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
