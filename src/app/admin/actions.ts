"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { actorLabel, requireAdminAction } from "@/lib/admin/auth";
import { logActivity } from "@/lib/admin/activity";
import { ADMIN_COOKIE } from "@/lib/admin/session";
import { LEAD_STATUS_META, isLeadStatus } from "@/lib/admin/leads";
import { handleLeadStatusChange } from "@/lib/automation/engine";
import { recordActivity } from "@/lib/automation/timeline";
import { hashPassword } from "@/lib/admin/password";
import { slugify } from "@/lib/admin/slug";

/**
 * Every write the admin panel performs. Each action re-checks the session:
 * Server Actions are reachable by direct POST, so the proxy alone is not a
 * guarantee.
 */

export type FormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
} | null;

function str(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function failure(err: unknown): FormState {
  const message = err instanceof Error ? err.message : "Something went wrong";
  if (message.includes("Unique constraint")) {
    return { ok: false, error: "That value is already in use (a slug or email must be unique)." };
  }
  return { ok: false, error: message };
}

/** Blog pages are served from the ISR cache; refresh every URL a write touches. */
function revalidateBlog(slugs: string[]) {
  revalidatePath("/blog");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/blog");
  for (const slug of slugs) revalidatePath(`/blog/${slug}`);
}

// ─── Session ────────────────────────────────────────────────────────────────

export async function logout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

// ─── Blog ───────────────────────────────────────────────────────────────────

export async function savePost(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("content.write");

  const id = str(formData, "id");
  const title = str(formData, "title");
  const slug = slugify(str(formData, "slug") || title);
  const content = str(formData, "content");
  const author = str(formData, "author");
  const image = str(formData, "image");
  const excerpt = str(formData, "excerpt");
  const metaDescription = str(formData, "metaDescription");
  const tags = str(formData, "tags")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const published = formData.get("published") === "on";

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "A title is required.";
  if (!slug) fieldErrors.slug = "A slug is required.";
  if (!content) fieldErrors.content = "The article body is required.";
  if (metaDescription.length > 191) fieldErrors.metaDescription = "Keep the meta description under 191 characters.";
  if (image && !/^(https?:\/\/|\/)/.test(image)) fieldErrors.image = "Use a full URL or a path starting with /.";
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = {
    title,
    slug,
    content,
    author: author || "BITSOL MARKETING",
    image: image || null,
    excerpt: excerpt || null,
    metaDescription: metaDescription || null,
    tags,
    published,
  };

  let previousSlug: string | undefined;
  try {
    if (id) {
      const existing = await prisma.blog.findUnique({ where: { id }, select: { slug: true } });
      if (!existing) return { ok: false, error: "This post no longer exists." };
      previousSlug = existing.slug;
      await prisma.blog.update({ where: { id }, data });
    } else {
      await prisma.blog.create({ data });
    }
  } catch (err) {
    return failure(err);
  }
  void logActivity({
    actor: actorLabel(session),
    action: id ? "blog.updated" : "blog.created",
    entity: "blog",
    entityId: id || slug,
    detail: `${title}${published ? "" : " (draft)"}`,
  });

  revalidateBlog(previousSlug && previousSlug !== slug ? [slug, previousSlug] : [slug]);
  redirect(`/admin/blog?saved=${encodeURIComponent(slug)}`);
}

export async function setPostPublished(formData: FormData) {
  const session = await requireAdminAction("content.write");
  const id = str(formData, "id");
  const published = str(formData, "published") === "true";
  const post = await prisma.blog.update({ where: { id }, data: { published }, select: { slug: true, title: true } });
  void logActivity({
    actor: actorLabel(session),
    action: published ? "blog.published" : "blog.unpublished",
    entity: "blog",
    entityId: id,
    detail: post.title,
  });
  revalidateBlog([post.slug]);
  revalidatePath(`/admin/blog/${id}`);
}

export async function deletePost(formData: FormData) {
  const session = await requireAdminAction("content.write");
  const id = str(formData, "id");
  const post = await prisma.blog.delete({ where: { id }, select: { slug: true, title: true } });
  void logActivity({ actor: actorLabel(session), action: "blog.deleted", entity: "blog", entityId: id, detail: post.title });
  revalidateBlog([post.slug]);
  const redirectTo = str(formData, "redirectTo");
  if (redirectTo) redirect(redirectTo);
}

// ─── Leads ──────────────────────────────────────────────────────────────────

export async function updateLeadStatus(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!isLeadStatus(status)) throw new Error("Invalid lead status");
  const lead = await prisma.lead.update({ where: { id }, data: { status }, select: { name: true } });
  void logActivity({ actor: actorLabel(session), action: "lead.status_changed", entity: "lead", entityId: id, detail: `${lead.name} → ${status}` });
  await recordActivity({ leadId: id, type: "STATUS_CHANGED", title: `Status changed to ${LEAD_STATUS_META[status].label}`, actor: actorLabel(session) });
  // Won, lost, replied, not interested…: any automation for this lead ends now.
  await handleLeadStatusChange(id, status, actorLabel(session));
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/board");
  revalidatePath(`/admin/leads/${id}`);
}

export async function deleteLead(formData: FormData) {
  const session = await requireAdminAction("leads.write");
  const id = str(formData, "id");
  const lead = await prisma.lead.delete({ where: { id }, select: { name: true, email: true } });
  void logActivity({ actor: actorLabel(session), action: "lead.deleted", entity: "lead", entityId: id, detail: `${lead.name} <${lead.email}>` });
  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/board");
  const redirectTo = str(formData, "redirectTo");
  if (redirectTo) redirect(redirectTo);
}

// ─── Courses ────────────────────────────────────────────────────────────────

export async function saveCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("content.write");

  const id = str(formData, "id");
  const title = str(formData, "title");
  const description = str(formData, "description");
  const image = str(formData, "image");
  const price = Number.parseFloat(str(formData, "price"));

  const fieldErrors: Record<string, string> = {};
  if (!title) fieldErrors.title = "A title is required.";
  if (!description) fieldErrors.description = "A description is required.";
  if (!Number.isFinite(price) || price < 0) fieldErrors.price = "Enter a price of 0 or more.";
  if (image && !/^(https?:\/\/|\/)/.test(image)) fieldErrors.image = "Use a full URL or a path starting with /.";
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const data = { title, description, image, price };
  try {
    if (id) await prisma.course.update({ where: { id }, data });
    else await prisma.course.create({ data });
  } catch (err) {
    return failure(err);
  }
  void logActivity({ actor: actorLabel(session), action: id ? "course.updated" : "course.created", entity: "course", entityId: id || undefined, detail: title });

  revalidatePath("/admin");
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function deleteCourse(formData: FormData) {
  const session = await requireAdminAction("content.write");
  const id = str(formData, "id");
  const course = await prisma.course.delete({ where: { id }, select: { title: true } });
  void logActivity({ actor: actorLabel(session), action: "course.deleted", entity: "course", entityId: id, detail: course.title });
  revalidatePath("/admin");
  revalidatePath("/admin/courses");
}

// ─── Users ──────────────────────────────────────────────────────────────────

const ROLES = Object.values(Role) as string[];

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireAdminAction("users.manage");

  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const password = str(formData, "password");
  const role = str(formData, "role");

  const fieldErrors: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  if (password.length < 8) fieldErrors.password = "Use at least 8 characters.";
  if (!ROLES.includes(role)) fieldErrors.role = "Pick a role.";
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  try {
    await prisma.user.create({
      data: { name: name || null, email, password: hashPassword(password), role: role as Role },
    });
  } catch (err) {
    return failure(err);
  }
  void logActivity({ actor: actorLabel(session), action: "user.created", entity: "user", detail: `${email} as ${role}` });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  redirect("/admin/users");
}

export async function updateUserRole(formData: FormData) {
  const session = await requireAdminAction("users.manage");
  const id = str(formData, "id");
  const role = str(formData, "role");
  if (!ROLES.includes(role)) throw new Error("Invalid role");
  const user = await prisma.user.update({ where: { id }, data: { role: role as Role }, select: { email: true } });
  void logActivity({ actor: actorLabel(session), action: "user.role_changed", entity: "user", entityId: id, detail: `${user.email} → ${role}` });
  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const session = await requireAdminAction("users.manage");
  const id = str(formData, "id");
  if (id === session.sub) throw new Error("You cannot delete the account you are signed in with.");
  const user = await prisma.user.delete({ where: { id }, select: { email: true } });
  void logActivity({ actor: actorLabel(session), action: "user.deleted", entity: "user", entityId: id, detail: user.email });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
}
