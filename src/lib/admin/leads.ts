/**
 * The Lead table receives three kinds of rows:
 *  - contact-form inquiries (subject = the service code chosen in the form)
 *  - job applications (subject = "Job Application: <role title>")
 *  - outreach prospects imported from a source such as Google Sheets
 *    (subject = PROSPECT_SUBJECT)
 * Status is a free string column; these are the values the admin uses, in
 * the order a lead usually moves through them.
 */

export const LEAD_STATUSES = [
  "NEW",
  "IMPORTED",
  "READY_FOR_OUTREACH",
  "EMAIL_QUEUED",
  "EMAIL_SENT",
  "FOLLOW_UP",
  "REPLIED",
  "CONTACTED",
  "QUALIFIED",
  "MEETING_SCHEDULED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "NOT_INTERESTED",
  "UNSUBSCRIBED",
  "BOUNCED",
  "PAUSED",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type PillTone = "cyan" | "purple" | "green" | "amber" | "red" | "slate";

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; tone: PillTone; hint: string }> = {
  NEW: { label: "New", tone: "cyan", hint: "Just arrived, nobody has replied yet." },
  IMPORTED: { label: "Imported", tone: "slate", hint: "Came in from an import; no usable outreach email yet." },
  READY_FOR_OUTREACH: { label: "Ready for outreach", tone: "cyan", hint: "Has an outreach email and is not in an automation." },
  EMAIL_QUEUED: { label: "Email queued", tone: "purple", hint: "In an automation; the first email is waiting to go." },
  EMAIL_SENT: { label: "Email sent", tone: "purple", hint: "First email sent, no reply yet." },
  FOLLOW_UP: { label: "Follow-up", tone: "slate", hint: "Being followed up; chase on the follow-up date." },
  REPLIED: { label: "Replied", tone: "green", hint: "They answered. Automation stopped; a person takes over." },
  CONTACTED: { label: "Contacted", tone: "purple", hint: "First reply sent, waiting on them." },
  QUALIFIED: { label: "Qualified", tone: "amber", hint: "Real budget and need." },
  MEETING_SCHEDULED: { label: "Meeting scheduled", tone: "amber", hint: "A call or meeting is booked." },
  PROPOSAL: { label: "Proposal sent", tone: "amber", hint: "Proposal or quote sent." },
  NEGOTIATION: { label: "Negotiation", tone: "purple", hint: "Terms and price being discussed." },
  WON: { label: "Won", tone: "green", hint: "Signed. Hand over to delivery." },
  LOST: { label: "Lost", tone: "red", hint: "Closed without a deal." },
  NOT_INTERESTED: { label: "Not interested", tone: "red", hint: "Said no. Never emailed automatically again." },
  UNSUBSCRIBED: { label: "Unsubscribed", tone: "red", hint: "Opted out of email. On the suppression list." },
  BOUNCED: { label: "Bounced", tone: "red", hint: "The outreach address rejected our email." },
  PAUSED: { label: "Paused", tone: "slate", hint: "Automation paused by hand." },
};

/**
 * Columns of the pipeline board: the stages a person works. Outreach stages
 * (imported, queued, sent…) are machine-driven and would bury the board under
 * a thousand imported prospects, so they are listed, not dragged.
 */
export const BOARD_STATUSES = [
  "NEW",
  "REPLIED",
  "CONTACTED",
  "QUALIFIED",
  "MEETING_SCHEDULED",
  "PROPOSAL",
  "NEGOTIATION",
  "FOLLOW_UP",
  "WON",
  "LOST",
] as const satisfies readonly LeadStatus[];

export function isBoardStatus(value: string): boolean {
  return (BOARD_STATUSES as readonly string[]).includes(value);
}

/**
 * A lead in any of these is never sent another automated email. The first
 * seven are the rule; the rest mean a person is already talking to the lead,
 * and a cold follow-up on top of that conversation would only hurt.
 */
export const AUTOMATION_STOP_STATUSES: readonly LeadStatus[] = [
  "REPLIED",
  "WON",
  "LOST",
  "NOT_INTERESTED",
  "UNSUBSCRIBED",
  "BOUNCED",
  "PAUSED",
  "CONTACTED",
  "QUALIFIED",
  "MEETING_SCHEDULED",
  "PROPOSAL",
  "NEGOTIATION",
];

export function stopsAutomation(status: string): boolean {
  return (AUTOMATION_STOP_STATUSES as readonly string[]).includes(status);
}

export const LEAD_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const LEAD_PRIORITY_META: Record<LeadPriority, { label: string; tone: PillTone }> = {
  LOW: { label: "Low", tone: "slate" },
  NORMAL: { label: "Normal", tone: "cyan" },
  HIGH: { label: "High", tone: "amber" },
  URGENT: { label: "Urgent", tone: "red" },
};

export function isLeadPriority(value: string): value is LeadPriority {
  return (LEAD_PRIORITIES as readonly string[]).includes(value);
}

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}

export function normalizeStatus(value: string): LeadStatus {
  return isLeadStatus(value) ? value : "NEW";
}

/** Service codes sent by ContactForm.tsx, mapped to the labels shown on the site. */
export const SERVICE_LABELS: Record<string, string> = {
  ai: "AI Automation",
  marketing: "Digital Marketing",
  web: "Web Development",
  mobile: "Mobile Apps",
  seo: "SEO Optimization",
  trading: "Trading Tech",
};

export const APPLICATION_PREFIX = "Job Application:";

/** Subject given to leads created by an import, the way applications have theirs. */
export const PROSPECT_SUBJECT = "Outreach prospect";

export type LeadKind = "inquiry" | "application" | "prospect";

export const LEAD_KIND_LABELS: Record<LeadKind, string> = {
  inquiry: "Inquiry",
  application: "Job application",
  prospect: "Prospect",
};

export function leadKind(subject: string): LeadKind {
  if (subject === PROSPECT_SUBJECT) return "prospect";
  return subject.startsWith(APPLICATION_PREFIX) ? "application" : "inquiry";
}

/** Human label for the subject column. */
export function leadTopic(subject: string): string {
  if (subject.startsWith(APPLICATION_PREFIX)) return subject.slice(APPLICATION_PREFIX.length).trim();
  return SERVICE_LABELS[subject] ?? subject;
}

/** `Lead.source` values and what the admin calls them. */
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website: "Website form",
  manual: "Manual entry",
  google_sheets: "Google Sheets",
  csv: "CSV upload",
  meta_lead_ads: "Meta Lead Ads",
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  api: "API",
  landing_page: "Landing page",
};

export function leadSourceLabel(source: string): string {
  return LEAD_SOURCE_LABELS[source] ?? source;
}

/** Job applications store the portfolio link in the message body. */
export function extractPortfolioUrl(message: string): string | null {
  const match = message.match(/Portfolio\/LinkedIn:\s*(\S+)/i);
  return match ? match[1] : null;
}
