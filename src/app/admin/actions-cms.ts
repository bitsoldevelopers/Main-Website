"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { redirectError } from "@/lib/admin/redirects";
import { HOME_FAQ_DEFAULTS, TESTIMONIAL_DEFAULTS } from "@/lib/cms-defaults";
import type { FormState } from "./actions";

/** CMS writes: testimonials, FAQs, redirects and the media library. */

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(err: unknown): FormState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  if (message.includes("Unique constraint")) {
    return { ok: false, error: "That value is already in use (the old URL of a redirect must be unique)." };
  }
  return { ok: false, error: message };
}

// ─── Testimonials ───────────────────────────────────────────────────────────

function revalidateHome() {
  revalidatePath("/");
}

export async function saveTestimonial(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("content.write");

  const id = str(formData, "id");
  const name = str(formData, "name");
  const title = str(formData, "title") || "Client";
  const company = str(formData, "company");
  const quote = str(formData, "quote");
  const order = Number.parseInt(str(formData, "order") || "0", 10);
  const published = formData.get("published") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = "A client or company name is required.";
  if (!quote) fieldErrors.quote = "The testimonial text is required.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const data = { name, title, company: company || null, quote, order: Number.isFinite(order) ? order : 0, published };
  try {
    if (id) await prisma.testimonial.update({ where: { id }, data });
    else await prisma.testimonial.create({ data });
  } catch (err) {
    return failure(err);
  }

  void logActivity({ actor: actorLabel(session), action: id ? "testimonial.updated" : "testimonial.created", entity: "testimonial", entityId: id || undefined, detail: name });
  revalidateHome();
  revalidatePath("/admin/testimonials");
  redirect("/admin/testimonials");
}

export async function deleteTestimonial(formData: FormData) {
  const session = await requireAdminAction("content.write");
  const id = str(formData, "id");
  const t = await prisma.testimonial.delete({ where: { id }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "testimonial.deleted", entity: "testimonial", entityId: id, detail: t.name });
  revalidateHome();
  revalidatePath("/admin/testimonials");
}

export async function toggleTestimonial(formData: FormData) {
  await requireAdminAction("content.write");
  const id = str(formData, "id");
  const published = str(formData, "published") === "true";
  await prisma.testimonial.update({ where: { id }, data: { published } });
  revalidateHome();
  revalidatePath("/admin/testimonials");
}

/** Seed the table from the copy currently hardcoded into the site. */
export async function importDefaultTestimonials() {
  const session = await requireAdminAction("content.write");
  const existing = await prisma.testimonial.count();
  if (existing > 0) return;
  await prisma.testimonial.createMany({
    data: TESTIMONIAL_DEFAULTS.map((t, i) => ({ name: t.title, title: "Client", company: t.title, quote: t.description, order: i })),
  });
  void logActivity({ actor: actorLabel(session), action: "testimonial.defaults_imported", entity: "testimonial", detail: `${TESTIMONIAL_DEFAULTS.length} rows` });
  revalidateHome();
  revalidatePath("/admin/testimonials");
}

// ─── FAQs ───────────────────────────────────────────────────────────────────

export async function saveFaq(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("content.write");

  const id = str(formData, "id");
  const question = str(formData, "question");
  const answer = str(formData, "answer");
  const page = str(formData, "page") || "home";
  const order = Number.parseInt(str(formData, "order") || "0", 10);
  const published = formData.get("published") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!question) fieldErrors.question = "The question is required.";
  if (!answer) fieldErrors.answer = "The answer is required.";
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };

  const data = { question, answer, page, order: Number.isFinite(order) ? order : 0, published };
  try {
    if (id) await prisma.faq.update({ where: { id }, data });
    else await prisma.faq.create({ data });
  } catch (err) {
    return failure(err);
  }

  void logActivity({ actor: actorLabel(session), action: id ? "faq.updated" : "faq.created", entity: "faq", entityId: id || undefined, detail: question.slice(0, 120) });
  revalidateHome();
  revalidatePath("/admin/faqs");
  redirect("/admin/faqs");
}

export async function deleteFaq(formData: FormData) {
  const session = await requireAdminAction("content.write");
  const id = str(formData, "id");
  const faq = await prisma.faq.delete({ where: { id }, select: { question: true } });
  void logActivity({ actor: actorLabel(session), action: "faq.deleted", entity: "faq", entityId: id, detail: faq.question.slice(0, 120) });
  revalidateHome();
  revalidatePath("/admin/faqs");
}

export async function toggleFaq(formData: FormData) {
  await requireAdminAction("content.write");
  const id = str(formData, "id");
  const published = str(formData, "published") === "true";
  await prisma.faq.update({ where: { id }, data: { published } });
  revalidateHome();
  revalidatePath("/admin/faqs");
}

/** Seed the table from the copy currently hardcoded into the homepage. */
export async function importDefaultFaqs() {
  const session = await requireAdminAction("content.write");
  const existing = await prisma.faq.count({ where: { page: "home" } });
  if (existing > 0) return;
  await prisma.faq.createMany({
    data: HOME_FAQ_DEFAULTS.map((f, i) => ({ question: f.question, answer: f.answer, page: "home", order: i })),
  });
  void logActivity({ actor: actorLabel(session), action: "faq.defaults_imported", entity: "faq", detail: `${HOME_FAQ_DEFAULTS.length} rows` });
  revalidateHome();
  revalidatePath("/admin/faqs");
}

// ─── Redirects ──────────────────────────────────────────────────────────────

export async function saveRedirect(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("seo.write");

  const id = str(formData, "id");
  const fromPath = str(formData, "fromPath");
  const toPath = str(formData, "toPath");
  const permanent = str(formData, "kind") !== "temporary";

  const error = redirectError(fromPath, toPath);
  if (error) return { ok: false, error };

  try {
    if (id) await prisma.redirect.update({ where: { id }, data: { fromPath, toPath, permanent } });
    else await prisma.redirect.create({ data: { fromPath, toPath, permanent } });
  } catch (err) {
    return failure(err);
  }

  void logActivity({ actor: actorLabel(session), action: id ? "redirect.updated" : "redirect.created", entity: "redirect", entityId: id || undefined, detail: `${fromPath} → ${toPath}` });
  revalidatePath("/admin/redirects");
  return { ok: true };
}

export async function toggleRedirect(formData: FormData) {
  await requireAdminAction("seo.write");
  const id = str(formData, "id");
  const active = str(formData, "active") === "true";
  await prisma.redirect.update({ where: { id }, data: { active } });
  revalidatePath("/admin/redirects");
}

export async function deleteRedirect(formData: FormData) {
  const session = await requireAdminAction("seo.write");
  const id = str(formData, "id");
  const rule = await prisma.redirect.delete({ where: { id }, select: { fromPath: true } });
  void logActivity({ actor: actorLabel(session), action: "redirect.deleted", entity: "redirect", entityId: id, detail: rule.fromPath });
  revalidatePath("/admin/redirects");
}

// ─── Media ──────────────────────────────────────────────────────────────────

export async function updateMediaAlt(formData: FormData) {
  await requireAdminAction("media.write");
  const id = str(formData, "id");
  const alt = str(formData, "alt").slice(0, 191);
  await prisma.media.update({ where: { id }, data: { alt: alt || null } });
  revalidatePath("/admin/media");
}

export async function deleteMedia(formData: FormData) {
  const session = await requireAdminAction("media.write");
  const id = str(formData, "id");
  const media = await prisma.media.delete({ where: { id } });

  // Only ever unlink inside public/uploads, whatever the row says.
  const uploadsRoot = path.join(process.cwd(), "public", "uploads");
  const target = path.join(process.cwd(), "public", ...media.path.split("/").filter(Boolean));
  if (target.startsWith(uploadsRoot)) {
    try {
      await unlink(target);
    } catch {
      // The DB row is the source of truth; a missing file is fine.
    }
  }

  void logActivity({ actor: actorLabel(session), action: "media.deleted", entity: "media", entityId: id, detail: media.filename });
  revalidatePath("/admin/media");
}
