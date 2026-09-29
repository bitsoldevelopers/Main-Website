/**
 * Entry conditions decide who may be enrolled in an automation; stop
 * conditions decide what ends a run. Pure, so the same code drives the
 * engine, the tests and the labels in the admin.
 */

export const CONDITION_FIELDS = {
  status: "Lead status",
  source: "Lead source",
  tag: "Tag",
  title: "Job title",
  company: "Company",
  location: "Location",
  website: "Website",
  linkedin: "LinkedIn",
  phone: "Phone",
} as const;
export type ConditionField = keyof typeof CONDITION_FIELDS;

export const CONDITION_OPERATORS = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "does not contain",
  is_set: "is filled in",
  is_empty: "is empty",
} as const;
export type ConditionOperator = keyof typeof CONDITION_OPERATORS;

export function isConditionField(value: string): value is ConditionField {
  return value in CONDITION_FIELDS;
}

export function isConditionOperator(value: string): value is ConditionOperator {
  return value in CONDITION_OPERATORS;
}

export function operatorNeedsValue(operator: string): boolean {
  return operator !== "is_set" && operator !== "is_empty";
}

export interface ConditionSubject {
  status: string;
  source: string;
  jobTitle?: string | null;
  company?: string | null;
  contactLocation?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  phone?: string | null;
  tags: string[];
}

function fieldValues(field: ConditionField, lead: ConditionSubject): string[] {
  switch (field) {
    case "status":
      return [lead.status];
    case "source":
      return [lead.source];
    case "tag":
      return lead.tags;
    case "title":
      return [lead.jobTitle ?? ""];
    case "company":
      return [lead.company ?? ""];
    case "location":
      return [lead.contactLocation ?? ""];
    case "website":
      return [lead.website ?? ""];
    case "linkedin":
      return [lead.linkedinUrl ?? ""];
    case "phone":
      return [lead.phone ?? ""];
  }
}

export interface ConditionRule {
  field: string;
  operator: string;
  value?: string | null;
}

/** Unknown fields or operators never match, so a broken rule blocks rather than lets everyone in. */
export function evaluateCondition(rule: ConditionRule, lead: ConditionSubject): boolean {
  if (!isConditionField(rule.field) || !isConditionOperator(rule.operator)) return false;
  const values = fieldValues(rule.field, lead)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  const target = (rule.value ?? "").trim().toLowerCase();

  switch (rule.operator) {
    case "is_set":
      return values.length > 0;
    case "is_empty":
      return values.length === 0;
    case "equals":
      return target !== "" && values.some((v) => v === target);
    case "not_equals":
      return !values.some((v) => v === target);
    case "contains":
      return target !== "" && values.some((v) => v.includes(target));
    case "not_contains":
      return !values.some((v) => v.includes(target));
  }
}

export function describeCondition(rule: ConditionRule): string {
  const field = isConditionField(rule.field) ? CONDITION_FIELDS[rule.field] : rule.field;
  const operator = isConditionOperator(rule.operator) ? CONDITION_OPERATORS[rule.operator] : rule.operator;
  return operatorNeedsValue(rule.operator) ? `${field} ${operator} "${rule.value ?? ""}"` : `${field} ${operator}`;
}

/** The first entry condition a lead fails, or null when it passes them all. */
export function firstFailedCondition(rules: ConditionRule[], lead: ConditionSubject): ConditionRule | null {
  return rules.find((rule) => !evaluateCondition(rule, lead)) ?? null;
}

// ─── Stop conditions ────────────────────────────────────────────────────────

export const STOP_REASONS = {
  REPLIED: "The lead replied",
  WON: "The lead was won",
  LOST: "The lead was lost",
  NOT_INTERESTED: "The lead is not interested",
  UNSUBSCRIBED: "The lead unsubscribed",
  BOUNCED: "The email bounced",
  HUMAN_TOOK_OVER: "A person is already working this lead",
  NO_ELIGIBLE_EMAIL: "No address left that may be emailed",
  MANUAL_STOP: "Stopped by hand",
  SEND_FAILED: "The email could not be sent",
  AUTOMATION_REMOVED: "The automation was removed or has no steps",
} as const;
export type StopReason = keyof typeof STOP_REASONS;

export function stopReasonLabel(reason: string | null | undefined): string {
  return reason && reason in STOP_REASONS ? STOP_REASONS[reason as StopReason] : (reason ?? "");
}

/** The stop conditions every automation has. They cannot be switched off. */
export const MANDATORY_STOP_CONDITIONS: { field: string; operator: string; value: string; label: string }[] = [
  { field: "event", operator: "equals", value: "REPLIED", label: "Lead replies" },
  { field: "status", operator: "equals", value: "WON", label: "Lead becomes Won" },
  { field: "status", operator: "equals", value: "LOST", label: "Lead becomes Lost" },
  { field: "status", operator: "equals", value: "NOT_INTERESTED", label: "Lead becomes Not Interested" },
  { field: "event", operator: "equals", value: "UNSUBSCRIBED", label: "Lead unsubscribes" },
  { field: "event", operator: "equals", value: "BOUNCED", label: "Email bounces" },
  { field: "event", operator: "equals", value: "PAUSED", label: "Lead is manually paused" },
];

/** Which stop reason a lead status implies, if any. PAUSED pauses instead. */
export function stopReasonForStatus(status: string): StopReason | null {
  switch (status) {
    case "REPLIED":
    case "WON":
    case "LOST":
    case "NOT_INTERESTED":
    case "UNSUBSCRIBED":
    case "BOUNCED":
      return status;
    case "CONTACTED":
    case "QUALIFIED":
    case "MEETING_SCHEDULED":
    case "PROPOSAL":
    case "NEGOTIATION":
      return "HUMAN_TOOK_OVER";
    default:
      return null;
  }
}
