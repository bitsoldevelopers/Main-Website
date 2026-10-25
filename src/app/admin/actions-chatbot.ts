"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { slugify } from "@/lib/admin/slug";
import { invalidateKnowledgeCache } from "@/lib/ai/knowledge";
import { MARKETING_KNOWLEDGE_BASE } from "@/data/marketing/knowledge-base";
import { recordActivity } from "@/lib/automation/timeline";
import { KNOWLEDGE_KINDS, KNOWLEDGE_STATES, MEETING_STATUSES, TICKET_STATUSES } from "@/lib/chatbot/constants";
import type { FormState } from "./actions";

/** Writes for Admin → Chatbot: the knowledge base, tickets & meetings, conversations. */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(err: unknown): FormState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  if (message.includes("Unique constraint")) {
    return { ok: false, error: "That slug is already in use by another entry." };
  }
  return { ok: false, error: message };
}

// ─── Knowledge base ─────────────────────────────────────────────────────────

export async function saveKnowledge(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("chatbot.write");

  const id = str(formData, "id");
  const question = str(formData, "question");
  const answer = str(formData, "answer");
  const category = str(formData, "category") || "General";
  const kind = str(formData, "kind");
  const state = str(formData, "state");
  const slug = slugify(str(formData, "slug") || question).slice(0, 120);
  const sortOrder = Number.parseInt(str(formData, "sortOrder") || "0", 10);
  const keywords = str(formData, "keywords")
    .split(/[,\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 60);

  const fieldErrors: Record<string, string> = {};
  if (!question) fieldErrors.question = "The question is required.";
  if (!answer) fieldErrors.answer = "The answer is required.";
  if (!slug) fieldErrors.slug = "A slug is required.";
  if (!(KNOWLEDGE_KINDS as readonly string[]).includes(kind)) fieldErrors.kind = "Pick a kind.";
  if (!(KNOWLEDGE_STATES as readonly string[]).includes(state)) fieldErrors.state = "Pick a state.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const data = {
    slug,
    question,
    answer,
    category,
    kind,
    state,
    keywords: keywords as Prisma.InputJsonValue,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  };
  try {
    if (id) await prisma.chatKnowledge.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    else await prisma.chatKnowledge.create({ data });
  } catch (err) {
    return failure(err);
  }

  invalidateKnowledgeCache();
  void logActivity({
    actor: actorLabel(session),
    action: id ? "chatbot.knowledge.updated" : "chatbot.knowledge.created",
    entity: "chatbot",
    entityId: id || slug,
    detail: question.slice(0, 120),
  });
  revalidatePath("/admin/chatbot/knowledge");
  redirect("/admin/chatbot/knowledge");
}

export async function setKnowledgeState(formData: FormData) {
  const session = await requireAdminAction("chatbot.write");
  const id = str(formData, "id");
  const state = str(formData, "state");
  if (!(KNOWLEDGE_STATES as readonly string[]).includes(state)) throw new Error("Invalid state");
  const entry = await prisma.chatKnowledge.update({ where: { id }, data: { state }, select: { question: true } });
  invalidateKnowledgeCache();
  void logActivity({ actor: actorLabel(session), action: "chatbot.knowledge.state", entity: "chatbot", entityId: id, detail: `${entry.question.slice(0, 80)} → ${state}` });
  revalidatePath("/admin/chatbot/knowledge");
}

export async function deleteKnowledge(formData: FormData) {
  const session = await requireAdminAction("chatbot.write");
  const id = str(formData, "id");
  const entry = await prisma.chatKnowledge.delete({ where: { id }, select: { question: true } });
  invalidateKnowledgeCache();
  void logActivity({ actor: actorLabel(session), action: "chatbot.knowledge.deleted", entity: "chatbot", entityId: id, detail: entry.question.slice(0, 120) });
  revalidatePath("/admin/chatbot/knowledge");
}

/**
 * Load the built-in entries into the table so they can be edited. Entries
 * whose slug already exists are left alone, so this is safe to repeat after
 * a release adds new defaults.
 */
export async function importDefaultKnowledge() {
  const session = await requireAdminAction("chatbot.write");
  const existing = new Set((await prisma.chatKnowledge.findMany({ select: { slug: true } })).map((row) => row.slug));
  const rows = MARKETING_KNOWLEDGE_BASE.filter((entry) => !existing.has(entry.id)).map((entry, index) => ({
    slug: entry.id,
    kind: entry.kind,
    category: entry.category,
    question: entry.question,
    answer: entry.answer,
    keywords: entry.keywords as Prisma.InputJsonValue,
    state: "PUBLISHED",
    sortOrder: index,
  }));
  if (rows.length) await prisma.chatKnowledge.createMany({ data: rows });
  invalidateKnowledgeCache();
  void logActivity({ actor: actorLabel(session), action: "chatbot.knowledge.defaults_imported", entity: "chatbot", detail: `${rows.length} entries` });
  revalidatePath("/admin/chatbot/knowledge");
}

// ─── Tickets & meetings ─────────────────────────────────────────────────────

export async function updateRequest(formData: FormData) {
  const session = await requireAdminAction("chatbot.write");
  const id = str(formData, "id");
  const status = str(formData, "status");
  const notes = str(formData, "notes");
  const meetingLink = str(formData, "meetingLink");

  const request = await prisma.chatRequest.findUnique({ where: { id }, select: { kind: true, reference: true, leadId: true, status: true } });
  if (!request) throw new Error("Request not found");
  const allowed: readonly string[] = request.kind === "TICKET" ? TICKET_STATUSES : MEETING_STATUSES;
  if (status && !allowed.includes(status)) throw new Error("Invalid status");

  const data: Prisma.ChatRequestUpdateInput = {};
  if (status) data.status = status;
  if (formData.has("notes")) data.notes = notes || null;
  if (formData.has("meetingLink")) data.meetingLink = meetingLink || null;
  if (status === "RESOLVED" || status === "CLOSED") data.resolvedAt = new Date();
  if (status === "CONFIRMED" && request.kind === "MEETING" && request.leadId) {
    await prisma.lead.updateMany({ where: { id: request.leadId, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "FOLLOW_UP"] } }, data: { status: "MEETING_SCHEDULED" } });
  }
  await prisma.chatRequest.update({ where: { id }, data });

  if (status && status !== request.status && request.leadId) {
    await recordActivity({
      leadId: request.leadId,
      type: "NOTE",
      title: `${request.kind === "TICKET" ? "Ticket" : "Consultation"} ${request.reference} → ${status.replace(/_/g, " ").toLowerCase()}`,
      actor: actorLabel(session),
    });
  }
  void logActivity({ actor: actorLabel(session), action: "chatbot.request.updated", entity: "chatbot", entityId: id, detail: `${request.reference}${status ? ` → ${status}` : ""}` });
  revalidatePath("/admin/chatbot/requests");
  revalidatePath("/admin/chatbot/conversations");
}

export async function deleteRequest(formData: FormData) {
  const session = await requireAdminAction("chatbot.write");
  const id = str(formData, "id");
  const request = await prisma.chatRequest.delete({ where: { id }, select: { reference: true } });
  void logActivity({ actor: actorLabel(session), action: "chatbot.request.deleted", entity: "chatbot", entityId: id, detail: request.reference });
  revalidatePath("/admin/chatbot/requests");
}

// ─── Conversations ──────────────────────────────────────────────────────────

export async function deleteConversation(formData: FormData) {
  const session = await requireAdminAction("chatbot.manage");
  const id = str(formData, "id");
  const conversation = await prisma.chatConversation.delete({ where: { id }, select: { reference: true } });
  void logActivity({ actor: actorLabel(session), action: "chatbot.conversation.deleted", entity: "chatbot", entityId: id, detail: conversation.reference });
  revalidatePath("/admin/chatbot/conversations");
  redirect("/admin/chatbot/conversations");
}

/** Close a handover from the panel once a person has dealt with it. */
export async function resolveHandoff(formData: FormData) {
  const session = await requireAdminAction("chatbot.write");
  const id = str(formData, "id");
  await prisma.chatConversation.update({ where: { id }, data: { handedOff: false, handoverTeam: null, botPaused: false } });
  void logActivity({ actor: actorLabel(session), action: "chatbot.handoff.resolved", entity: "chatbot", entityId: id });
  revalidatePath("/admin/chatbot/conversations");
  revalidatePath(`/admin/chatbot/conversations/${id}`);
}
