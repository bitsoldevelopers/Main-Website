import { Resend } from "resend";
import { logActivity } from "@/lib/admin/activity";
import { config } from "./config";

/**
 * Team notifications and audit entries for the chatbot. Both are best-effort:
 * a conversation must never fail because the mailer or the database is down,
 * so failures are logged and swallowed.
 *
 * Email goes through Resend, the same service the contact form uses. Every
 * notification is also written to the admin activity log, so the team sees
 * it in the panel even when no email key is configured.
 */

export interface TeamNotification {
  subject: string;
  body: string;
  /** Deep link into the admin panel, e.g. `/admin/leads/<id>`. */
  link?: string;
  /** A team's inboxes from Chatbot Studio. Omitted, the default sales inbox. */
  to?: string[];
}

function resendKey(): string | null {
  const key = process.env.RESEND_API_KEY;
  return key && key !== "re_dummy" ? key : null;
}

export function isMailConfigured(): boolean {
  return resendKey() !== null;
}

export async function notifyTeam(notification: TeamNotification): Promise<void> {
  const recipients = notification.to?.length ? notification.to : config.routing.salesEmail ? [config.routing.salesEmail] : [];
  const link = notification.link ? `${config.appUrl}${notification.link}` : null;

  void logActivity({
    actor: "Chatbot",
    action: "chatbot.notified",
    entity: "chatbot",
    detail: `${notification.subject}${link ? ` — ${link}` : ""}`,
  });

  const key = resendKey();
  if (!recipients.length || !key) return;

  try {
    await new Resend(key).emails.send({
      from: "BITSOL Chatbot <leads@bitsolmarketing.com>",
      to: recipients,
      subject: notification.subject,
      text: [notification.body, link ? `\nOpen in the admin panel: ${link}` : null].filter(Boolean).join("\n"),
    });
  } catch (error) {
    console.warn("[chatbot] notification email skipped:", error instanceof Error ? error.message : error);
  }
}

export interface AuditEntry {
  action: string;
  entity?: string;
  entityId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  /** Signed-in admin, when a person did it. */
  actor?: string;
  level?: "DEBUG" | "INFO" | "WARN" | "ERROR";
}

/** Write an audit-log entry to the admin activity log. Never throws. */
export async function logEvent(entry: AuditEntry): Promise<void> {
  const detail = [
    entry.level && entry.level !== "INFO" ? `[${entry.level}]` : null,
    entry.message ?? null,
    entry.metadata && Object.keys(entry.metadata).length ? JSON.stringify(entry.metadata) : null,
  ]
    .filter(Boolean)
    .join(" ");
  await logActivity({
    actor: entry.actor ?? "Chatbot",
    action: entry.action,
    entity: entry.entity ?? "chatbot",
    entityId: entry.entityId ?? null,
    detail: detail || null,
  });
}
