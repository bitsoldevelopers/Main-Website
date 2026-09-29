import type { LeadEmail } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone } from "./normalize";
import { getBestOutreachEmail, type OutreachCandidate, type OutreachSelection } from "./outreach-email";
import { loadSuppression } from "./suppression";
import { recordActivity } from "./timeline";
import { checkEmailSyntax } from "./validate";

/**
 * A lead's contact points. Imported leads have LeadEmail / LeadPhone rows;
 * leads created by the website forms before this module existed only have
 * `Lead.email` and `Lead.phone`, so every reader goes through these helpers
 * and sees the same shape either way.
 */

type EmailRow = Pick<LeadEmail, "email" | "emailKey" | "type" | "validity" | "bouncedAt" | "isOutreach">;

export function candidateEmails(lead: { email: string; emails: EmailRow[] }): OutreachCandidate[] {
  if (lead.emails.length > 0) return lead.emails;
  const emailKey = normalizeEmail(lead.email);
  if (!emailKey) return [];
  return [{ email: lead.email, emailKey, type: "PRIMARY", validity: checkEmailSyntax(emailKey).validity, bouncedAt: null, isOutreach: false }];
}

/** Creates the contact rows for a lead that predates them. Safe to repeat. */
export async function materializeContacts(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, phone: true, _count: { select: { emails: true, phones: true } } },
  });
  if (!lead) return;

  const emailKey = normalizeEmail(lead.email);
  if (lead._count.emails === 0 && emailKey) {
    const check = checkEmailSyntax(emailKey);
    await prisma.leadEmail.createMany({
      data: [
        {
          leadId,
          email: lead.email.trim(),
          emailKey: emailKey.slice(0, 191),
          type: "PRIMARY",
          validity: check.validity,
          validityReason: check.reason,
          isPrimary: true,
        },
      ],
      skipDuplicates: true,
    });
  }
  const phoneKey = normalizePhone(lead.phone);
  if (lead._count.phones === 0 && lead.phone && phoneKey) {
    await prisma.leadPhone.createMany({
      data: [{ leadId, phone: lead.phone.trim(), phoneKey, type: "PRIMARY", isPrimary: true }],
      skipDuplicates: true,
    });
  }
}

/**
 * Recomputes which address automations send to and stores the answer on the
 * lead. Writes a timeline entry only when the answer changed.
 */
export async function refreshOutreachEmail(
  leadId: string,
  options: { actor?: string; silent?: boolean } = {}
): Promise<OutreachSelection> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { email: true, outreachEmail: true, outreachEmailReason: true, outreachLocked: true, emails: true },
  });
  if (!lead) return { selected_email: null, selection_reason: "NO_EMAIL", type: null, risky: false, skipped: [] };

  const candidates = candidateEmails(lead);
  const suppression = await loadSuppression(candidates.map((c) => c.emailKey));
  const selection = getBestOutreachEmail({ emails: candidates }, { suppression, locked: lead.outreachLocked });

  const changed = (lead.outreachEmail ?? null) !== selection.selected_email || lead.outreachEmailReason !== selection.selection_reason;
  if (!changed) return selection;

  const selectedKey = selection.selected_email ? normalizeEmail(selection.selected_email) : null;
  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        outreachEmail: selection.selected_email?.slice(0, 191) ?? null,
        outreachEmailReason: selection.selection_reason,
        // A manual choice that stopped being eligible no longer binds.
        ...(lead.outreachLocked && selection.selection_reason !== "MANUAL_SELECTION" ? { outreachLocked: false } : {}),
      },
    }),
    prisma.leadEmail.updateMany({ where: { leadId, isOutreach: true, NOT: { emailKey: selectedKey ?? "" } }, data: { isOutreach: false } }),
    ...(selectedKey ? [prisma.leadEmail.updateMany({ where: { leadId, emailKey: selectedKey }, data: { isOutreach: true } })] : []),
  ]);

  if (!options.silent && (lead.outreachEmail ?? null) !== selection.selected_email) {
    await recordActivity({
      leadId,
      type: "OUTREACH_EMAIL_SELECTED",
      title: selection.selected_email ? `Outreach email selected: ${selection.selected_email}` : "No usable outreach email",
      detail: [
        `Reason: ${selection.selection_reason}`,
        ...selection.skipped.map((s) => `Skipped ${s.email} (${s.reason.toLowerCase()})`),
      ].join("\n"),
      actor: options.actor,
    });
  }
  return selection;
}
