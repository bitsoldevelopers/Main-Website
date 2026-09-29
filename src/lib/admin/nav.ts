import {
  LayoutDashboard,
  Inbox,
  KanbanSquare,
  Megaphone,
  FileText,
  GraduationCap,
  Layers,
  MessageSquareQuote,
  HelpCircle,
  ImageIcon,
  Globe,
  ArrowRightLeft,
  Bot,
  Building2,
  Workflow,
  Share2,
  Users,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, type AdminRole, type Permission } from "./rbac";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Which live counter to show next to the label. */
  badge?: "newLeads" | "drafts";
  /** Hidden from roles missing this permission; pages enforce it themselves too. */
  permission?: Permission;
}

export interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

/**
 * Mirrors what the platform is made of: the CRM (inbound forms, pipeline,
 * campaigns), the CMS (blog, academy, testimonials, FAQs, media), the SEO
 * plumbing, the content automation, and the system tables.
 */
export const adminNav: AdminNavGroup[] = [
  {
    heading: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        description: "Leads, publishing and site health at a glance.",
      },
    ],
  },
  {
    heading: "CRM",
    items: [
      {
        label: "Leads & Applications",
        href: "/admin/leads",
        icon: Inbox,
        description: "Inquiries, career applications and imported prospects.",
        badge: "newLeads",
        permission: "leads.read",
      },
      {
        label: "Pipeline Board",
        href: "/admin/leads/board",
        icon: KanbanSquare,
        description: "Drag leads through the sales pipeline.",
        permission: "leads.read",
      },
      {
        label: "Companies",
        href: "/admin/companies",
        icon: Building2,
        description: "Organisations and the contacts that belong to them.",
        permission: "leads.read",
      },
      {
        label: "Lead Automation",
        href: "/admin/automation",
        icon: Workflow,
        description: "Import leads, run email sequences and follow-ups.",
        permission: "outreach.read",
      },
      {
        label: "Campaigns",
        href: "/admin/campaigns",
        icon: Megaphone,
        description: "Ad campaigns and the leads their UTM tags bring in.",
        permission: "campaigns.read",
      },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "Blog", href: "/admin/blog", icon: FileText, description: "Articles served at /blog.", badge: "drafts", permission: "content.write" },
      { label: "Courses", href: "/admin/courses", icon: GraduationCap, description: "BITSOL Academy catalogue.", permission: "content.write" },
      {
        label: "Testimonials",
        href: "/admin/testimonials",
        icon: MessageSquareQuote,
        description: "The Voices of Success cards on the homepage.",
        permission: "content.write",
      },
      {
        label: "FAQs",
        href: "/admin/faqs",
        icon: HelpCircle,
        description: "Homepage FAQ section and its FAQPage schema.",
        permission: "content.write",
      },
      {
        label: "Media Library",
        href: "/admin/media",
        icon: ImageIcon,
        description: "Uploaded images and files under /uploads.",
        permission: "media.write",
      },
      {
        label: "Site Content",
        href: "/admin/content",
        icon: Layers,
        description: "Services, portfolio, pricing and other page content.",
        permission: "content.write",
      },
    ],
  },
  {
    heading: "Growth",
    items: [
      { label: "SEO & Site", href: "/admin/seo", icon: Globe, description: "Sitemap, robots, schema and tracking.", permission: "seo.write" },
      {
        label: "Redirects",
        href: "/admin/redirects",
        icon: ArrowRightLeft,
        description: "301/302 rules applied by the server to old URLs.",
        permission: "seo.write",
      },
      {
        label: "Social",
        href: "/admin/social",
        icon: Share2,
        description: "Connect LinkedIn and Facebook, write and publish posts.",
        permission: "social.post",
      },
      {
        label: "Content Pipeline",
        href: "/admin/automation/content",
        icon: Bot,
        description: "Daily content pipeline, deploys and integrations.",
        permission: "automation.view",
      },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Users", href: "/admin/users", icon: Users, description: "Accounts in the User table and their roles.", permission: "users.manage" },
      {
        label: "Activity Log",
        href: "/admin/activity",
        icon: History,
        description: "Who changed what, and when.",
        permission: "activity.read",
      },
      { label: "Settings", href: "/admin/settings", icon: Settings, description: "Environment, database and session status.", permission: "settings.view" },
    ],
  },
];

const allItems = adminNav.flatMap((group) => group.items);

/** The sidebar and palette for one signed-in role. */
export function navForRole(role: AdminRole): AdminNavGroup[] {
  return adminNav
    .map((group) => ({
      heading: group.heading,
      items: group.items.filter((item) => !item.permission || hasPermission(role, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

export function isNavActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumbs for the top bar, derived from the current pathname. */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Admin", href: "/admin" }];
  if (pathname === "/admin") return crumbs;

  const item = allItems
    .filter((i) => i.href !== "/admin" && isNavActive(i.href, pathname))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!item) return crumbs;

  crumbs.push({ label: item.label, href: item.href });
  const rest = pathname.slice(item.href.length).split("/").filter(Boolean);
  if (rest[0] === "new") crumbs.push({ label: "New" });
  else if (rest.length > 0) crumbs.push({ label: "Detail" });
  return crumbs;
}
