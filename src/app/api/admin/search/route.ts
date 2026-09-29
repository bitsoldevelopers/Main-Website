import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin/auth";
import { LEAD_STATUS_META, normalizeStatus } from "@/lib/admin/leads";
import { hasPermission } from "@/lib/admin/rbac";
import { leadWhere } from "@/lib/automation/lead-queries";

export interface SearchHit {
  group: string;
  label: string;
  hint?: string;
  href: string;
}

/**
 * Backend for the ⌘K palette. Static navigation entries are matched on the
 * client; this endpoint covers the records: leads, posts, campaigns, users.
 * Each section is permission-gated with the same keys as its module.
 */
export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ hits: [] });

  const hits: SearchHit[] = [];
  try {
    const [leads, posts, campaigns, users] = await Promise.all([
      hasPermission(session.role, "leads.read")
        ? prisma.lead.findMany({
            // Same fields as the lead list: names, company, every email and
            // phone, LinkedIn, website and location.
            where: leadWhere({ q }),
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, name: true, email: true, outreachEmail: true, company: true, status: true },
          })
        : [],
      hasPermission(session.role, "content.write")
        ? prisma.blog.findMany({
            where: { OR: [{ title: { contains: q } }, { slug: { contains: q } }] },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, title: true, published: true },
          })
        : [],
      hasPermission(session.role, "campaigns.read")
        ? prisma.campaign.findMany({
            where: { OR: [{ name: { contains: q } }, { utmCampaign: { contains: q } }] },
            orderBy: { createdAt: "desc" },
            take: 4,
            select: { id: true, name: true, platform: true },
          })
        : [],
      hasPermission(session.role, "users.manage")
        ? prisma.user.findMany({
            where: { OR: [{ email: { contains: q } }, { name: { contains: q } }] },
            take: 4,
            select: { id: true, email: true, name: true, role: true },
          })
        : [],
    ]);

    for (const lead of leads) {
      const hint = [lead.company, lead.outreachEmail || lead.email, LEAD_STATUS_META[normalizeStatus(lead.status)].label].filter(Boolean).join(" · ");
      hits.push({ group: "Leads", label: lead.name, hint, href: `/admin/leads/${lead.id}` });
    }
    for (const post of posts) {
      hits.push({ group: "Blog", label: post.title, hint: post.published ? "Published" : "Draft", href: `/admin/blog/${post.id}` });
    }
    for (const campaign of campaigns) {
      hits.push({ group: "Campaigns", label: campaign.name, hint: campaign.platform, href: `/admin/campaigns/${campaign.id}` });
    }
    for (const user of users) {
      hits.push({ group: "Users", label: user.name || user.email, hint: user.role, href: "/admin/users" });
    }
  } catch {
    // Database down — the palette still serves navigation matches client-side.
  }

  return NextResponse.json({ hits });
}
