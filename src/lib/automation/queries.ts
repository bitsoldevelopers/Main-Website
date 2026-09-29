import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { leadSourceLabel } from "@/lib/admin/leads";
import { PAGE_SIZE, safe, type Paged, type Result } from "@/lib/admin/queries";
import { isCryptoConfigured } from "./crypto";
import { ensureDefaults } from "./defaults";
import { getEmailProvider, isTestMode } from "./email/provider";
import { GOOGLE_ENV, isGoogleConfigured } from "./google/client";
import { isPersonalizerConfigured } from "./personalize";
import { isSchedulerRunning } from "./scheduler";
import { getOutreachSettings, senderProblems, type OutreachSettings } from "./settings";
import { lastTick, type TickReport } from "./worker";

/**
 * Read side of the automation area. Same contract as the rest of the admin:
 * every query is wrapped in `safe`, so a database outage renders a panel
 * instead of crashing the page.
 */

const DAY = 86_400_000;

// ─── Setup status ───────────────────────────────────────────────────────────

export interface SetupItem {
  key: string;
  label: string;
  done: boolean;
  detail: string;
  href?: string;
  /** Without it nothing can be sent or imported; the rest are improvements. */
  required: boolean;
}

export interface SetupStatus {
  items: SetupItem[];
  ready: boolean;
  testMode: boolean;
  settings: OutreachSettings;
}

export function getSetupStatus(): Promise<Result<SetupStatus>> {
  return safe(async () => {
    const [settings, connections, activeAutomations] = await Promise.all([
      getOutreachSettings(),
      prisma.googleSheetConnection.count({ where: { status: "ACTIVE" } }),
      prisma.automation.count({ where: { status: "ACTIVE" } }),
    ]);
    const provider = getEmailProvider();
    const problems = senderProblems(settings);
    const has = (key: string) => Boolean(process.env[key]);

    const items: SetupItem[] = [
      {
        key: "provider",
        label: "Email provider",
        done: provider.isConfigured(),
        detail: isTestMode()
          ? "Test mode: emails are recorded but not delivered (OUTREACH_EMAIL_MODE=test)."
          : provider.isConfigured()
            ? "Resend is configured (RESEND_API_KEY)."
            : provider.setupHint,
        required: true,
      },
      {
        key: "sender",
        label: "Sender details",
        done: problems.length === 0,
        detail: problems[0] ?? `Sending as ${settings.fromName} <${settings.fromEmail}>.`,
        href: "/admin/automation/settings",
        required: true,
      },
      {
        key: "automation",
        label: "An active automation",
        done: activeAutomations > 0,
        detail:
          activeAutomations > 0
            ? `${activeAutomations} automation${activeAutomations === 1 ? " is" : "s are"} active.`
            : "Review the emails, then activate an automation. Nothing is sent before that.",
        href: "/admin/automation/automations",
        required: true,
      },
      {
        key: "google",
        label: "Google Sheets",
        done: isGoogleConfigured() && connections > 0,
        detail: !isGoogleConfigured()
          ? `Set ${GOOGLE_ENV.filter((k) => !has(k)).join(" and ")} on the server. CSV upload works without it.`
          : connections > 0
            ? `${connections} Google account${connections === 1 ? "" : "s"} connected.`
            : "Credentials are set; connect a Google account.",
        href: "/admin/automation/sources/google-sheets",
        required: false,
      },
      {
        key: "webhook",
        label: "Delivery and reply tracking",
        done: has("RESEND_WEBHOOK_SECRET"),
        detail: has("RESEND_WEBHOOK_SECRET")
          ? "The Resend webhook is signed and accepted."
          : "Set RESEND_WEBHOOK_SECRET and add the webhook in Resend. Until then bounces, opens and replies are not detected; mark replies by hand.",
        required: false,
      },
      {
        key: "cron",
        label: "Scheduler",
        done: isSchedulerRunning() || has("AUTOMATION_CRON_SECRET"),
        detail: has("AUTOMATION_CRON_SECRET")
          ? `Cron endpoint enabled${isSchedulerRunning() ? "; the in-process scheduler is running too" : ""}.`
          : isSchedulerRunning()
            ? "The in-process scheduler is running. Add a host cron job (AUTOMATION_CRON_SECRET) so follow-ups still go out if the app was idle."
            : "Neither the in-process scheduler nor the cron endpoint is active.",
        required: false,
      },
      {
        key: "secret",
        label: "Encryption key",
        done: isCryptoConfigured(),
        detail: has("AUTOMATION_SECRET")
          ? "AUTOMATION_SECRET is set."
          : has("ADMIN_SECRET")
            ? "Using ADMIN_SECRET. A separate AUTOMATION_SECRET keeps unsubscribe links valid if the admin password changes."
            : "Set AUTOMATION_SECRET on the server.",
        required: true,
      },
    ];
    return { items, ready: items.filter((i) => i.required).every((i) => i.done), testMode: isTestMode(), settings };
  });
}

// ─── Overview ───────────────────────────────────────────────────────────────

export interface Overview {
  kpis: {
    prospects: number;
    ready: number;
    inAutomation: number;
    sent30: number;
    sent7: number;
    replied30: number;
    replyRate: number | null;
    bounced30: number;
    unsubscribed30: number;
    openTasks: number;
    overdueTasks: number;
    followUps7: number;
  };
  funnel: { label: string; value: number; hint: string }[];
  daily: { date: string; label: string; sent: number; replied: number }[];
  bySource: { label: string; value: number }[];
  queue: { pending: number; failed: number; nextRunAt: Date | null };
  lastTick: TickReport | null;
  schedulerRunning: boolean;
  recentImports: ImportRow[];
}

const KARACHI = "Asia/Karachi";

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: KARACHI, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function getOverview(): Promise<Result<Overview>> {
  return safe(async () => {
    await ensureDefaults();
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * DAY);
    const since7 = new Date(now.getTime() - 7 * DAY);
    const since14 = new Date(now.getTime() - 14 * DAY);
    const imported: Prisma.LeadWhereInput = { source: { in: ["google_sheets", "csv"] } };

    const [
      prospects,
      statusGroups,
      inAutomation,
      sent30,
      sent7,
      replied30,
      bounced30,
      unsubscribed30,
      openTasks,
      overdueTasks,
      followUps7,
      recentMessages,
      replyEvents,
      sourceGroups,
      pending,
      failed,
      nextJob,
      recentImports,
    ] = await Promise.all([
      prisma.lead.count({ where: imported }),
      prisma.lead.groupBy({ by: ["status"], where: imported, _count: { _all: true } }),
      prisma.automationRun.count({ where: { status: "ACTIVE" } }),
      prisma.emailMessage.count({ where: { sentAt: { gte: since30 } } }),
      prisma.emailMessage.count({ where: { sentAt: { gte: since7 } } }),
      prisma.emailMessage.count({ where: { repliedAt: { gte: since30 } } }),
      prisma.emailMessage.count({ where: { bouncedAt: { gte: since30 } } }),
      prisma.suppressionEntry.count({ where: { reason: { in: ["UNSUBSCRIBED", "COMPLAINED"] }, createdAt: { gte: since30 } } }),
      prisma.task.count({ where: { status: "OPEN" } }),
      prisma.task.count({ where: { status: "OPEN", dueAt: { lt: now } } }),
      prisma.followUp.count({ where: { status: "SCHEDULED", type: "EMAIL", dueAt: { lte: new Date(now.getTime() + 7 * DAY) } } }),
      prisma.emailMessage.findMany({ where: { sentAt: { gte: since14 } }, select: { sentAt: true } }),
      prisma.emailMessage.findMany({ where: { repliedAt: { gte: since14 } }, select: { repliedAt: true } }),
      prisma.lead.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } } }),
      prisma.automationJob.count({ where: { status: "PENDING" } }),
      prisma.automationJob.count({ where: { status: "FAILED" } }),
      prisma.automationJob.findFirst({ where: { status: "PENDING" }, orderBy: { runAt: "asc" }, select: { runAt: true } }),
      prisma.leadImport.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: importSelect }),
    ]);

    const byStatus = new Map(statusGroups.map((g) => [g.status, g._count._all]));
    const sum = (...statuses: string[]) => statuses.reduce((total, s) => total + (byStatus.get(s) ?? 0), 0);
    const emailed = sum("EMAIL_SENT", "FOLLOW_UP", "REPLIED", "CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED");
    const replied = sum("REPLIED", "CONTACTED", "QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "NEGOTIATION", "WON");
    const qualified = sum("QUALIFIED", "MEETING_SCHEDULED", "PROPOSAL", "NEGOTIATION", "WON");

    const days: Overview["daily"] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(now.getTime() - i * DAY);
      days.push({
        date: dayKey(date),
        label: new Intl.DateTimeFormat("en-US", { timeZone: KARACHI, month: "short", day: "numeric" }).format(date),
        sent: 0,
        replied: 0,
      });
    }
    const byDay = new Map(days.map((d) => [d.date, d]));
    for (const m of recentMessages) {
      const bucket = m.sentAt && byDay.get(dayKey(m.sentAt));
      if (bucket) bucket.sent++;
    }
    for (const m of replyEvents) {
      const bucket = m.repliedAt && byDay.get(dayKey(m.repliedAt));
      if (bucket) bucket.replied++;
    }

    return {
      kpis: {
        prospects,
        ready: byStatus.get("READY_FOR_OUTREACH") ?? 0,
        inAutomation,
        sent30,
        sent7,
        replied30,
        replyRate: sent30 > 0 ? replied30 / sent30 : null,
        bounced30,
        unsubscribed30,
        openTasks,
        overdueTasks,
        followUps7,
      },
      funnel: [
        { label: "Imported", value: prospects, hint: "Leads that came from Google Sheets or a CSV" },
        { label: "Emailed", value: emailed, hint: "Received at least the first email" },
        { label: "Replied", value: replied, hint: "Answered, or moved on to a conversation" },
        { label: "Qualified", value: qualified, hint: "Qualified, meeting, proposal, negotiation or won" },
        { label: "Won", value: byStatus.get("WON") ?? 0, hint: "Signed" },
      ],
      daily: days,
      bySource: sourceGroups.map((g) => ({ label: leadSourceLabel(g.source), value: g._count._all })),
      queue: { pending, failed, nextRunAt: nextJob?.runAt ?? null },
      lastTick: lastTick() ?? null,
      schedulerRunning: isSchedulerRunning(),
      recentImports,
    };
  });
}

// ─── Sources and imports ────────────────────────────────────────────────────

const importSelect = {
  id: true,
  sourceType: true,
  label: true,
  trigger: true,
  status: true,
  totalRows: true,
  createdCount: true,
  updatedCount: true,
  duplicateCount: true,
  invalidCount: true,
  skippedCount: true,
  failedCount: true,
  automationStarted: true,
  error: true,
  startedBy: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
  worksheetId: true,
} satisfies Prisma.LeadImportSelect;

export type ImportRow = Prisma.LeadImportGetPayload<{ select: typeof importSelect }>;

export interface SourceSummary {
  type: string;
  leads: number;
  lastLeadAt: Date | null;
  sources: { id: string; name: string; leads: number; createdAt: Date }[];
}

export function listSources(): Promise<Result<SourceSummary[]>> {
  return safe(async () => {
    const [groups, registered] = await Promise.all([
      prisma.lead.groupBy({ by: ["source"], _count: { _all: true }, _max: { createdAt: true } }),
      prisma.leadSource.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { leads: true } } } }),
    ]);
    const types = new Set([...groups.map((g) => g.source), ...registered.map((s) => s.type)]);
    return [...types].map((type) => {
      const group = groups.find((g) => g.source === type);
      return {
        type,
        leads: group?._count._all ?? 0,
        lastLeadAt: group?._max.createdAt ?? null,
        sources: registered.filter((s) => s.type === type).map((s) => ({ id: s.id, name: s.name, leads: s._count.leads, createdAt: s.createdAt })),
      };
    });
  });
}

const worksheetInclude = {
  connection: { select: { googleEmail: true, status: true } },
  imports: { orderBy: { createdAt: "desc" }, take: 1, select: importSelect },
  _count: { select: { rows: true } },
} satisfies Prisma.GoogleSheetWorksheetInclude;

export type WorksheetRow = Prisma.GoogleSheetWorksheetGetPayload<{ include: typeof worksheetInclude }>;

export interface GoogleSheetsState {
  configured: boolean;
  missingEnv: string[];
  cryptoReady: boolean;
  connections: { id: string; googleEmail: string; displayName: string | null; status: string; lastError: string | null; connectedBy: string; createdAt: Date; worksheets: number }[];
  worksheets: WorksheetRow[];
}

export function getGoogleSheetsState(): Promise<Result<GoogleSheetsState>> {
  return safe(async () => {
    const [connections, worksheets] = await Promise.all([
      prisma.googleSheetConnection.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, googleEmail: true, displayName: true, status: true, lastError: true, connectedBy: true, createdAt: true, _count: { select: { worksheets: true } } },
      }),
      prisma.googleSheetWorksheet.findMany({ orderBy: { createdAt: "desc" }, include: worksheetInclude }),
    ]);
    return {
      configured: isGoogleConfigured(),
      missingEnv: GOOGLE_ENV.filter((key) => !process.env[key]),
      cryptoReady: isCryptoConfigured(),
      connections: connections.map(({ _count, ...c }) => ({ ...c, worksheets: _count.worksheets })),
      worksheets,
    };
  });
}

export function listImports(filters: { page: number; source?: string }): Promise<Result<Paged<ImportRow>>> {
  return safe(async () => {
    const where: Prisma.LeadImportWhereInput = filters.source ? { sourceType: filters.source } : {};
    const [items, total] = await Promise.all([
      prisma.leadImport.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: importSelect }),
      prisma.leadImport.count({ where }),
    ]);
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

const importRowSelect = {
  id: true,
  rowNumber: true,
  outcome: true,
  matchLevel: true,
  message: true,
  raw: true,
  leadId: true,
  lastSyncedAt: true,
  lead: { select: { id: true, name: true, company: true } },
} satisfies Prisma.LeadImportRowSelect;

export type ImportRowDetail = Prisma.LeadImportRowGetPayload<{ select: typeof importRowSelect }>;

export interface ImportDetail {
  batch: ImportRow & { quality: Prisma.JsonValue | null; settings: Prisma.JsonValue };
  outcomes: Record<string, number>;
  rows: Paged<ImportRowDetail>;
}

export function getImport(id: string, filters: { page: number; outcome?: string }): Promise<Result<ImportDetail | null>> {
  return safe(async () => {
    const batch = await prisma.leadImport.findUnique({ where: { id }, select: { ...importSelect, quality: true, settings: true } });
    if (!batch) return null;
    const where: Prisma.LeadImportRowWhereInput = {
      importId: id,
      ...(filters.outcome === "problems"
        ? { outcome: { in: ["INVALID", "FAILED", "DUPLICATE", "REVIEW"] } }
        : filters.outcome
          ? { outcome: filters.outcome }
          : {}),
    };
    const size = 50;
    const [items, total, groups] = await Promise.all([
      prisma.leadImportRow.findMany({ where, orderBy: { rowNumber: "asc" }, skip: (filters.page - 1) * size, take: size, select: importRowSelect }),
      prisma.leadImportRow.count({ where }),
      prisma.leadImportRow.groupBy({ by: ["outcome"], where: { importId: id }, _count: { _all: true } }),
    ]);
    return {
      batch,
      outcomes: Object.fromEntries(groups.map((g) => [g.outcome, g._count._all])),
      rows: { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / size)) },
    };
  });
}

// ─── Automations, sequences, templates ──────────────────────────────────────

const automationListInclude = {
  sequence: { select: { id: true, name: true, _count: { select: { steps: true } } } },
  _count: { select: { runs: true, steps: true } },
} satisfies Prisma.AutomationInclude;

export type AutomationRow = Prisma.AutomationGetPayload<{ include: typeof automationListInclude }> & {
  active: number;
  completed: number;
  replied: number;
  sent: number;
};

async function runStats(automationIds: string[]) {
  if (automationIds.length === 0) return new Map<string, { active: number; completed: number; replied: number; sent: number }>();
  const [byStatus, byReason, sent] = await Promise.all([
    prisma.automationRun.groupBy({ by: ["automationId", "status"], where: { automationId: { in: automationIds } }, _count: { _all: true } }),
    prisma.automationRun.groupBy({ by: ["automationId"], where: { automationId: { in: automationIds }, stopReason: "REPLIED" }, _count: { _all: true } }),
    prisma.automationRun.groupBy({ by: ["automationId"], where: { automationId: { in: automationIds } }, _sum: { emailsSent: true } }),
  ]);
  const stats = new Map(automationIds.map((id) => [id, { active: 0, completed: 0, replied: 0, sent: 0 }]));
  for (const g of byStatus) {
    const s = stats.get(g.automationId);
    if (!s) continue;
    if (g.status === "ACTIVE" || g.status === "PAUSED") s.active += g._count._all;
    if (g.status === "COMPLETED") s.completed += g._count._all;
  }
  for (const g of byReason) {
    const s = stats.get(g.automationId);
    if (s) s.replied = g._count._all;
  }
  for (const g of sent) {
    const s = stats.get(g.automationId);
    if (s) s.sent = g._sum.emailsSent ?? 0;
  }
  return stats;
}

export function listAutomations(): Promise<Result<AutomationRow[]>> {
  return safe(async () => {
    await ensureDefaults();
    const automations = await prisma.automation.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], include: automationListInclude });
    const stats = await runStats(automations.map((a) => a.id));
    return automations.map((a) => ({ ...a, ...(stats.get(a.id) ?? { active: 0, completed: 0, replied: 0, sent: 0 }) }));
  });
}

/** Automations a lead can be enrolled in right now, for the pickers. */
export function listActiveAutomations(): Promise<Result<{ id: string; name: string; status: string }[]>> {
  return safe(async () => {
    await ensureDefaults();
    return prisma.automation.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }], select: { id: true, name: true, status: true } });
  });
}

const automationInclude = {
  sequence: { include: { steps: { orderBy: { order: "asc" }, include: { template: { select: { id: true, name: true, subject: true } } } } } },
  steps: { orderBy: { order: "asc" }, include: { sequenceStep: { include: { template: { select: { id: true, name: true, subject: true } } } } } },
  conditions: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.AutomationInclude;

const runSelect = {
  id: true,
  status: true,
  stepIndex: true,
  nextRunAt: true,
  stopReason: true,
  emailsSent: true,
  startedBy: true,
  startedAt: true,
  finishedAt: true,
  lead: { select: { id: true, name: true, company: true, outreachEmail: true, status: true } },
} satisfies Prisma.AutomationRunSelect;

export type RunRow = Prisma.AutomationRunGetPayload<{ select: typeof runSelect }>;

export interface AutomationDetail {
  automation: Prisma.AutomationGetPayload<{ include: typeof automationInclude }>;
  stats: { active: number; paused: number; completed: number; stopped: number; failed: number; replied: number; sent: number; total: number };
  stopReasons: { reason: string; count: number }[];
  runs: Paged<RunRow>;
}

export function getAutomation(id: string, filters: { page: number; status?: string }): Promise<Result<AutomationDetail | null>> {
  return safe(async () => {
    const automation = await prisma.automation.findUnique({ where: { id }, include: automationInclude });
    if (!automation) return null;
    const where: Prisma.AutomationRunWhereInput = { automationId: id, ...(filters.status ? { status: filters.status } : {}) };
    const [byStatus, byReason, sent, runs, total] = await Promise.all([
      prisma.automationRun.groupBy({ by: ["status"], where: { automationId: id }, _count: { _all: true } }),
      prisma.automationRun.groupBy({ by: ["stopReason"], where: { automationId: id, stopReason: { not: null } }, _count: { _all: true } }),
      prisma.automationRun.aggregate({ where: { automationId: id }, _sum: { emailsSent: true } }),
      prisma.automationRun.findMany({ where, orderBy: { startedAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: runSelect }),
      prisma.automationRun.count({ where }),
    ]);
    const count = (status: string) => byStatus.find((g) => g.status === status)?._count._all ?? 0;
    return {
      automation,
      stats: {
        active: count("ACTIVE"),
        paused: count("PAUSED"),
        completed: count("COMPLETED"),
        stopped: count("STOPPED"),
        failed: count("FAILED"),
        replied: byReason.find((g) => g.stopReason === "REPLIED")?._count._all ?? 0,
        sent: sent._sum.emailsSent ?? 0,
        total: byStatus.reduce((n, g) => n + g._count._all, 0),
      },
      stopReasons: byReason.map((g) => ({ reason: g.stopReason ?? "", count: g._count._all })).sort((a, b) => b.count - a.count),
      runs: { items: runs, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) },
    };
  });
}

const sequenceInclude = {
  steps: { orderBy: { order: "asc" }, include: { template: { select: { id: true, name: true, subject: true } } } },
  automations: { select: { id: true, name: true, status: true } },
} satisfies Prisma.EmailSequenceInclude;

export type SequenceRow = Prisma.EmailSequenceGetPayload<{ include: typeof sequenceInclude }>;

export function listSequences(): Promise<Result<SequenceRow[]>> {
  return safe(async () => {
    await ensureDefaults();
    return prisma.emailSequence.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], include: sequenceInclude });
  });
}

export function getSequence(id: string): Promise<Result<SequenceRow | null>> {
  return safe(() => prisma.emailSequence.findUnique({ where: { id }, include: sequenceInclude }));
}

const templateInclude = {
  steps: { select: { id: true, name: true, sequence: { select: { id: true, name: true } } } },
  _count: { select: { messages: true } },
} satisfies Prisma.EmailTemplateInclude;

export type TemplateRow = Prisma.EmailTemplateGetPayload<{ include: typeof templateInclude }>;

export function listTemplates(): Promise<Result<TemplateRow[]>> {
  return safe(async () => {
    await ensureDefaults();
    return prisma.emailTemplate.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }], include: templateInclude });
  });
}

export function getTemplate(id: string): Promise<Result<TemplateRow | null>> {
  return safe(() => prisma.emailTemplate.findUnique({ where: { id }, include: templateInclude }));
}

// ─── Follow-ups and tasks ───────────────────────────────────────────────────

const followUpSelect = {
  id: true,
  type: true,
  title: true,
  dueAt: true,
  status: true,
  lead: { select: { id: true, name: true, company: true, outreachEmail: true } },
  run: { select: { id: true, status: true, automation: { select: { id: true, name: true } } } },
} satisfies Prisma.FollowUpSelect;

const taskSelect = {
  id: true,
  title: true,
  description: true,
  dueAt: true,
  status: true,
  priority: true,
  source: true,
  createdBy: true,
  createdAt: true,
  completedAt: true,
  lead: { select: { id: true, name: true, company: true, phone: true, linkedinUrl: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TaskSelect;

export type FollowUpRow = Prisma.FollowUpGetPayload<{ select: typeof followUpSelect }>;
export type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export interface FollowUpsData {
  scheduled: FollowUpRow[];
  scheduledTotal: number;
  tasks: TaskRow[];
  taskCounts: { open: number; overdue: number; done: number };
}

export function getFollowUps(filters: { tasks: string }): Promise<Result<FollowUpsData>> {
  return safe(async () => {
    const now = new Date();
    const taskWhere: Prisma.TaskWhereInput =
      filters.tasks === "done" ? { status: "DONE" } : filters.tasks === "overdue" ? { status: "OPEN", dueAt: { lt: now } } : { status: "OPEN" };
    const [scheduled, scheduledTotal, tasks, open, overdue, done] = await Promise.all([
      prisma.followUp.findMany({ where: { status: "SCHEDULED", type: "EMAIL" }, orderBy: { dueAt: "asc" }, take: 100, select: followUpSelect }),
      prisma.followUp.count({ where: { status: "SCHEDULED", type: "EMAIL" } }),
      prisma.task.findMany({
        where: taskWhere,
        orderBy: filters.tasks === "done" ? { completedAt: "desc" } : [{ dueAt: "asc" }, { createdAt: "asc" }],
        take: 100,
        select: taskSelect,
      }),
      prisma.task.count({ where: { status: "OPEN" } }),
      prisma.task.count({ where: { status: "OPEN", dueAt: { lt: now } } }),
      prisma.task.count({ where: { status: "DONE" } }),
    ]);
    return { scheduled, scheduledTotal, tasks, taskCounts: { open, overdue, done } };
  });
}

// ─── Logs ───────────────────────────────────────────────────────────────────

const messageSelect = {
  id: true,
  toEmail: true,
  subject: true,
  status: true,
  provider: true,
  error: true,
  stepOrder: true,
  sentAt: true,
  openedAt: true,
  repliedAt: true,
  bouncedAt: true,
  openCount: true,
  createdAt: true,
  lead: { select: { id: true, name: true } },
} satisfies Prisma.EmailMessageSelect;

export type MessageRow = Prisma.EmailMessageGetPayload<{ select: typeof messageSelect }>;

export function listMessages(filters: { page: number; status?: string }): Promise<Result<Paged<MessageRow>>> {
  return safe(async () => {
    const where: Prisma.EmailMessageWhereInput = filters.status ? { status: filters.status } : {};
    const [items, total] = await Promise.all([
      prisma.emailMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: messageSelect }),
      prisma.emailMessage.count({ where }),
    ]);
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export interface JobRow {
  id: string;
  type: string;
  refId: string;
  status: string;
  runAt: Date;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  result: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  subject: { label: string; href: string } | null;
}

export function listJobs(filters: { page: number; status?: string }): Promise<Result<Paged<JobRow>>> {
  return safe(async () => {
    const where: Prisma.AutomationJobWhereInput = filters.status ? { status: filters.status } : {};
    const [jobs, total] = await Promise.all([
      prisma.automationJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.automationJob.count({ where }),
    ]);
    const runIds = jobs.filter((j) => j.type === "RUN_STEP").map((j) => j.refId);
    const importIds = jobs.filter((j) => j.type === "IMPORT").map((j) => j.refId);
    const [runs, imports] = await Promise.all([
      runIds.length ? prisma.automationRun.findMany({ where: { id: { in: runIds } }, select: { id: true, lead: { select: { id: true, name: true } } } }) : [],
      importIds.length ? prisma.leadImport.findMany({ where: { id: { in: importIds } }, select: { id: true, label: true } }) : [],
    ]);
    const runById = new Map(runs.map((r) => [r.id, r]));
    const importById = new Map(imports.map((i) => [i.id, i]));
    const items = jobs.map((job) => {
      const run = runById.get(job.refId);
      const batch = importById.get(job.refId);
      return {
        ...job,
        subject: run
          ? { label: run.lead.name, href: `/admin/leads/${run.lead.id}` }
          : batch
            ? { label: batch.label, href: `/admin/automation/imports/${batch.id}` }
            : null,
      };
    });
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

const eventSelect = {
  id: true,
  type: true,
  occurredAt: true,
  leadId: true,
  message: { select: { id: true, subject: true, toEmail: true, lead: { select: { id: true, name: true } } } },
} satisfies Prisma.EmailEventSelect;

export type EventRow = Prisma.EmailEventGetPayload<{ select: typeof eventSelect }>;

export function listEvents(filters: { page: number; type?: string }): Promise<Result<Paged<EventRow>>> {
  return safe(async () => {
    const where: Prisma.EmailEventWhereInput = filters.type ? { type: filters.type } : {};
    const [items, total] = await Promise.all([
      prisma.emailEvent.findMany({ where, orderBy: { occurredAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: eventSelect }),
      prisma.emailEvent.count({ where }),
    ]);
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export function listSuppression(filters: { page: number; q?: string }): Promise<Result<Paged<Prisma.SuppressionEntryGetPayload<object>>>> {
  return safe(async () => {
    const where: Prisma.SuppressionEntryWhereInput = filters.q ? { value: { contains: filters.q.toLowerCase() } } : {};
    const [items, total] = await Promise.all([
      prisma.suppressionEntry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      prisma.suppressionEntry.count({ where }),
    ]);
    return { items, total, page: filters.page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
  });
}

export function getSenderSettings(): Promise<Result<{ settings: OutreachSettings; problems: string[]; aiConfigured: boolean }>> {
  return safe(async () => {
    const settings = await getOutreachSettings();
    return { settings, problems: senderProblems(settings), aiConfigured: isPersonalizerConfigured() };
  });
}

export function listTags(): Promise<Result<{ id: string; name: string; leads: number }[]>> {
  return safe(async () => {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { leads: true } } } });
    return tags.map((tag) => ({ id: tag.id, name: tag.name, leads: tag._count.leads }));
  });
}
