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

function linkify(escapedLine: string, linkColor = "#0891b2"): string {
  return escapedLine.replace(URL_IN_TEXT, (url) => {
    const href = safeUrl(url.replace(/&amp;/g, "&"));
    return href ? `<a href="${escapeHtml(href)}" style="color:${linkColor}">${url}</a>` : url;
  });
}

interface ParagraphStyle {
  /** Inline style of every paragraph, or of paragraph `index`. */
  paragraph: string | ((index: number, text: string) => string);
  link: string;
}

const PLAIN_PARAGRAPHS: ParagraphStyle = { paragraph: "margin:0 0 16px", link: "#0891b2" };

/** Plain text to the simple HTML a personal email has: paragraphs and links. */
export function textToHtml(text: string, style: ParagraphStyle = PLAIN_PARAGRAPHS): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => {
      const css = typeof style.paragraph === "function" ? style.paragraph(index, paragraph) : style.paragraph;
      return `<p style="${css}">${paragraph.split("\n").map((line) => linkify(escapeHtml(line), style.link)).join("<br>")}</p>`;
    })
    .join("\n");
}

// ─── Designs ────────────────────────────────────────────────────────────────

export const EMAIL_DESIGNS = ["simple", "futuristic", "showcase"] as const;
export type EmailDesign = (typeof EMAIL_DESIGNS)[number];

export const EMAIL_DESIGN_LABELS: Record<EmailDesign, { label: string; hint: string }> = {
  simple: {
    label: "Simple",
    hint: "Reads like a personal email. Best inbox placement for cold outreach.",
  },
  showcase: {
    label: "Showcase",
    hint: "Bold promo layout: a colour hero, highlight boxes and service cards picked for the lead's company. Most striking; most likely to land in Promotions.",
  },
  futuristic: {
    label: "Futuristic",
    hint: "Dark card, neon accents and a button. More striking; more often filed under Promotions.",
  },
};

export function isEmailDesign(value: unknown): value is EmailDesign {
  return typeof value === "string" && (EMAIL_DESIGNS as readonly string[]).includes(value);
}

/**
 * The four services every outreach email can show (Settings → Sender →
 * "Show our services"). Paths are pages of the public site.
 */
export const OUTREACH_SERVICES = [
  { code: "01", tag: "WEB", title: "Web Development", line: "Fast, SEO-ready websites and web apps that turn visitors into enquiries.", path: "/services/web-development" },
  { code: "02", tag: "APPS", title: "Mobile App Development", line: "iOS and Android apps, from first idea to App Store launch.", path: "/services/mobile-apps" },
  { code: "03", tag: "GROWTH", title: "Digital Marketing", line: "SEO, Google and Meta ads and social media that bring in qualified leads.", path: "/services/digital-marketing" },
  { code: "04", tag: "AI", title: "AI Chatbots", line: "Website and WhatsApp assistants that answer, qualify and book clients 24/7.", path: "/services/ai-automation" },
] as const;

type ServiceLink = (typeof OUTREACH_SERVICES)[number] & { href: string };

/** What every design lays out. All text here is plain; each design escapes it. */
interface EmailParts {
  bodyText: string;
  cta: { label: string; href: string } | null;
  services: ServiceLink[];
  signature: string;
  footerLines: string[];
  unsubscribeLine: string;
  unsubscribeUrl: string;
  companyName: string;
  /** The lead's company, when known: "Picked for …" in the showcase design. */
  leadCompany: string;
}

function simpleServicesHtml(services: ServiceLink[]): string {
  if (services.length === 0) return "";
  const items = services
    .map(
      (s) =>
        `<li style="margin:0 0 6px"><a href="${escapeHtml(s.href)}" style="color:#0891b2;font-weight:600;text-decoration:none">${escapeHtml(s.title)}</a>: ${escapeHtml(s.line)}</li>`
    )
    .join("");
  return `\n<p style="margin:0 0 8px;font-weight:600">What we do</p>\n<ul style="margin:0 0 16px;padding-left:20px">${items}</ul>`;
}

function simpleHtml(parts: EmailParts): string {
  const ctaHtml = parts.cta
    ? `\n<p style="margin:0 0 16px"><a href="${escapeHtml(parts.cta.href)}" style="color:#0891b2;font-weight:600">${escapeHtml(parts.cta.label)}</a></p>`
    : "";
  return [
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:600px">`,
    textToHtml(parts.bodyText) + ctaHtml + simpleServicesHtml(parts.services),
    parts.signature ? textToHtml(parts.signature) : "",
    `<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0 12px">`,
    `<p style="margin:0;font-size:12px;line-height:1.5;color:#64748b">${parts.footerLines.map(escapeHtml).join("<br>")}${
      parts.footerLines.length ? "<br>" : ""
    }${parts.unsubscribeLine}: <a href="${escapeHtml(parts.unsubscribeUrl)}" style="color:#64748b">unsubscribe</a>.</p>`,
    `</div>`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * The futuristic design: a dark page, a glowing card with a neon accent line,
 * a gradient pill button and a monospace brand line. Built the way email has
 * to be built (tables, inline styles, no images, no web fonts), so it holds
 * up in Gmail, Outlook and Apple Mail; clients without gradients fall back to
 * solid teal.
 */
const FUTURE = {
  page: "#060a13",
  card: "#0c1322",
  border: "#1d2a44",
  text: "#d8e2f0",
  heading: "#ffffff",
  tile: "#0f1a2e",
  muted: "#8a9ab3",
  faint: "#5b6880",
  teal: "#2ee6d6",
  tealDeep: "#16b8b2",
  blue: "#60a5fa",
  violet: "#8b5cf6",
  ink: "#04111c",
  mono: "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace",
  sans: "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
} as const;

/** Hidden text that inbox lists show as the preview, instead of the brand line. */
function preheader(bodyText: string): string {
  const snippet = bodyText.replace(/\s+/g, " ").trim().slice(0, 120);
  return `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${FUTURE.page}">${escapeHtml(snippet)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`;
}

function futuristicHtml(parts: EmailParts): string {
  const f = FUTURE;
  const brand = (parts.companyName.trim().split(/\s+/)[0] || "BITSOL").toUpperCase();
  const body = textToHtml(parts.bodyText, {
    // A short first paragraph is the greeting: set it larger, in white.
    paragraph: (index, text) =>
      index === 0 && text.length <= 60
        ? `margin:0 0 20px;font-size:19px;line-height:1.4;font-weight:600;color:${f.heading}`
        : `margin:0 0 18px;color:${f.text}`,
    link: f.teal,
  });
  const cta = parts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px"><tr><td bgcolor="${f.tealDeep}" style="border-radius:999px;background-color:${f.tealDeep};background-image:linear-gradient(90deg,${f.teal},${f.blue})"><a href="${escapeHtml(parts.cta.href)}" style="display:inline-block;padding:13px 26px;border-radius:999px;font-family:${f.sans};font-size:15px;font-weight:700;line-height:1;color:${f.ink};text-decoration:none">${escapeHtml(parts.cta.label)}&nbsp;&rarr;</a></td></tr></table>`
    : "";
  // Two tiles a row; on a phone (or in Outlook, which ignores max-width) they stack.
  const tiles = parts.services
    .map(
      (s) =>
        `<div class="bx-tile" style="display:inline-block;width:100%;max-width:264px;vertical-align:top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 8px 10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${f.tile}" style="background-color:${f.tile};border:1px solid ${f.border};border-radius:12px"><tr><td style="padding:14px 16px 15px">` +
        `<div style="font-family:${f.mono};font-size:10px;line-height:1;letter-spacing:2px;color:${f.teal}">${s.code}&nbsp;//&nbsp;${escapeHtml(s.tag)}</div>` +
        `<div style="padding-top:9px;font-family:${f.sans};font-size:15px;line-height:1.3;font-weight:700"><a href="${escapeHtml(s.href)}" style="color:${f.heading};text-decoration:none">${escapeHtml(s.title)}</a></div>` +
        `<div style="padding-top:5px;font-family:${f.sans};font-size:13px;line-height:1.5;color:${f.muted}">${escapeHtml(s.line)}</div>` +
        `<div style="padding-top:9px;font-family:${f.sans};font-size:12px;line-height:1;font-weight:600"><a href="${escapeHtml(s.href)}" style="color:${f.teal};text-decoration:none">Explore&nbsp;&rarr;</a></div>` +
        `</td></tr></table></td></tr></table></div>`
    )
    .join("");
  const services = tiles
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:4px 0 12px;font-family:${f.mono};font-size:11px;line-height:1;letter-spacing:3px;color:${f.faint}">WHAT&nbsp;WE&nbsp;BUILD</td></tr><tr><td style="padding:0 0 18px;font-size:0;line-height:0;text-align:left">${tiles}</td></tr></table>`
    : "";
  const signature = parts.signature
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-top:18px;border-top:1px solid ${f.border}">${textToHtml(parts.signature, {
        paragraph: `margin:0 0 6px;font-size:14px;line-height:1.6;color:${f.muted}`,
        link: f.teal,
      })}</td></tr></table>`
    : "";
  const footer = `${parts.footerLines.map(escapeHtml).join("<br>")}${parts.footerLines.length ? "<br>" : ""}${parts.unsubscribeLine}: <a href="${escapeHtml(parts.unsubscribeUrl)}" style="color:${f.muted};text-decoration:underline">unsubscribe</a>.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title></title><style>@media (max-width:620px){.bx-tile{max-width:100%!important}.bx-pad{padding:28px 20px 24px!important}}</style></head>
<body style="margin:0;padding:0;background-color:${f.page}">
${preheader(parts.bodyText)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${f.page}" style="background-color:${f.page}">
<tr><td align="center" style="padding:32px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td style="padding:0 6px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${f.mono};font-size:13px;line-height:1;font-weight:700;letter-spacing:5px;color:${f.teal}">${escapeHtml(brand)}<span style="color:${f.violet}">_</span></td>
<td align="right" style="font-family:${f.mono};font-size:11px;line-height:1;letter-spacing:2px;color:${f.faint}">//&nbsp;GROWTH&nbsp;SYSTEMS</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${f.card}" style="background-color:${f.card};border:1px solid ${f.border};border-radius:18px;box-shadow:0 0 0 1px rgba(46,230,214,0.06),0 18px 48px rgba(46,230,214,0.08)">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="3" bgcolor="${f.tealDeep}" style="height:3px;line-height:3px;font-size:0;border-radius:18px 18px 0 0;background-color:${f.tealDeep};background-image:linear-gradient(90deg,${f.teal},${f.blue},${f.violet})">&nbsp;</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="bx-pad" style="padding:34px 32px 30px;font-family:${f.sans};font-size:16px;line-height:1.65;color:${f.text}">
${body}
${cta}
${services}
${signature}
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:20px 10px 0;font-family:${f.mono};font-size:10px;line-height:1.8;letter-spacing:2px;color:${f.faint}">WEB &nbsp;&middot;&nbsp; MOBILE&nbsp;APPS &nbsp;&middot;&nbsp; DIGITAL&nbsp;MARKETING &nbsp;&middot;&nbsp; AI&nbsp;CHATBOTS</td></tr>
<tr><td align="center" style="padding:12px 16px 0;font-family:${f.sans};font-size:12px;line-height:1.6;color:${f.faint}">${footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

/**
 * The showcase design: a bold promo layout for outreach. A colour hero with
 * a stacked headline and three highlight boxes, a pill button, then a white
 * panel with the personal message and the four services "picked for" the
 * lead's company. Same email-safe construction as the futuristic design.
 */
const SHOW = {
  page: "#0a1226",
  panel: "#ffffff",
  card: "#f2f6fc",
  navy: "#0d1b36",
  text: "#23324d",
  muted: "#5d6b86",
  faint: "#7d8aa5",
  line: "#e3e9f3",
  lime: "#c8ff3d",
  teal: "#16b8b2",
  blue: "#2f5bff",
  violet: "#6d3df5",
  heroText: "#ffffff",
  mono: "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace",
  sans: "'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  display: "'Arial Black','Segoe UI Black','Helvetica Neue',Arial,sans-serif",
} as const;

const SHOWCASE_HIGHLIGHTS = [
  { value: "FREE", label: "consultation" },
  { value: "24/7", label: "AI chatbot replies" },
  { value: "4-IN-1", label: "services, one team" },
] as const;

const SERVICE_ACCENTS = [SHOW.teal, SHOW.blue, SHOW.violet, "#8fbf00"] as const;

function showcaseHtml(parts: EmailParts): string {
  const c = SHOW;
  const brand = (parts.companyName.trim().split(/\s+/)[0] || "BITSOL").toUpperCase();
  const forWhom = parts.leadCompany ? parts.leadCompany : "your business";
  const ctaHref = parts.cta?.href ?? "https://bitsolmarketing.com/contact";
  const ctaLabel = parts.cta?.label ?? "Book a free call";

  const highlights = SHOWCASE_HIGHLIGHTS.map(
    (h) =>
      `<div class="sc-hl" style="display:inline-block;width:100%;max-width:176px;vertical-align:top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 5px 10px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid ${c.lime};border-radius:16px"><tr><td align="center" style="padding:16px 10px 14px">` +
      `<div style="font-family:${c.display};font-size:28px;line-height:1;font-weight:900;letter-spacing:-0.5px;color:${c.heroText}">${escapeHtml(h.value)}</div>` +
      `<div style="padding-top:8px;font-family:${c.mono};font-size:11px;line-height:1.3;letter-spacing:1px;text-transform:uppercase;color:${c.lime}">${escapeHtml(h.label)}</div>` +
      `</td></tr></table></td></tr></table></div>`
  ).join("");

  const body = textToHtml(parts.bodyText, {
    paragraph: (index, text) =>
      index === 0 && text.length <= 60
        ? `margin:0 0 18px;font-size:20px;line-height:1.35;font-weight:800;color:${c.navy}`
        : `margin:0 0 16px;color:${c.text}`,
    link: c.blue,
  });

  const cards = parts.services
    .map(
      (s, i) =>
        `<div class="sc-card" style="display:inline-block;width:100%;max-width:262px;vertical-align:top"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 6px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.card}" style="background-color:${c.card};border-radius:16px;border-top:4px solid ${SERVICE_ACCENTS[i % SERVICE_ACCENTS.length]}"><tr><td style="padding:16px 18px 18px">` +
        `<div style="font-family:${c.display};font-size:22px;line-height:1;font-weight:900;color:${SERVICE_ACCENTS[i % SERVICE_ACCENTS.length]}">${s.code}</div>` +
        `<div style="padding-top:10px;font-family:${c.sans};font-size:16px;line-height:1.3;font-weight:800"><a href="${escapeHtml(s.href)}" style="color:${c.navy};text-decoration:none">${escapeHtml(s.title)}</a></div>` +
        `<div style="padding-top:6px;font-family:${c.sans};font-size:13px;line-height:1.55;color:${c.muted}">${escapeHtml(s.line)}</div>` +
        `<div style="padding-top:10px;font-family:${c.sans};font-size:13px;line-height:1;font-weight:700"><a href="${escapeHtml(s.href)}" style="color:${c.blue};text-decoration:none">See how&nbsp;&rarr;</a></div>` +
        `</td></tr></table></td></tr></table></div>`
    )
    .join("");
  const services = cards
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px"><tr><td style="padding:22px 0 4px;border-top:1px solid ${c.line};font-family:${c.mono};font-size:11px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:${c.teal}">Picked for ${escapeHtml(forWhom)}</td></tr>` +
      `<tr><td style="padding:4px 0 16px;font-family:${c.sans};font-size:24px;line-height:1.25;font-weight:800;color:${c.navy}">Four ways we can help</td></tr>` +
      `<tr><td style="padding:0 0 8px;font-size:0;line-height:0;text-align:left;margin:0 -6px">${cards}</td></tr></table>`
    : "";

  const signature = parts.signature
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding-top:16px;border-top:1px solid ${c.line}">${textToHtml(parts.signature, {
        paragraph: `margin:0 0 6px;font-size:14px;line-height:1.6;color:${c.muted}`,
        link: c.blue,
      })}</td></tr></table>`
    : "";
  const footer = `${parts.footerLines.map(escapeHtml).join("<br>")}${parts.footerLines.length ? "<br>" : ""}${parts.unsubscribeLine}: <a href="${escapeHtml(parts.unsubscribeUrl)}" style="color:${c.faint};text-decoration:underline">unsubscribe</a>.`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title></title><style>@media (max-width:620px){.sc-hl,.sc-card{max-width:100%!important}.sc-pad{padding-left:20px!important;padding-right:20px!important}.sc-h1{font-size:40px!important}}</style></head>
<body style="margin:0;padding:0;background-color:${c.page}">
${preheader(parts.bodyText)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.page}" style="background-color:${c.page}">
<tr><td align="center" style="padding:28px 12px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">
<tr><td style="padding:0 4px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td><span style="display:inline-block;padding:7px 14px;border-radius:999px;background-color:${c.lime};font-family:${c.mono};font-size:12px;line-height:1;font-weight:700;letter-spacing:3px;color:${c.navy}">${escapeHtml(brand)}</span></td>
<td align="right" style="font-family:${c.mono};font-size:11px;line-height:1;letter-spacing:1px;color:${c.faint}"><a href="https://bitsolmarketing.com" style="color:${c.faint};text-decoration:none">bitsolmarketing.com&nbsp;&#8599;</a></td>
</tr></table>
</td></tr>
<tr><td bgcolor="${c.blue}" class="sc-pad" align="center" style="padding:40px 30px 34px;border-radius:28px;background-color:${c.blue};background-image:linear-gradient(135deg,${c.teal} 0%,${c.blue} 55%,${c.violet} 100%)">
<div style="font-family:${c.mono};font-size:11px;line-height:1.4;letter-spacing:3px;text-transform:uppercase;color:${c.lime}">&#9679;&nbsp; Growth stack for ${escapeHtml(forWhom)}</div>
<div class="sc-h1" style="padding-top:16px;font-family:${c.display};font-size:52px;line-height:0.98;font-weight:900;letter-spacing:-1.5px;color:${c.heroText}">BUILD.<br>LAUNCH.<br><span style="color:${c.lime}">GROW.</span></div>
<div style="padding:18px 6px 24px;font-family:${c.sans};font-size:16px;line-height:1.55;color:#e8f0ff">Websites, mobile apps, digital marketing and AI&nbsp;chatbots, from one team.</div>
<div style="font-size:0;line-height:0;text-align:center">${highlights}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:16px auto 0"><tr><td bgcolor="${c.lime}" style="border-radius:999px;background-color:${c.lime}"><a href="${escapeHtml(ctaHref)}" style="display:inline-block;padding:15px 30px;border-radius:999px;font-family:${c.sans};font-size:16px;font-weight:800;line-height:1;color:${c.navy};text-decoration:none">${escapeHtml(ctaLabel)}&nbsp;&rarr;</a></td></tr></table>
</td></tr>
<tr><td style="height:16px;line-height:16px;font-size:0">&nbsp;</td></tr>
<tr><td bgcolor="${c.panel}" class="sc-pad" style="padding:34px 32px 30px;border-radius:28px;background-color:${c.panel};font-family:${c.sans};font-size:16px;line-height:1.65;color:${c.text}">
${body}
${services}
${signature}
</td></tr>
<tr><td align="center" style="padding:22px 10px 0;font-family:${c.mono};font-size:10px;line-height:1.8;letter-spacing:2px;color:${c.faint}">WEB &nbsp;&middot;&nbsp; MOBILE&nbsp;APPS &nbsp;&middot;&nbsp; DIGITAL&nbsp;MARKETING &nbsp;&middot;&nbsp; AI&nbsp;CHATBOTS</td></tr>
<tr><td align="center" style="padding:12px 16px 0;font-family:${c.sans};font-size:12px;line-height:1.6;color:${c.faint}">${footer}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

export interface ComposeInput {
  subject: string;
  body: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  values: TemplateValues;
  footer: { companyName: string; companyAddress: string; signature: string; unsubscribeUrl: string };
  /** The HTML design; the plain-text version is the same for every design. */
  design?: EmailDesign;
  /** Show the four services (OUTREACH_SERVICES), linked to pages under this site URL. */
  services?: { siteUrl: string } | null;
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
  let cta: EmailParts["cta"] = null;
  if (input.ctaLabel && input.ctaUrl) {
    const label = renderTemplate(input.ctaLabel, input.values);
    const link = renderTemplate(input.ctaUrl, input.values);
    for (const name of [...label.unknown, ...link.unknown]) unknown.add(name);
    const href = safeUrl(link.text);
    if (label.text && href) {
      ctaText = `\n\n${label.text}: ${href}`;
      cta = { label: label.text, href };
    }
  }

  const signature = input.footer.signature.trim();
  const footerLines = [input.footer.companyName.trim(), input.footer.companyAddress.trim()].filter(Boolean);
  const unsubscribeLine = "If you would rather not hear from us, you can unsubscribe here";

  const siteUrl = input.services ? input.services.siteUrl.replace(/\/+$/, "") : "";
  const services: ServiceLink[] = input.services ? OUTREACH_SERVICES.map((s) => ({ ...s, href: `${siteUrl}${s.path}` })) : [];
  const servicesText = services.length ? `\n\nWhat we do:\n${services.map((s) => `- ${s.title}: ${s.line} ${s.href}`).join("\n")}` : "";

  const text = [
    body.text + ctaText + servicesText,
    signature,
    "--",
    ...footerLines,
    `${unsubscribeLine}: ${input.footer.unsubscribeUrl}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .replace(/--\n\n/, "--\n");

  const parts: EmailParts = {
    bodyText: body.text,
    cta,
    services,
    signature,
    footerLines,
    unsubscribeLine,
    unsubscribeUrl: input.footer.unsubscribeUrl,
    companyName: input.footer.companyName,
    leadCompany: (input.values.company_name ?? "").trim(),
  };
  const html =
    input.design === "futuristic" ? futuristicHtml(parts) : input.design === "showcase" ? showcaseHtml(parts) : simpleHtml(parts);

  // Line breaks in a subject would be a header injection.
  const cleanSubject = subject.text.replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  return { subject: cleanSubject, text, html, unknown: [...unknown], empty: [...empty] };
}
