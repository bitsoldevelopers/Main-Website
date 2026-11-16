import type { Prisma, WhatsappContact } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTemplate, type TemplateHeaderMedia } from "./client";
import { parseNumberList } from "./numbers";
import { getWhatsAppSettings } from "./settings";
import { countPlaceholders, renderTemplate } from "./templates";

/**
 * =============================================================================
 *  Broadcasts
 * =============================================================================
 *
 *  A broadcast is a Meta-approved template sent to an audience of WhatsApp
 *  contacts. Three rules shape everything below, and all three come from how
 *  the WhatsApp Cloud API behaves:
 *
 *   1. **Only an approved template may go out.** Every recipient of a
 *      broadcast is, by definition, outside the 24-hour customer service
 *      window, so free text is not an option: Meta drops it. The send refuses
 *      to start unless the template is APPROVED and carries a Meta id.
 *
 *   2. **A send is a long loop, not a request.** Thousands of recipients at a
 *      polite pace outlives any HTTP request, so the action claims the run and
 *      returns; progress lives in the database. `BroadcastRecipient` has a
 *      unique (broadcastId, waId), which is what makes a run interrupted by a
 *      redeploy safe to start again: already-sent rows are skipped rather than
 *      messaged twice.
 *
 *   3. **"Sent" and "delivered" are different facts.** Meta's `/messages` call
 *      returns as soon as it has accepted the message. Whether it arrived is
 *      answered minutes later on the webhook, keyed by the `wamid`, so the
 *      wamid is stored per recipient and `applyStatusUpdate` reconciles it.
 * =============================================================================
 */

/**
 * Pause between sends. Meta's throughput is comfortably above this; the
 * pacing keeps a broadcast from saturating outbound connections on a shared
 * host and starving the webhook, which must keep answering customers.
 */
const SEND_INTERVAL_MS = 250;

/** Recipients per broadcast run. A ceiling, not a target. */
export const MAX_RECIPIENTS = 5_000;

// -------------------------------------------------------------- Audience ----

/**
 * An audience is either a segment of the contacts this number knows, or an
 * explicit list of numbers someone pasted. They converge before anything is
 * sent: a pasted number becomes a `WhatsappContact` row like any other, so a
 * later STOP from that person is recorded against it and removes them from
 * every future broadcast.
 */
export interface AudienceFilter {
  /** `segment` (a query) or `list` (pasted numbers). Absent means segment. */
  kind?: "segment" | "list";
  /** For `list`: the numbers to message, already normalised to Meta's wa_id. */
  waIds?: string[];
  /**
   * Only contacts who messaged within this many days. Null means no limit.
   * Worth setting: a number that has been silent for a year is more likely to
   * report the message as spam, and the quality rating is per number.
   */
  activeWithinDays?: number | null;
  /** Hard cap on how many contacts the run will message. */
  limit?: number | null;
}

/**
 * The `where` clause behind every audience. Opted-out and blocked contacts
 * are excluded here rather than at send time, so the count shown in the
 * composer is the count that will be messaged.
 */
export function audienceWhere(filter: AudienceFilter): Prisma.WhatsappContactWhereInput {
  const where: Prisma.WhatsappContactWhereInput = { optedOut: false, isBlocked: false };

  // A pasted list is already the audience. It is still filtered by opt-out and
  // block above, but activity does not apply: the person chose these numbers.
  if (filter.kind === "list") {
    where.waId = { in: filter.waIds ?? [] };
    return where;
  }

  if (filter.activeWithinDays && filter.activeWithinDays > 0) {
    const since = new Date(Date.now() - filter.activeWithinDays * 24 * 60 * 60 * 1000);
    where.lastInboundAt = { gte: since };
  }

  return where;
}

function audienceTake(filter: AudienceFilter): number {
  return Math.min(filter.limit && filter.limit > 0 ? filter.limit : MAX_RECIPIENTS, MAX_RECIPIENTS);
}

/** How many contacts this filter currently matches. */
export async function countAudience(filter: AudienceFilter): Promise<number> {
  const matched = await prisma.whatsappContact.count({ where: audienceWhere(filter) });
  return Math.min(matched, audienceTake(filter));
}

/**
 * The contacts themselves, most recently active first. The order only matters
 * when a limit truncates the audience, and then it matters a lot: the people
 * who messaged last week are likelier to welcome the message than the ones
 * who went quiet a year ago.
 */
export async function resolveAudience(filter: AudienceFilter): Promise<WhatsappContact[]> {
  return prisma.whatsappContact.findMany({
    where: audienceWhere(filter),
    orderBy: [{ lastInboundAt: "desc" }, { createdAt: "desc" }],
    take: audienceTake(filter),
  });
}

/** The saved `audience` JSON as a filter, with every field defaulted. */
export function readAudience(value: unknown): AudienceFilter {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<AudienceFilter>;
  return {
    kind: raw.kind === "list" ? "list" : "segment",
    waIds: Array.isArray(raw.waIds) ? raw.waIds.filter((id): id is string => typeof id === "string") : [],
    activeWithinDays: typeof raw.activeWithinDays === "number" ? raw.activeWithinDays : null,
    limit: typeof raw.limit === "number" ? raw.limit : null,
  };
}

// ------------------------------------------------------- Pasted numbers ----

/**
 * Add a pasted list to the contact table, and return the wa_ids.
 *
 * `createMany` with `skipDuplicates` gives exactly the semantics wanted:
 * numbers this business has never seen become contacts, and numbers it
 * already knows are left completely alone. That second half matters: an
 * existing contact's WhatsApp profile name is better data than a name typed
 * into a spreadsheet, and a paste must never quietly clear someone's opt-out.
 */
export async function importContacts(entries: Array<{ waId: string; phone: string; name?: string }>): Promise<string[]> {
  if (!entries.length) return [];
  await prisma.whatsappContact.createMany({
    data: entries.map((entry) => ({ waId: entry.waId, phone: entry.phone, profileName: entry.name ?? null })),
    skipDuplicates: true,
  });
  return entries.map((entry) => entry.waId);
}

/** What the composer shows for a pasted list before anything is saved. */
export interface NumberListReport {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  optedOut: number;
  blocked: number;
  /** What will actually be messaged. */
  sendable: number;
  /** Already known to this number; the rest would be added as new contacts. */
  known: number;
  /** A few rejected lines, quoted back so the cause is obvious. */
  samples: Array<{ raw: string; reason: string }>;
  /** First few accepted numbers, to confirm the columns were read right. */
  preview: Array<{ phone: string; name: string | null }>;
}

/**
 * Parse a pasted list exactly as `createBroadcast` will, and report what it
 * found, so nobody discovers that half their file was a heading row after
 * committing to a send. Opt-outs are subtracted here and again at send time.
 */
export async function inspectNumberList(text: string, countryCode?: string): Promise<NumberListReport> {
  const outcome = parseNumberList(text, countryCode);
  const base = {
    total: outcome.valid.length + outcome.invalid.length + outcome.duplicates,
    valid: outcome.valid.length,
    invalid: outcome.invalid.length,
    duplicates: outcome.duplicates,
    samples: outcome.invalid.slice(0, 5),
  };
  if (!outcome.valid.length) return { ...base, optedOut: 0, blocked: 0, sendable: 0, known: 0, preview: [] };

  const existing = await prisma.whatsappContact.findMany({
    where: { waId: { in: outcome.valid.map((entry) => entry.waId) } },
    select: { waId: true, optedOut: true, isBlocked: true, profileName: true },
  });
  const byWaId = new Map(existing.map((contact) => [contact.waId, contact]));
  const optedOut = existing.filter((contact) => contact.optedOut).length;
  const blocked = existing.filter((contact) => contact.isBlocked && !contact.optedOut).length;

  return {
    ...base,
    optedOut,
    blocked,
    sendable: outcome.valid.length - optedOut - blocked,
    known: existing.length,
    preview: outcome.valid.slice(0, 5).map((entry) => ({
      phone: entry.phone,
      // A name already on file beats one from the spreadsheet: it came from
      // the person's own WhatsApp profile.
      name: byWaId.get(entry.waId)?.profileName ?? entry.name ?? null,
    })),
  };
}

// ------------------------------------------------------------ Parameters ----

/**
 * How one `{{n}}` gets filled for a given recipient. A small, closed set on
 * purpose: a template is approved with its placeholder count fixed, and every
 * source here resolves to a string for every contact with no lookup that can
 * fail mid-run.
 */
export type ParameterSource =
  | { kind: "static"; value: string }
  | { kind: "contactName"; fallback?: string }
  | { kind: "contactPhone" };

/** Validate whatever came off the wire into parameter sources. */
export function parseParameters(raw: unknown): ParameterSource[] {
  if (!Array.isArray(raw)) return [];
  const out: ParameterSource[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const kind = (entry as { kind?: unknown }).kind;
    if (kind === "static") {
      out.push({ kind: "static", value: String((entry as { value?: unknown }).value ?? "") });
    } else if (kind === "contactName") {
      const fallback = (entry as { fallback?: unknown }).fallback;
      out.push({ kind: "contactName", fallback: typeof fallback === "string" ? fallback : undefined });
    } else if (kind === "contactPhone") {
      out.push({ kind: "contactPhone" });
    }
  }
  return out;
}

/**
 * Resolve the parameter list for one contact. Never returns an empty slot:
 * Meta rejects a blank template parameter, and a contact with no WhatsApp
 * profile name is entirely normal, so `contactName` falls back to whatever
 * the composer set, and then to a neutral greeting rather than "Hi ,".
 */
export function fillParameters(sources: ParameterSource[], contact: Pick<WhatsappContact, "profileName" | "phone">): string[] {
  return sources.map((source) => {
    switch (source.kind) {
      case "static":
        return source.value.trim() || "-";
      case "contactName":
        return contact.profileName?.trim() || source.fallback?.trim() || "there";
      case "contactPhone":
        return contact.phone;
    }
  });
}

/**
 * Check the parameter list against the template before a single message goes
 * out. A count mismatch is Meta error #132000, and it fails per message, so a
 * misconfigured broadcast would otherwise burn through the whole audience
 * producing nothing but failures.
 */
export function validateParameters(body: string, sources: ParameterSource[]): { ok: true } | { ok: false; error: string } {
  const required = countPlaceholders(body);
  if (sources.length !== required) {
    return {
      ok: false,
      error:
        `This template takes ${required} parameter${required === 1 ? "" : "s"}, ` +
        `but ${sources.length} ${sources.length === 1 ? "was" : "were"} configured.`,
    };
  }
  return { ok: true };
}

/** A recipient's saved `parameters` JSON as the string array it holds. */
export function readStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? "")) : [];
}

// --------------------------------------------------------- Media headers ----

const MEDIA_HEADERS = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

/**
 * Whether this template's header is a file that has to be sent with it. Meta
 * approves the format of a media header, not the picture: the handle on the
 * template is only shown to the reviewer, so every send has to carry the
 * media again.
 */
export function requiresHeaderMedia(headerFormat: string | null): boolean {
  return Boolean(headerFormat && MEDIA_HEADERS.has(headerFormat.toUpperCase()));
}

/** Build the header argument for `sendTemplate`, or nothing when not needed. */
export function headerMediaFor(headerFormat: string | null, url: string | null): TemplateHeaderMedia | undefined {
  if (!requiresHeaderMedia(headerFormat) || !url?.trim()) return undefined;
  return { format: headerFormat!.toUpperCase() as TemplateHeaderMedia["format"], link: url.trim() };
}

/** The body a person would read, with a sample contact's values substituted. */
export function previewBody(body: string, sources: ParameterSource[]): string {
  return renderTemplate(body, fillParameters(sources, { profileName: "Ali", phone: "+923001234567" }));
}

// ------------------------------------------------------------- Materialise --

export interface PrepareOutcome {
  ok: boolean;
  recipients: number;
  error?: string;
}

/**
 * Write one recipient row per contact in the audience. `createMany` with
 * `skipDuplicates` leans on the unique (broadcastId, waId): re-preparing a
 * broadcast adds contacts who joined the audience since and touches nobody
 * already on the list, so a scheduled run picked up twice cannot
 * double-message anyone.
 */
export async function prepareBroadcast(broadcastId: string): Promise<PrepareOutcome> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId }, include: { template: true } });
  if (!broadcast) return { ok: false, recipients: 0, error: "Broadcast not found." };
  if (!broadcast.template) return { ok: false, recipients: 0, error: "This broadcast has no template attached." };

  const contacts = await resolveAudience(readAudience(broadcast.audience));
  const sources = parseParameters(broadcast.parameters);

  if (contacts.length) {
    await prisma.broadcastRecipient.createMany({
      data: contacts.map((contact) => ({
        broadcastId,
        contactId: contact.id,
        waId: contact.waId,
        phone: contact.phone,
        name: contact.profileName,
        parameters: fillParameters(sources, contact),
      })),
      skipDuplicates: true,
    });
  }

  const recipients = await prisma.broadcastRecipient.count({ where: { broadcastId } });
  await prisma.broadcast.update({ where: { id: broadcastId }, data: { recipients } });
  return { ok: true, recipients };
}

// ----------------------------------------------------------------- Claim ----

export interface ClaimOutcome {
  ok: boolean;
  /** Recipients the run will message. */
  pending: number;
  error?: string;
}

/**
 * Check a broadcast can go out and claim the run atomically. Checking the
 * status and then setting it would leave a window in which two clicks both
 * pass, and both runs would read the same PENDING rows and message half the
 * audience twice. The conditional update closes it: exactly one caller can
 * move the row out of its current status.
 */
export async function claimBroadcast(broadcastId: string, options: { refresh?: boolean } = {}): Promise<ClaimOutcome> {
  const settings = await getWhatsAppSettings({ fresh: true });
  if (!settings.enabled) {
    return { ok: false, pending: 0, error: "WhatsApp is not connected: add the phone number ID and access token under Admin → Chatbot → Setup." };
  }

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { template: { select: { name: true, status: true, metaId: true } } },
  });
  if (!broadcast) return { ok: false, pending: 0, error: "Broadcast not found." };
  if (broadcast.status === "SENDING") return { ok: false, pending: 0, error: "This broadcast is already sending." };
  if (broadcast.status === "SENT" && broadcast.failed === 0) return { ok: false, pending: 0, error: "This broadcast has already been sent." };
  if (!broadcast.template) return { ok: false, pending: 0, error: "This broadcast has no template attached." };
  if (broadcast.template.status !== "APPROVED" || !broadcast.template.metaId) {
    return {
      ok: false,
      pending: 0,
      error: `"${broadcast.template.name}" is ${broadcast.template.status.toLowerCase()} in Meta. Sync templates and try again once it is approved.`,
    };
  }

  if (options.refresh) {
    const prepared = await prepareBroadcast(broadcastId);
    if (!prepared.ok) return { ok: false, pending: 0, error: prepared.error ?? "Could not build the audience." };
  }

  const pending = await prisma.broadcastRecipient.count({ where: { broadcastId, status: { in: ["PENDING", "FAILED"] } } });
  if (pending === 0) return { ok: false, pending: 0, error: "Every recipient on this broadcast has already been messaged." };

  const { count } = await prisma.broadcast.updateMany({
    where: { id: broadcastId, status: { not: "SENDING" } },
    data: { status: "SENDING", startedAt: broadcast.startedAt ?? new Date(), error: null },
  });
  if (count === 0) return { ok: false, pending: 0, error: "This broadcast is already sending." };

  return { ok: true, pending };
}

/**
 * Claim every scheduled broadcast whose time has come. Called from the cron
 * route; the caller runs the returned ids one after another.
 */
export async function claimDueBroadcasts(now = new Date()): Promise<string[]> {
  const due = await prisma.broadcast.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
    orderBy: { scheduledAt: "asc" },
    take: 10,
  });
  const claimed: string[] = [];
  for (const { id } of due) {
    const outcome = await claimBroadcast(id, { refresh: true });
    if (outcome.ok) {
      claimed.push(id);
    } else {
      // A scheduled broadcast that cannot go out must not stay scheduled
      // forever: it fails with the reason, and someone can retry it by hand.
      await prisma.broadcast
        .updateMany({ where: { id, status: "SCHEDULED" }, data: { status: "FAILED", error: outcome.error ?? "Could not start." } })
        .catch(() => undefined);
    }
  }
  return claimed;
}

// ------------------------------------------------------------------ Send ----

export interface RunOutcome {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
}

/**
 * Send a claimed broadcast. Long-running by design: it walks the pending
 * recipients one at a time with a pause between each. Callers start it and
 * let it go; the database is the progress report.
 *
 * Safe to call again on a broadcast that died half-way. Only PENDING and
 * FAILED rows are picked up, so a resumed run continues where it stopped.
 */
export async function runBroadcast(broadcastId: string): Promise<RunOutcome> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId }, include: { template: true } });
  if (!broadcast) return { ok: false, sent: 0, failed: 0, error: "Broadcast not found." };

  const failRun = async (error: string): Promise<RunOutcome> => {
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: "FAILED", error } });
    return { ok: false, sent: 0, failed: 0, error };
  };

  const settings = await getWhatsAppSettings({ fresh: true });
  if (!settings.enabled) return failRun("WhatsApp is not connected: add the phone number ID and access token under Admin → Chatbot → Setup.");

  const template = broadcast.template;
  if (!template) return failRun("This broadcast has no template attached.");
  if (template.status !== "APPROVED" || !template.metaId) {
    return failRun(`Template "${template.name}" is ${template.status.toLowerCase()} in Meta. Only an approved template can be broadcast.`);
  }

  const sources = parseParameters(broadcast.parameters);
  const valid = validateParameters(template.body, sources);
  if (!valid.ok) return failRun(valid.error);

  // Checked once, before the loop: a missing media header fails every single
  // message, so discovering it on recipient one beats recipient five thousand.
  const headerMedia = headerMediaFor(template.headerFormat, broadcast.headerMediaUrl);
  if (requiresHeaderMedia(template.headerFormat) && !headerMedia) {
    return failRun(
      `"${template.name}" has a ${template.headerFormat?.toLowerCase()} header, which Meta requires on every send. Add the media URL to this broadcast and try again.`
    );
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      status: "SENDING",
      startedAt: broadcast.startedAt ?? new Date(),
      error: null,
      templateName: template.metaName,
      languageCode: template.languageCode,
    },
  });

  let sent = 0;
  let failed = 0;

  // Paged rather than loaded whole: a five-thousand-recipient audience should
  // not sit in memory for the length of the run.
  for (;;) {
    const batch = await prisma.broadcastRecipient.findMany({
      where: { broadcastId, status: { in: ["PENDING", "FAILED"] } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    if (!batch.length) break;

    for (const recipient of batch) {
      const result = await sendTemplate(
        recipient.waId,
        template.metaName,
        template.languageCode,
        readStrings(recipient.parameters),
        headerMedia ? { media: headerMedia } : undefined
      );

      if (result.ok) {
        sent++;
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: "SENT", messageId: result.messageId ?? null, sentAt: new Date(), error: null },
        });
        if (recipient.contactId) {
          await prisma.whatsappContact
            .update({ where: { id: recipient.contactId }, data: { lastOutboundAt: new Date() } })
            .catch(() => undefined);
        }
      } else {
        failed++;
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: "FAILED", error: result.error?.slice(0, 500) ?? "Send failed." },
        });
      }

      await pause(SEND_INTERVAL_MS);
    }

    // Publish progress once per batch: a broadcast to a few thousand people
    // takes long enough that a page showing zero until the end reads as hung.
    await refreshCounters(broadcastId);

    // A batch where nothing was accepted means the number, the token or the
    // template is broken, not that a hundred people are individually
    // unreachable. Stopping keeps a bad configuration from working its way
    // through the entire audience.
    if (batch.length >= 20 && sent === 0) {
      return failRun("Stopped after the first batch: Meta rejected every message. Check the template's approval status and the number's quality rating.");
    }
  }

  await refreshCounters(broadcastId);

  const total = sent + failed;
  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      // A run in which nothing at all was accepted is a failure, not a send.
      status: total > 0 && sent === 0 ? "FAILED" : "SENT",
      sentAt: new Date(),
      error: total > 0 && sent === 0 ? "Meta rejected every message in this broadcast." : null,
    },
  });

  return { ok: sent > 0 || total === 0, sent, failed };
}

/** Run a claimed broadcast and record a crash on the row rather than losing it. */
export async function runBroadcastSafely(broadcastId: string): Promise<void> {
  try {
    await runBroadcast(broadcastId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[broadcast] run crashed:", message);
    await prisma.broadcast
      .update({ where: { id: broadcastId }, data: { status: "FAILED", error: message.slice(0, 500) } })
      .catch(() => undefined);
  }
}

/** Recount the summary columns from the recipient rows they summarise. */
export async function refreshCounters(broadcastId: string): Promise<void> {
  const grouped = await prisma.broadcastRecipient.groupBy({ by: ["status"], where: { broadcastId }, _count: { _all: true } });
  const count = (status: string) => grouped.find((row) => row.status === status)?._count._all ?? 0;
  const delivered = count("DELIVERED");
  const read = count("READ");

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      recipients: grouped.reduce((total, row) => total + row._count._all, 0),
      // Anything Meta accepted counts as sent, whatever happened to it after.
      sent: count("SENT") + delivered + read,
      // A read message was necessarily delivered; Meta does not re-send the
      // delivered receipt once it has sent the read one.
      delivered: delivered + read,
      readCount: read,
      failed: count("FAILED"),
    },
  });
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------- Delivery receipts --

const STATUS_RANK: Record<string, number> = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };

/**
 * Apply one of Meta's delivery receipts to the recipient it belongs to.
 *
 * Called from the webhook for every status Meta sends. Most belong to
 * ordinary assistant replies rather than to a broadcast, so a miss is the
 * common case and costs one indexed lookup on a unique column. Receipts
 * arrive out of order (a `read` can land before its `delivered`), so status
 * only ever moves forward. Never throws: a receipt must not break the webhook.
 */
export async function applyStatusUpdate(messageId: string, status: "sent" | "delivered" | "read" | "failed", error?: string): Promise<void> {
  try {
    const recipient = await prisma.broadcastRecipient.findUnique({
      where: { messageId },
      select: { id: true, broadcastId: true, status: true },
    });
    // Not a broadcast message: an assistant reply, almost always.
    if (!recipient) return;

    const now = new Date();
    if (status === "failed") {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: { status: "FAILED", error: error?.slice(0, 500) ?? "Delivery failed." },
      });
    } else {
      const next = status.toUpperCase() as "SENT" | "DELIVERED" | "READ";
      if ((STATUS_RANK[next] ?? 0) <= (STATUS_RANK[recipient.status] ?? 0)) return;
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status: next,
          ...(next === "DELIVERED" ? { deliveredAt: now } : {}),
          // A read receipt implies delivery, and Meta will not send the
          // delivered receipt separately once it has sent this one.
          ...(next === "READ" ? { readAt: now, deliveredAt: now } : {}),
        },
      });
    }

    await refreshCounters(recipient.broadcastId);
  } catch (caught) {
    console.warn("[broadcast] could not record a delivery receipt:", caught instanceof Error ? caught.message : caught);
  }
}
