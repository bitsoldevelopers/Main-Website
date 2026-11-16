"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { rateLimit } from "@/lib/rate-limit";
import { shortId } from "@/lib/utils";
import {
  claimBroadcast,
  countAudience,
  importContacts,
  inspectNumberList,
  MAX_RECIPIENTS,
  parseParameters,
  prepareBroadcast,
  previewBody,
  requiresHeaderMedia,
  runBroadcastSafely,
  validateParameters,
  type NumberListReport,
} from "@/lib/whatsapp/broadcast";
import { parseNumberList } from "@/lib/whatsapp/numbers";
import { getWhatsAppSettings } from "@/lib/whatsapp/settings";
import {
  countPlaceholders,
  deleteTemplate,
  submitTemplate,
  syncTemplates,
  TEMPLATE_NAME_PATTERN,
  TEMPLATES_NOT_READY,
  templatesReady,
} from "@/lib/whatsapp/templates";

/**
 * Writes for Admin → Chatbot → Templates and Broadcasts. Everything here
 * needs `chatbot.manage`: a broadcast messages real phones and Meta charges
 * for every conversation it opens.
 */

const TEMPLATES_PATH = "/admin/chatbot/templates";
const BROADCASTS_PATH = "/admin/chatbot/broadcasts";

export type ActionResult = { ok: boolean; message?: string; error?: string };

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(error: unknown, fallback: string): string {
  return (error instanceof Error && error.message.split("\n").find(Boolean)) || fallback;
}

function revalidateBroadcasts(id?: string) {
  revalidatePath(BROADCASTS_PATH);
  if (id) revalidatePath(`${BROADCASTS_PATH}/${id}`);
}

// ─── Templates ──────────────────────────────────────────────────────────────

/** Pull the business account's templates into the local table. */
export async function syncWhatsAppTemplates(): Promise<ActionResult> {
  const session = await requireAdminAction("chatbot.manage");
  if (!rateLimit("whatsapp-templates-sync", 6, 60_000)) {
    return { ok: false, error: "Templates were synced a moment ago. Wait a minute before syncing again." };
  }
  if (!templatesReady(await getWhatsAppSettings({ fresh: true }))) return { ok: false, error: TEMPLATES_NOT_READY };

  let outcome: Awaited<ReturnType<typeof syncTemplates>>;
  try {
    outcome = await syncTemplates();
  } catch (error) {
    return { ok: false, error: failure(error, "The templates could not be saved.") };
  }
  if (!outcome.ok) return { ok: false, error: outcome.error ?? "Sync failed." };

  void logActivity({
    actor: actorLabel(session),
    action: "whatsapp.templates_synced",
    entity: "whatsappTemplate",
    detail: `${outcome.created} new, ${outcome.updated} updated, ${outcome.removed} no longer in Meta`,
  });
  revalidatePath(TEMPLATES_PATH);
  revalidateBroadcasts();
  return {
    ok: true,
    message:
      `Synced from Meta: ${outcome.created} new, ${outcome.updated} updated` +
      (outcome.removed ? `, ${outcome.removed} marked disabled because Meta no longer lists ${outcome.removed === 1 ? "it" : "them"}` : "") +
      "." +
      (outcome.error ? ` ${outcome.error}` : ""),
  };
}

export type TemplateFormState = { ok: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const TEMPLATE_CATEGORIES = ["UTILITY", "MARKETING", "AUTHENTICATION"] as const;

/**
 * Submit a new template to Meta for review, then mirror it locally, in that
 * order and never the other way round: a local row for a template Meta
 * rejected at creation would show in the composer and fail on every send.
 */
export async function submitWhatsAppTemplate(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const session = await requireAdminAction("chatbot.manage");

  const name = str(formData, "name").slice(0, 120);
  const metaName = str(formData, "metaName").slice(0, 512);
  const languageCode = str(formData, "languageCode").slice(0, 10) || "en";
  const category = str(formData, "category") as (typeof TEMPLATE_CATEGORIES)[number];
  const headerText = str(formData, "headerText").slice(0, 60);
  const body = str(formData, "body").slice(0, 1024);
  const footerText = str(formData, "footerText").slice(0, 60);
  const examples = formData
    .getAll("examples")
    .map((value) => (typeof value === "string" ? value.trim().slice(0, 200) : ""));
  const variables = formData
    .getAll("variables")
    .map((value) => (typeof value === "string" ? value.trim().slice(0, 60) : ""));

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "Give the template a name for the panel.";
  if (!TEMPLATE_NAME_PATTERN.test(metaName)) fieldErrors.metaName = "Lowercase letters, numbers and underscores only. Meta rejects anything else.";
  if (!body) fieldErrors.body = "The message body is required.";
  if (!TEMPLATE_CATEGORIES.includes(category)) fieldErrors.category = "Pick a category.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const settings = await getWhatsAppSettings({ fresh: true });
  if (!templatesReady(settings)) return { ok: false, error: TEMPLATES_NOT_READY };

  try {
    // Meta's uniqueness is name + language; checking here avoids an opaque
    // duplicate-name error from the Graph call.
    const clash = await prisma.whatsappTemplate.findUnique({
      where: { metaName_languageCode: { metaName, languageCode } },
      select: { id: true },
    });
    if (clash) return { ok: false, error: `A ${languageCode} template named "${metaName}" already exists.`, fieldErrors: { metaName: "Already in use." } };
  } catch (error) {
    return { ok: false, error: failure(error, "The template list could not be read.") };
  }

  const submitted = await submitTemplate({ metaName, languageCode, category, body, headerText, footerText, examples });
  if (!submitted.ok) return { ok: false, error: submitted.error ?? "Meta rejected the template." };

  const placeholders = countPlaceholders(body);
  try {
    await prisma.whatsappTemplate.create({
      data: {
        metaName,
        metaId: submitted.data?.id ?? null,
        name,
        languageCode,
        // Meta may re-categorise a template during review; the next sync
        // records whatever it decided.
        category: TEMPLATE_CATEGORIES.includes(submitted.data?.category as never) ? (submitted.data?.category as typeof category) : category,
        status: "PENDING",
        body,
        headerText: headerText || null,
        headerFormat: headerText ? "TEXT" : null,
        footerText: footerText || null,
        variables: Array.from({ length: placeholders }, (_, index) => variables[index] || `Variable ${index + 1}`),
        syncedAt: new Date(),
      },
    });
  } catch (error) {
    // The template now exists in Meta but not here. Say so plainly: a sync
    // will pick it up, and a silent failure would have someone submitting it twice.
    console.error("[whatsapp] template saved in Meta but not locally:", error);
    return { ok: false, error: "Meta accepted the template but it could not be saved here. Press Sync from Meta to pull it in." };
  }

  void logActivity({
    actor: actorLabel(session),
    action: "whatsapp.template_submitted",
    entity: "whatsappTemplate",
    detail: `${metaName} (${languageCode}, ${category.toLowerCase()})`,
  });
  revalidatePath(TEMPLATES_PATH);
  return { ok: true, message: `"${name}" was submitted to Meta. It stays pending until the review finishes; press Sync from Meta to pick up the verdict.` };
}

/**
 * Delete a template from Meta and from the local mirror. Meta deletes every
 * language variant sharing the name, so the local rows for the other
 * languages go too. A template that was never submitted is only a local row.
 */
export async function deleteWhatsAppTemplate(id: string): Promise<ActionResult> {
  const session = await requireAdminAction("chatbot.manage");
  const template = await prisma.whatsappTemplate.findUnique({ where: { id } }).catch(() => null);
  if (!template) return { ok: false, error: "Template not found." };

  if (template.metaId) {
    const removed = await deleteTemplate(template.metaName);
    if (!removed.ok) return { ok: false, error: removed.error ?? "Meta refused to delete the template." };
  }

  let count = 0;
  try {
    ({ count } = await prisma.whatsappTemplate.deleteMany({ where: template.metaId ? { metaName: template.metaName } : { id } }));
  } catch (error) {
    return { ok: false, error: failure(error, "The template could not be removed.") };
  }

  void logActivity({
    actor: actorLabel(session),
    action: "whatsapp.template_deleted",
    entity: "whatsappTemplate",
    entityId: id,
    detail: `${template.metaName} (${count} language variant${count === 1 ? "" : "s"})`,
  });
  revalidatePath(TEMPLATES_PATH);
  revalidateBroadcasts();
  return { ok: true, message: template.metaId ? `Deleted ${template.metaName} from Meta.` : `Removed ${template.metaName}.` };
}

// ─── Audience ───────────────────────────────────────────────────────────────

/** How many contacts a segment currently matches. Read-only; the composer calls it as the filter changes. */
export async function countBroadcastAudience(filter: { activeWithinDays: number | null; limit: number | null }): Promise<{ ok: boolean; count?: number; error?: string }> {
  await requireAdminAction("chatbot.manage");
  const activeWithinDays = Number.isFinite(filter.activeWithinDays) && filter.activeWithinDays! > 0 ? Math.min(Math.floor(filter.activeWithinDays!), 3650) : null;
  const limit = Number.isFinite(filter.limit) && filter.limit! > 0 ? Math.min(Math.floor(filter.limit!), MAX_RECIPIENTS) : null;
  try {
    return { ok: true, count: await countAudience({ kind: "segment", activeWithinDays, limit }) };
  } catch (error) {
    return { ok: false, error: failure(error, "The audience could not be counted.") };
  }
}

/** What a pasted list contains, before anything is saved. */
export async function inspectBroadcastNumbers(text: string, countryCode?: string): Promise<{ ok: boolean; report?: NumberListReport; error?: string }> {
  await requireAdminAction("chatbot.manage");
  if (typeof text !== "string" || text.length > 1_000_000) return { ok: false, error: "That list is too long to read." };
  const code = typeof countryCode === "string" && /^\d{1,4}$/.test(countryCode) ? countryCode : undefined;
  try {
    return { ok: true, report: await inspectNumberList(text, code) };
  } catch (error) {
    return { ok: false, error: failure(error, "The list could not be checked.") };
  }
}

// ─── Broadcasts ─────────────────────────────────────────────────────────────

const parameterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("static"), value: z.string().min(1).max(600) }),
  z.object({ kind: z.literal("contactName"), fallback: z.string().max(60).optional() }),
  z.object({ kind: z.literal("contactPhone") }),
]);

const createSchema = z.object({
  title: z.string().trim().min(1, "Give the broadcast a name.").max(160),
  templateId: z.string().min(1, "Choose a template."),
  /** One entry per `{{n}}` in the template body, in order. */
  parameters: z.array(parameterSchema).max(20).default([]),
  /** Required when the template header is an image, video or document. */
  headerMediaUrl: z.string().trim().max(2000).optional(),
  /** Pasted numbers or CSV text, when the audience is a pasted list. */
  numbers: z.string().max(1_000_000).optional(),
  countryCode: z.string().regex(/^\d{1,4}$/).default("92"),
  audience: z
    .object({
      kind: z.enum(["segment", "list"]).default("segment"),
      activeWithinDays: z.number().int().positive().max(3650).nullable().default(null),
      limit: z.number().int().positive().max(MAX_RECIPIENTS).nullable().default(null),
    })
    .default({ kind: "segment", activeWithinDays: null, limit: null }),
  /** ISO date-time. Set when the broadcast should go out later, via the cron. */
  scheduledAt: z.string().datetime({ offset: true }).optional(),
});

export type CreateBroadcastInput = z.input<typeof createSchema>;
export type CreateBroadcastResult = { ok: true; id: string; reference: string; recipients: number; scheduled: boolean } | { ok: false; error: string };

/**
 * Create a broadcast as a draft with its recipient list already built, and
 * send nothing. Sending is a separate, explicit step, because a broadcast is
 * the one action in the panel that cannot be undone once it starts.
 */
export async function createBroadcast(input: CreateBroadcastInput): Promise<CreateBroadcastResult> {
  const session = await requireAdminAction("chatbot.manage");

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid broadcast." };
  const draft = parsed.data;

  try {
    const template = await prisma.whatsappTemplate.findUnique({ where: { id: draft.templateId } });
    if (!template) return { ok: false, error: "Template not found." };
    if (template.status !== "APPROVED" || !template.metaId) {
      return { ok: false, error: `"${template.name}" is ${template.status.toLowerCase()} in Meta. Only an approved template can be broadcast.` };
    }

    const sources = parseParameters(draft.parameters);
    const valid = validateParameters(template.body, sources);
    if (!valid.ok) return { ok: false, error: valid.error };

    if (requiresHeaderMedia(template.headerFormat) && !draft.headerMediaUrl) {
      return {
        ok: false,
        error: `"${template.name}" has a ${template.headerFormat?.toLowerCase()} header. Meta requires the file on every send, so this broadcast needs a public media URL.`,
      };
    }
    if (draft.headerMediaUrl && !/^(https:\/\/\S+|\d+)$/.test(draft.headerMediaUrl)) {
      return { ok: false, error: "The media must be a public https URL, or the id of media already uploaded to the account." };
    }

    // A pasted list becomes contacts before it becomes an audience. That is
    // what makes opt-out work for these numbers from here on.
    let waIds: string[] = [];
    if (draft.audience.kind === "list") {
      if (!draft.numbers?.trim()) return { ok: false, error: "No numbers were pasted for this broadcast." };
      const list = parseNumberList(draft.numbers, draft.countryCode);
      if (!list.valid.length) return { ok: false, error: `None of the ${list.invalid.length} line(s) in that list were usable phone numbers.` };
      waIds = await importContacts(list.valid);
    }

    const audience = {
      kind: draft.audience.kind,
      ...(draft.audience.kind === "list" ? { waIds } : {}),
      activeWithinDays: draft.audience.activeWithinDays,
      limit: draft.audience.limit,
    };

    const reach = await countAudience({ ...audience, waIds });
    if (reach === 0) {
      return {
        ok: false,
        error:
          draft.audience.kind === "list"
            ? "Every number on that list has opted out or is blocked, so there is nobody left to message."
            : "That audience matches nobody right now. Contacts who opted out or were blocked are always excluded.",
      };
    }

    const scheduledAt = draft.scheduledAt ? new Date(draft.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() < Date.now() - 60_000) {
      return { ok: false, error: "That time has already passed. Leave the schedule empty to send it by hand." };
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        reference: `BM-BCAST-${shortId(8)}`,
        status: scheduledAt ? "SCHEDULED" : "DRAFT",
        title: draft.title,
        body: previewBody(template.body, sources),
        audience,
        templateId: template.id,
        templateName: template.metaName,
        languageCode: template.languageCode,
        parameters: draft.parameters,
        headerMediaUrl: draft.headerMediaUrl || null,
        scheduledAt,
        createdBy: actorLabel(session),
      },
      select: { id: true, reference: true },
    });

    // Build the recipient list now rather than at send time: the number on
    // the confirm button should be the number of people who will be messaged.
    const prepared = await prepareBroadcast(broadcast.id);

    void logActivity({
      actor: actorLabel(session),
      action: "whatsapp.broadcast_created",
      entity: "broadcast",
      entityId: broadcast.id,
      detail: `"${draft.title}" to ${prepared.recipients} contacts via ${template.metaName}${scheduledAt ? `, scheduled for ${scheduledAt.toISOString()}` : ""}`,
    });
    revalidateBroadcasts();
    return { ok: true, id: broadcast.id, reference: broadcast.reference, recipients: prepared.recipients, scheduled: Boolean(scheduledAt) };
  } catch (error) {
    return { ok: false, error: failure(error, "The broadcast could not be created.") };
  }
}

/**
 * Start or resume a broadcast. The run continues after this action returns:
 * a few thousand recipients at a polite pace takes longer than any request,
 * so the action's job is to refuse a bad run, claim it, and hand off.
 * Progress is read from the database.
 */
export async function sendBroadcast(id: string, options: { refresh?: boolean } = {}): Promise<{ ok: boolean; pending?: number; error?: string }> {
  const session = await requireAdminAction("chatbot.manage");
  if (typeof id !== "string" || !id) return { ok: false, error: "Broadcast not found." };

  let claim: Awaited<ReturnType<typeof claimBroadcast>>;
  try {
    claim = await claimBroadcast(id, { refresh: options.refresh === true });
  } catch (error) {
    return { ok: false, error: failure(error, "The broadcast could not be started.") };
  }
  if (!claim.ok) return { ok: false, error: claim.error };

  void logActivity({
    actor: actorLabel(session),
    action: "whatsapp.broadcast_started",
    entity: "broadcast",
    entityId: id,
    detail: `${claim.pending} recipients`,
  });

  // Not awaited: the run outlives the request. `runBroadcastSafely` writes
  // its own failure to the row if it crashes.
  after(() => runBroadcastSafely(id));

  revalidateBroadcasts(id);
  return { ok: true, pending: claim.pending };
}

/** Take a scheduled broadcast off the clock. It stays as a draft that can be sent by hand. */
export async function unscheduleBroadcast(id: string): Promise<ActionResult> {
  const session = await requireAdminAction("chatbot.manage");
  try {
    const { count } = await prisma.broadcast.updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "DRAFT", scheduledAt: null } });
    if (count === 0) return { ok: false, error: "Only a scheduled broadcast can be unscheduled." };
  } catch (error) {
    return { ok: false, error: failure(error, "The schedule could not be removed.") };
  }
  void logActivity({ actor: actorLabel(session), action: "whatsapp.broadcast_unscheduled", entity: "broadcast", entityId: id });
  revalidateBroadcasts(id);
  return { ok: true, message: "Unscheduled. It is a draft again." };
}

/** Delete a broadcast that never messaged anyone. A sent broadcast is a record of messages real people received and stays. */
export async function deleteBroadcast(id: string): Promise<ActionResult> {
  const session = await requireAdminAction("chatbot.manage");
  try {
    const broadcast = await prisma.broadcast.findUnique({ where: { id }, select: { title: true, status: true, sent: true } });
    if (!broadcast) return { ok: false, error: "Broadcast not found." };
    if (broadcast.status === "SENDING" || broadcast.sent > 0) return { ok: false, error: "A broadcast that has messaged people cannot be deleted." };
    // Recipient rows go with it: the relation cascades.
    await prisma.broadcast.delete({ where: { id } });
    void logActivity({ actor: actorLabel(session), action: "whatsapp.broadcast_deleted", entity: "broadcast", entityId: id, detail: broadcast.title });
  } catch (error) {
    return { ok: false, error: failure(error, "The broadcast could not be deleted.") };
  }
  revalidateBroadcasts(id);
  return { ok: true, message: "Deleted." };
}
