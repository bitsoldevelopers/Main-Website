/**
 * Template rendering for outreach email. Pure: no database, no environment.
 *
 * Syntax, deliberately small:
 *   {{first_name}}            the value, or nothing when the lead has none
 *   {{first_name|there}}      the value, or "there"
 *   {{#title}}…{{/title}}     the block only when the lead has a title
 *   {{^title}}…{{/title}}     the block only when it has none
 *
 * Values come from the CRM only. Nothing is guessed or invented here.
 */

export const TEMPLATE_VARIABLES = [
  { name: "first_name", label: "First name", source: "First Name" },
  { name: "last_name", label: "Last name", source: "Last Name" },
  { name: "title", label: "Job title", source: "Title" },
  { name: "company_name", label: "Company", source: "Company Name" },
  { name: "website", label: "Website", source: "Website" },
  { name: "linkedin_url", label: "LinkedIn URL", source: "Contact LI Profile URL" },
  { name: "contact_location", label: "Location", source: "Contact Location" },
  { name: "company_description", label: "Company description", source: "Company Description" },
  { name: "outreach_email", label: "Outreach email", source: "Selected outreach address" },
  { name: "personalization", label: "Personalised line", source: "Written or approved by a person on the lead profile" },
  { name: "sender_name", label: "Sender name", source: "Outreach settings" },
  { name: "sender_company", label: "Sender company", source: "Outreach settings" },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["name"];
export type TemplateValues = Record<TemplateVariable, string>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.name));

export interface LeadForTemplate {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  contactLocation?: string | null;
  companyDescription?: string | null;
  personalization?: string | null;
}

export function templateValues(
  lead: LeadForTemplate,
  extra: { outreachEmail: string; senderName: string; senderCompany: string }
): TemplateValues {
  const text = (value: string | null | undefined) => (value ?? "").trim();
  // Website inquiries only have `name`; take its first word as the first name.
  const firstName = text(lead.firstName) || (text(lead.lastName) ? "" : text(lead.name).split(/\s+/)[0] ?? "");
  return {
    first_name: firstName,
    last_name: text(lead.lastName),
    title: text(lead.jobTitle),
    company_name: text(lead.company),
    website: text(lead.website),
    linkedin_url: text(lead.linkedinUrl),
    contact_location: text(lead.contactLocation),
    company_description: text(lead.companyDescription),
    outreach_email: text(extra.outreachEmail),
    personalization: text(lead.personalization),
    sender_name: text(extra.senderName),
    sender_company: text(extra.senderCompany),
  };
}

export const SAMPLE_VALUES: TemplateValues = {
  first_name: "John",
  last_name: "Smith",
  title: "Marketing Director",
  company_name: "ABC Technologies",
  website: "https://abctechnologies.com",
  linkedin_url: "https://www.linkedin.com/in/john-smith",
  contact_location: "Dubai, UAE",
  company_description: "ABC Technologies provides enterprise software solutions.",
  outreach_email: "john@abctechnologies.com",
  personalization: "",
  sender_name: "BITSOL Marketing",
  sender_company: "BITSOL Marketing",
};

const SECTION = /\{\{\s*([#^])\s*([a-z_]+)\s*\}\}([\s\S]*?)\{\{\s*\/\s*\2\s*\}\}/g;
const VARIABLE = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g;

export interface RenderResult {
  text: string;
  /** Variables the template names that do not exist. */
  unknown: string[];
  /** Known variables that were empty for this lead and had no fallback. */
  empty: string[];
}

/** Renders one template string (a subject, a body, a CTA label…). */
export function renderTemplate(template: string, values: TemplateValues): RenderResult {
  const unknown = new Set<string>();
  const empty = new Set<string>();
  const lookup = (name: string): string | undefined => (KNOWN.has(name) ? values[name as TemplateVariable] : undefined);

  let out = template.replace(/\r\n?/g, "\n");
  // Sections first, innermost last; a few passes cover nesting.
  for (let pass = 0; pass < 4 && SECTION.test(out); pass++) {
    SECTION.lastIndex = 0;
    out = out.replace(SECTION, (_match, kind: string, name: string, inner: string) => {
      const value = lookup(name);
      if (value === undefined) {
        unknown.add(name);
        return "";
      }
      const show = kind === "#" ? value !== "" : value === "";
      return show ? inner : "";
    });
  }
  SECTION.lastIndex = 0;

  out = out.replace(VARIABLE, (_match, name: string, fallback: string | undefined) => {
    const value = lookup(name);
    if (value === undefined) {
      unknown.add(name);
      return "";
    }
    if (value !== "") return value;
    if (fallback !== undefined) return fallback.trim();
    empty.add(name);
    return "";
  });

  // A removed variable can leave "Hi ," or a doubled space behind.
  out = out
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/ ([,.!?;:])/g, "$1").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text: out, unknown: [...unknown], empty: [...empty] };
}

/** Variable names a template uses, for the editor's checks. */
export function variablesIn(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(/\{\{\s*[#^/]?\s*([a-z_]+)/g)) names.add(match[1]);
  return [...names];
}

// ─── HTML ───────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(value: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g;

function linkify(escapedLine: string): string {
  return escapedLine.replace(URL_IN_TEXT, (url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${escapeHtml(href)}" style="color:#0891b2">${url}</a>` : url;
  });
}

/** Plain text to the simple HTML a personal email has: paragraphs and links. */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px">${paragraph.split("\n").map((line) => linkify(escapeHtml(line))).join("<br>")}</p>`)
    .join("\n");
}

export interface ComposeInput {
  subject: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  values: TemplateValues;
  footer: { companyName: string; companyAddress: string; signature: string; unsubscribeUrl: string };
}

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
  unknown: string[];
  empty: string[];
}

/** The complete email: body, optional call to action, signature and footer. */
export function composeEmail(input: ComposeInput): ComposedEmail {
  const subject = renderTemplate(input.subject, input.values);
  const body = renderTemplate(input.body, input.values);
  const unknown = new Set([...subject.unknown, ...body.unknown]);
  const empty = new Set([...subject.empty, ...body.empty]);

  let ctaText = "";
  let ctaHtml = "";
  if (input.ctaLabel && input.ctaUrl) {
    const label = renderTemplate(input.ctaLabel, input.values);
    const link = renderTemplate(input.ctaUrl, input.values);
    for (const name of [...label.unknown, ...link.unknown]) unknown.add(name);
    const href = safeUrl(link.text);
    if (label.text && href) {
      ctaText = `\n\n${label.text}: ${href}`;
      ctaHtml = `\n<p style="margin:0 0 16px"><a href="${escapeHtml(href)}" style="color:#0891b2;font-weight:600">${escapeHtml(label.text)}</a></p>`;
    }
  }

  const signature = input.footer.signature.trim();
  const footerLines = [input.footer.companyName.trim(), input.footer.companyAddress.trim()].filter(Boolean);
  const unsubscribeLine = "If you would rather not hear from us, you can unsubscribe here";

  const text = [
    body.text + ctaText,
    signature,
    "--",
    ...footerLines,
    `${unsubscribeLine}: ${input.footer.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/--\n\n/, "--\n");

  const html = [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px">`,
    textToHtml(body.text) + ctaHtml,
    signature ? textToHtml(signature) : "",
    `<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0 12px">`,
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#64748b">${footerLines.map(escapeHtml).join("<br>")}${
      footerLines.length ? "<br>" : ""
    }${unsubscribeLine}: <a href="${escapeHtml(input.footer.unsubscribeUrl)}" style="color:#64748b">unsubscribe</a>.</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");

  // Line breaks in a subject would be a header injection.
  const cleanSubject = subject.text.replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  return { subject: cleanSubject, text, html, unknown: [...unknown], empty: [...empty] };
}
