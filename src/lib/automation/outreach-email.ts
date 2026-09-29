/**
 * The email selection engine: which of a lead's addresses automations send
 * to. One address per lead, never several at once.
 *
 * Order of preference is Email 1, then Email 2, then Personal Email. An
 * address is skipped when it is invalid, has bounced, has unsubscribed or is
 * on the suppression list. Addresses that are merely risky (a shared info@
 * mailbox, say) are used only when no clean address exists.
 */

export const EMAIL_TYPES = ["PRIMARY", "SECONDARY", "PERSONAL"] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  PRIMARY: "Email 1",
  SECONDARY: "Email 2",
  PERSONAL: "Personal Email",
};

export function isEmailType(value: string): value is EmailType {
  return (EMAIL_TYPES as readonly string[]).includes(value);
}

export interface OutreachCandidate {
  email: string;
  emailKey: string;
  type: string;
  validity: string;
  bouncedAt?: Date | string | null;
  /** Set when an admin chose this address by hand. */
  isOutreach?: boolean;
}

export type SuppressionReason = "UNSUBSCRIBED" | "BOUNCED" | "COMPLAINED" | "MANUAL";

export type SkipReason = "INVALID" | "BOUNCED" | "UNSUBSCRIBED" | "SUPPRESSED";

export type SelectionReason =
  | "PRIMARY_EMAIL"
  | "SECONDARY_EMAIL"
  | "PERSONAL_EMAIL"
  | "MANUAL_SELECTION"
  | "NO_EMAIL"
  | "NO_ELIGIBLE_EMAIL";

export interface OutreachSelection {
  selected_email: string | null;
  selection_reason: SelectionReason;
  /** Which of the three addresses was picked. */
  type: EmailType | null;
  /** True when the pick is a risky address used for lack of a clean one. */
  risky: boolean;
  skipped: { email: string; type: string; reason: SkipReason }[];
}

export interface SelectionContext {
  /** Why an address must not be emailed, or null when it may be. */
  suppression?: (emailKey: string) => SuppressionReason | null;
  /** Honour an admin's manual choice while it stays eligible. */
  locked?: boolean;
}

const REASON_BY_TYPE: Record<EmailType, SelectionReason> = {
  PRIMARY: "PRIMARY_EMAIL",
  SECONDARY: "SECONDARY_EMAIL",
  PERSONAL: "PERSONAL_EMAIL",
};

function skipReason(candidate: OutreachCandidate, ctx: SelectionContext): SkipReason | null {
  if (candidate.validity === "INVALID") return "INVALID";
  if (candidate.bouncedAt) return "BOUNCED";
  const suppressed = ctx.suppression?.(candidate.emailKey) ?? null;
  if (suppressed === "UNSUBSCRIBED" || suppressed === "COMPLAINED") return "UNSUBSCRIBED";
  if (suppressed === "BOUNCED") return "BOUNCED";
  if (suppressed) return "SUPPRESSED";
  return null;
}

export function getBestOutreachEmail(lead: { emails: OutreachCandidate[] }, ctx: SelectionContext = {}): OutreachSelection {
  const ordered = EMAIL_TYPES.flatMap((type) => lead.emails.filter((e) => e.type === type && e.email));
  if (ordered.length === 0) {
    return { selected_email: null, selection_reason: "NO_EMAIL", type: null, risky: false, skipped: [] };
  }

  const skipped: OutreachSelection["skipped"] = [];
  const eligible: OutreachCandidate[] = [];
  for (const candidate of ordered) {
    const reason = skipReason(candidate, ctx);
    if (reason) skipped.push({ email: candidate.email, type: candidate.type, reason });
    else eligible.push(candidate);
  }

  if (ctx.locked) {
    const manual = eligible.find((candidate) => candidate.isOutreach);
    if (manual) {
      return {
        selected_email: manual.email,
        selection_reason: "MANUAL_SELECTION",
        type: manual.type as EmailType,
        risky: manual.validity === "RISKY",
        skipped,
      };
    }
  }

  const pick = eligible.find((candidate) => candidate.validity !== "RISKY") ?? eligible[0];
  if (!pick) {
    return { selected_email: null, selection_reason: "NO_ELIGIBLE_EMAIL", type: null, risky: false, skipped };
  }
  const type = pick.type as EmailType;
  return {
    selected_email: pick.email,
    selection_reason: REASON_BY_TYPE[type],
    type,
    risky: pick.validity === "RISKY",
    skipped,
  };
}

export const SELECTION_REASON_LABELS: Record<SelectionReason, string> = {
  PRIMARY_EMAIL: "Email 1 is the first choice",
  SECONDARY_EMAIL: "Email 1 could not be used, so Email 2",
  PERSONAL_EMAIL: "No work address could be used, so the personal email",
  MANUAL_SELECTION: "Chosen by hand",
  NO_EMAIL: "This lead has no email address",
  NO_ELIGIBLE_EMAIL: "Every address is invalid, bounced or suppressed",
};
