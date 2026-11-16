import { Prisma, type TemplateCategory, type TemplateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unreachable } from "./client";
import { getWhatsAppSettings, type WhatsAppSettings } from "./settings";

/**
 * =============================================================================
 *  WhatsApp message templates: Meta's side
 * =============================================================================
 *
 *  Templates live in the WhatsApp Business Account, not in this database and
 *  not on the phone number. Meta reviews every one of them, and a template
 *  that has not been approved cannot be sent to anyone outside the 24-hour
 *  customer service window, which is every recipient of a broadcast.
 *
 *  So this module does three things:
 *
 *    • `fetchTemplates`  reads the account's templates from the Graph API,
 *    • `syncTemplates`   mirrors them into `WhatsappTemplate`,
 *    • `submitTemplate`  creates one in Meta and leaves it awaiting review.
 *
 *  The local table is a cache. Meta is the authority on whether a template
 *  exists and whether it may be used; `syncedAt` records when the two last
 *  agreed. Nothing here throws: every function returns a result object, so a
 *  Graph outage puts a notice on the page rather than a 500.
 *
 *  The account ID, token and API version come from the WhatsApp settings
 *  (Admin → Chatbot → Setup, or the server environment).
 *
 *  Reference:
 *  https://developers.facebook.com/docs/graph-api/reference/whats-app-business-account/message_templates
 * =============================================================================
 */

const GRAPH_HOST = "https://graph.facebook.com";
const TIMEOUT_MS = 20_000;

/** Meta rejects a template name that is not lowercase alphanumeric + `_`. */
export const TEMPLATE_NAME_PATTERN = /^[a-z0-9_]{1,512}$/;

export const TEMPLATES_NOT_READY =
  "Template management needs the WhatsApp Business Account ID and a permanent access token with whatsapp_business_management, entered under Admin → Chatbot → Setup.";

/** Templates can be read and created: an account ID and an access token are set. */
export function templatesReady(settings: WhatsAppSettings): boolean {
  return Boolean(settings.wabaId && settings.token);
}

// ------------------------------------------------------------ Wire types ----

/** One component of a template, in Meta's own shape. */
export interface MetaComponent {
  type?: string;
  format?: string;
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    header_handle?: string[];
  };
  buttons?: Array<{
    type?: string;
    text?: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface MetaTemplate {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  quality_score?: { score?: string };
  rejected_reason?: string;
  components?: MetaComponent[];
}

export interface TemplateApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  /** Meta's own error code, worth quoting in a support thread. */
  code?: number;
}

// ------------------------------------------------------------- Transport ----

function accountUrl(settings: WhatsAppSettings, path: string): string {
  return `${GRAPH_HOST}/${settings.apiVersion}/${settings.wabaId}/${path}`;
}

/** A Graph call with the same failure vocabulary as the message client. */
async function graph<T>(settings: WhatsAppSettings, url: string, init?: RequestInit): Promise<TemplateApiResult<T>> {
  if (!templatesReady(settings)) return { ok: false, error: TEMPLATES_NOT_READY };

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${settings.token}`,
        "Content-Type": "application/json",
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const body = (await response.json().catch(() => null)) as
      | (T & { error?: { message?: string; code?: number; error_user_msg?: string } })
      | null;

    if (!response.ok || body?.error) {
      const code = body?.error?.code;
      return {
        ok: false,
        code,
        error:
          code === 190
            ? "The access token is invalid or expired. Paste a permanent System User token on the Setup page."
            : code === 200 || code === 10
              ? "The access token lacks the whatsapp_business_management permission, which reading and creating templates needs."
              : code === 100
                ? "Meta rejected the request. Check the WhatsApp Business Account ID on the Setup page: the template endpoints want the account ID, not the phone number ID."
                : (body?.error?.error_user_msg ?? body?.error?.message ?? `Meta returned HTTP ${response.status}.`),
      };
    }

    return { ok: true, data: body as T };
  } catch (error) {
    return { ok: false, error: unreachable(error, TIMEOUT_MS / 1000) };
  }
}

// ------------------------------------------------------------------ Read ----

/**
 * Every template in the business account. Meta pages this endpoint, so the
 * cursor is followed to the end rather than taking the first 100 and quietly
 * losing the rest. The page budget guards against a paging loop.
 */
export async function fetchTemplates(settings: WhatsAppSettings): Promise<TemplateApiResult<MetaTemplate[]>> {
  const collected: MetaTemplate[] = [];
  let url =
    `${accountUrl(settings, "message_templates")}?limit=100` +
    "&fields=id,name,language,status,category,quality_score,rejected_reason,components";

  for (let page = 0; page < 25; page++) {
    const result = await graph<{ data?: MetaTemplate[]; paging?: { next?: string } }>(settings, url);
    if (!result.ok) return { ok: false, error: result.error, code: result.code };

    collected.push(...(result.data?.data ?? []));

    const next = result.data?.paging?.next;
    if (!next) return { ok: true, data: collected };
    url = next;
  }

  // Fell out of the loop: return what was read rather than nothing, but say so.
  return { ok: true, data: collected, error: "Stopped after 25 pages of templates; some may be missing." };
}

// --------------------------------------------------------------- Mapping ----

/** Meta's status strings → the local enum. Anything unrecognised counts as paused. */
export function toTemplateStatus(value: string | undefined): TemplateStatus {
  switch ((value ?? "").toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "PENDING":
    case "IN_APPEAL":
    case "PENDING_DELETION":
      return "PENDING";
    case "REJECTED":
      return "REJECTED";
    case "DISABLED":
    case "DELETED":
      return "DISABLED";
    default:
      return "PAUSED";
  }
}

export function toTemplateCategory(value: string | undefined): TemplateCategory {
  switch ((value ?? "").toUpperCase()) {
    case "MARKETING":
      return "MARKETING";
    case "AUTHENTICATION":
      return "AUTHENTICATION";
    default:
      return "UTILITY";
  }
}

/**
 * How many `{{n}}` placeholders a piece of template text carries. Meta
 * numbers them from 1 and requires them contiguous, so the highest index is
 * the count, which tolerates `{{2}}` appearing before `{{1}}` in Urdu word
 * order.
 */
export function countPlaceholders(text: string): number {
  const found = text.match(/\{\{\s*(\d+)\s*\}\}/g);
  if (!found) return 0;
  return Math.max(...found.map((token) => Number(token.replace(/\D/g, "")) || 0));
}

export interface FlatTemplate {
  body: string;
  headerText: string | null;
  headerFormat: string | null;
  footerText: string | null;
  buttons: MetaComponent["buttons"] | null;
  variableCount: number;
}

/** Pull the fields the panel renders out of Meta's component array. */
export function flattenComponents(components: MetaComponent[] | undefined): FlatTemplate {
  const list = components ?? [];
  const find = (type: string) => list.find((c) => (c.type ?? "").toUpperCase() === type);
  const header = find("HEADER");
  const body = find("BODY");
  const footer = find("FOOTER");
  const buttons = find("BUTTONS");
  const bodyText = body?.text ?? "";

  return {
    body: bodyText,
    headerText: header?.text ?? null,
    headerFormat: header ? (header.format ?? "TEXT").toUpperCase() : null,
    footerText: footer?.text ?? null,
    buttons: buttons?.buttons ?? null,
    variableCount: countPlaceholders(bodyText),
  };
}

/** The `variables` JSON column as the string array it holds. */
export function readVariables(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/**
 * Variable labels for a template. Meta stores no names for parameters, only
 * positions, so labels someone wrote here are kept and the rest fall back to
 * a positional label.
 */
export function mergeVariableNames(existing: string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => existing[index]?.trim() || `Variable ${index + 1}`);
}

/** A value on its way into a nullable JSON column: SQL NULL when absent. */
function asJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return value == null ? Prisma.DbNull : (value as Prisma.InputJsonValue);
}

/** `consultation_reminder` → `Consultation reminder`, a readable default. */
export function humanTemplateName(metaName: string): string {
  const words = metaName.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ------------------------------------------------------------------ Sync ----

export interface SyncOutcome {
  ok: boolean;
  created: number;
  updated: number;
  /** Local rows Meta no longer lists: deleted there, now marked disabled. */
  removed: number;
  error?: string;
}

/**
 * Mirror the account's templates into the local table.
 *
 * Matching is on (metaName, languageCode) rather than on Meta's id, because a
 * template deleted and recreated under the same name gets a new id, and the
 * panel should treat that as the same template coming back. A row Meta no
 * longer lists is marked DISABLED rather than deleted, so a broadcast that
 * used it keeps its history. That step is skipped when the read was cut
 * short, since a missing page is not a missing template.
 */
export async function syncTemplates(): Promise<SyncOutcome> {
  const settings = await getWhatsAppSettings({ fresh: true });
  const fetched = await fetchTemplates(settings);
  if (!fetched.ok || !fetched.data) {
    return { ok: false, created: 0, updated: 0, removed: 0, error: fetched.error };
  }

  const now = new Date();
  const seen: string[] = [];
  let created = 0;
  let updated = 0;

  for (const template of fetched.data) {
    const metaName = template.name?.trim();
    const languageCode = template.language?.trim();
    if (!metaName || !languageCode) continue;

    const flat = flattenComponents(template.components);
    // A template with no BODY cannot be used in a broadcast; skip it rather
    // than storing a row the composer would have to special-case forever.
    if (!flat.body) continue;

    const existing = await prisma.whatsappTemplate.findUnique({
      where: { metaName_languageCode: { metaName, languageCode } },
      select: { id: true, variables: true },
    });

    const data = {
      metaId: template.id ?? null,
      category: toTemplateCategory(template.category),
      status: toTemplateStatus(template.status),
      body: flat.body,
      headerText: flat.headerText,
      headerFormat: flat.headerFormat,
      footerText: flat.footerText,
      buttons: asJson(flat.buttons),
      components: asJson(template.components),
      variables: mergeVariableNames(readVariables(existing?.variables), flat.variableCount),
      rejectedReason: template.rejected_reason ?? null,
      qualityScore: template.quality_score?.score ?? null,
      syncedAt: now,
    };

    if (existing) {
      await prisma.whatsappTemplate.update({ where: { id: existing.id }, data });
      seen.push(existing.id);
      updated++;
    } else {
      const row = await prisma.whatsappTemplate.create({
        data: { ...data, metaName, languageCode, name: humanTemplateName(metaName) },
        select: { id: true },
      });
      seen.push(row.id);
      created++;
    }
  }

  let removed = 0;
  if (!fetched.error) {
    const gone = await prisma.whatsappTemplate.updateMany({
      where: { id: { notIn: seen }, metaId: { not: null }, status: { not: "DISABLED" } },
      data: { status: "DISABLED", syncedAt: now },
    });
    removed = gone.count;
  }

  return { ok: true, created, updated, removed, error: fetched.error };
}

// ---------------------------------------------------------------- Create ----

export interface TemplateDraft {
  metaName: string;
  languageCode: string;
  category: TemplateCategory;
  body: string;
  headerText?: string;
  footerText?: string;
  /** One example value per `{{n}}`, in order. Meta requires these to review. */
  examples?: string[];
}

/**
 * Create a template in Meta and leave it awaiting review. Meta will not
 * review a template whose placeholders carry no example values, and the
 * rejection reads as a generic "invalid parameter", so examples are always
 * filled in here.
 */
export async function submitTemplate(
  draft: TemplateDraft
): Promise<TemplateApiResult<{ id?: string; status?: string; category?: string }>> {
  if (!TEMPLATE_NAME_PATTERN.test(draft.metaName)) {
    return { ok: false, error: "The template name may only contain lowercase letters, numbers and underscores." };
  }

  const settings = await getWhatsAppSettings({ fresh: true });
  const placeholders = countPlaceholders(draft.body);
  const examples = Array.from({ length: placeholders }, (_, index) => draft.examples?.[index]?.trim() || `Example ${index + 1}`);
  const components: MetaComponent[] = [];

  if (draft.headerText?.trim()) {
    const headerText = draft.headerText.trim();
    const headerPlaceholders = countPlaceholders(headerText);
    components.push({
      type: "HEADER",
      format: "TEXT",
      text: headerText,
      ...(headerPlaceholders
        ? { example: { header_text: Array.from({ length: headerPlaceholders }, (_, index) => `Example ${index + 1}`) } }
        : {}),
    });
  }

  components.push({
    type: "BODY",
    text: draft.body,
    // `body_text` is an array of parameter sets, one per example message.
    ...(examples.length ? { example: { body_text: [examples] } } : {}),
  });

  if (draft.footerText?.trim()) {
    components.push({ type: "FOOTER", text: draft.footerText.trim() });
  }

  return graph(settings, accountUrl(settings, "message_templates"), {
    method: "POST",
    body: JSON.stringify({ name: draft.metaName, language: draft.languageCode, category: draft.category, components }),
  });
}

/**
 * Delete a template from Meta, by name. Meta deletes every language variant
 * sharing the name; that is the API's behaviour, and why the panel asks for
 * confirmation first.
 */
export async function deleteTemplate(metaName: string): Promise<TemplateApiResult<unknown>> {
  const settings = await getWhatsAppSettings({ fresh: true });
  return graph(settings, `${accountUrl(settings, "message_templates")}?name=${encodeURIComponent(metaName)}`, { method: "DELETE" });
}

// --------------------------------------------------------------- Preview ----

/** Substitute `{{1}}`, `{{2}}`… so a draft reads the way the recipient sees it. */
export function renderTemplate(body: string, values: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => {
    const value = values[Number(index) - 1];
    return value?.trim() ? value : match;
  });
}
