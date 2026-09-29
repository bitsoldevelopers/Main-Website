import { prisma } from "@/lib/prisma";
import {
  HOME_FAQ_DEFAULTS,
  TESTIMONIAL_DEFAULTS,
  type FaqItem,
  type TestimonialItem,
} from "@/lib/cms-defaults";

/**
 * Read side of the CMS for the public site. Every function degrades to the
 * built-in defaults when the table is empty or the database is unreachable,
 * so a database outage can never blank a section that used to be hardcoded.
 */

export async function getHomeFaq(): Promise<FaqItem[]> {
  try {
    const rows = await prisma.faq.findMany({
      where: { page: "home", published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { question: true, answer: true },
    });
    if (rows.length > 0) return rows;
  } catch {
    // fall through to defaults
  }
  return HOME_FAQ_DEFAULTS;
}

export async function getHomeTestimonials(): Promise<TestimonialItem[]> {
  try {
    const rows = await prisma.testimonial.findMany({
      where: { published: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, company: true, quote: true },
    });
    if (rows.length > 0) {
      return rows.map((t) => ({ id: t.id, title: t.company || t.name, description: t.quote }));
    }
  } catch {
    // fall through to defaults
  }
  return TESTIMONIAL_DEFAULTS;
}
