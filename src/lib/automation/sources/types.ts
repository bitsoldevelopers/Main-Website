/**
 * What every lead source hands to the import pipeline: a header row and the
 * rows under it. Google Sheets and CSV produce this today; Meta Lead Ads,
 * WhatsApp, an API endpoint or a landing-page form only need to produce the
 * same shape to get validation, de-duplication, assignment, tagging and
 * automation for free.
 */
export interface SourceTable {
  headers: string[];
  rows: string[][];
  /** Row number, in the source, of rows[0] (2 when row 1 is the header). */
  firstRowNumber: number;
}

export const SOURCE_TYPES = {
  google_sheets: { label: "Google Sheets", available: true, description: "Link a worksheet and keep it in sync." },
  csv: { label: "CSV upload", available: true, description: "Upload an exported sheet or any CSV with the same columns." },
  website: { label: "Website forms", available: true, description: "Contact form, pop-up, article CTAs and the careers page." },
  manual: { label: "Manual entry", available: true, description: "Leads added by hand in the admin." },
  meta_lead_ads: { label: "Meta Lead Ads", available: false, description: "Planned. Not connected." },
  whatsapp: { label: "WhatsApp", available: false, description: "Planned. Not connected." },
  linkedin: { label: "LinkedIn", available: false, description: "Planned. Not connected." },
  api: { label: "API", available: false, description: "Planned. Not connected." },
  landing_page: { label: "Landing pages", available: false, description: "Planned. Not connected." },
} as const;
export type SourceType = keyof typeof SOURCE_TYPES;

export const DUPLICATE_MODES = {
  UPDATE: "Update existing lead",
  SKIP: "Skip duplicate",
  REVIEW: "Ask for review",
} as const;
export type DuplicateMode = keyof typeof DUPLICATE_MODES;

export const ASSIGNMENT_MODES = {
  UNASSIGNED: "Unassigned",
  USER: "Specific team member",
  ROUND_ROBIN: "Round robin",
  TEAM: "Team",
} as const;
export type AssignmentMode = keyof typeof ASSIGNMENT_MODES;

/** Teams are the admin roles: there is no separate team table. */
export const ASSIGNMENT_TEAMS = {
  MANAGER: "Business development managers",
  ADMIN: "Admins",
  EDITOR: "Editors",
} as const;
export type AssignmentTeam = keyof typeof ASSIGNMENT_TEAMS;

export const SYNC_INTERVALS = [
  { minutes: 0, label: "Manual only" },
  { minutes: 15, label: "Every 15 minutes" },
  { minutes: 30, label: "Every 30 minutes" },
  { minutes: 60, label: "Every hour" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 1440, label: "Daily" },
] as const;

export function isSyncInterval(minutes: number): boolean {
  return SYNC_INTERVALS.some((interval) => interval.minutes === minutes);
}

export const SUGGESTED_TAGS = ["Google Sheets", "Cold Lead", "SEO", "Digital Marketing", "USA", "UK", "UAE"];

export interface ImportSettings {
  mapping: Partial<Record<string, string>>;
  duplicateMode: DuplicateMode;
  autoStartAutomation: boolean;
  automationId: string | null;
  assignmentMode: AssignmentMode;
  assigneeId: string | null;
  assignmentTeam: AssignmentTeam | null;
  tags: string[];
  /** Look up each email domain's mail server. Slower, catches dead domains. */
  checkDomains: boolean;
}

export const DEFAULT_IMPORT_SETTINGS: ImportSettings = {
  mapping: {},
  duplicateMode: "UPDATE",
  autoStartAutomation: false,
  automationId: null,
  assignmentMode: "UNASSIGNED",
  assigneeId: null,
  assignmentTeam: null,
  tags: [],
  checkDomains: true,
};

export function cleanTags(input: unknown): string[] {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(",") : [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const tag = item.replace(/\s+/g, " ").trim().slice(0, 60);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 20) break;
  }
  return tags;
}

/** Reads settings from a form or a stored snapshot, dropping anything unknown. */
export function parseImportSettings(input: unknown): ImportSettings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : "");
  const duplicateMode = str("duplicateMode");
  const assignmentMode = str("assignmentMode");
  const team = str("assignmentTeam");
  const mapping: Record<string, string> = {};
  if (raw.mapping && typeof raw.mapping === "object") {
    for (const [field, header] of Object.entries(raw.mapping as Record<string, unknown>)) {
      if (typeof header === "string" && header) mapping[field] = header;
    }
  }
  return {
    mapping,
    duplicateMode: duplicateMode in DUPLICATE_MODES ? (duplicateMode as DuplicateMode) : "UPDATE",
    autoStartAutomation: raw.autoStartAutomation === true || raw.autoStartAutomation === "true" || raw.autoStartAutomation === "on",
    automationId: str("automationId") || null,
    assignmentMode: assignmentMode in ASSIGNMENT_MODES ? (assignmentMode as AssignmentMode) : "UNASSIGNED",
    assigneeId: str("assigneeId") || null,
    assignmentTeam: team in ASSIGNMENT_TEAMS ? (team as AssignmentTeam) : null,
    tags: cleanTags(raw.tags),
    checkDomains: raw.checkDomains === undefined ? true : raw.checkDomains === true || raw.checkDomains === "true" || raw.checkDomains === "on",
  };
}
