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
  BookOpen,
  BarChart3,
  FlaskConical,
  LifeBuoy,
  MessagesSquare,
  Plug,
  Sparkles,
  Building2,
  Workflow,
  Share2,
  Users,
  History,
  Settings,
  UserPlus,
  SquarePen,
  type LucideIcon,
} from "lucide-react";
import { hasPermission, type AdminRole, type Permission } from "./rbac";

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  /** Which live counter to show next to the label. */
  badge?: "newLeads" | "drafts" | "handoffs";
  /** Hidden from roles missing this permission; pages enforce it themselves too. */
  permission?: Permission;
}

export interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
  /** Header shown above the group in the sidebar; null hides it. Defaults to `heading`. */
  section?: string | null;
  /** Render the group in the sidebar as one collapsible parent with these items under it. */
  menu?: { label: string; icon: LucideIcon };
}

/**
 * Mirrors what the platform is made of: the CRM (inbound forms, pipeline,
 * campaigns), the CMS (blog, academy, testimonials, FAQs, media), the SEO
 * plumbing, the content automation, and the system tables.
 */
export const adminNav: AdminNavGroup[] = [
  {
    heading: "Overview",
    section: null,
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
    heading: "Chatbot",
    section: "Apps",
    menu: { label: "Chatbot", icon: Bot },
    items: [
      {
        label: "Conversations",
        href: "/admin/chatbot/conversations",
        icon: MessagesSquare,
        description: "Every chat the assistant handled on the website and WhatsApp.",
        badge: "handoffs",
        permission: "chatbot.view",
      },
      {
        label: "Tickets & Meetings",
        href: "/admin/chatbot/requests",
        icon: LifeBuoy,
        description: "Support tickets and consultation requests raised in chat.",
        permission: "chatbot.view",
      },
      {
        label: "Knowledge Base",
        href: "/admin/chatbot/knowledge",
        icon: BookOpen,
        description: "What the assistant is allowed to say about BITSOL Marketing.",
        permission: "chatbot.view",
      },
      {
        label: "Chatbot Studio",
        href: "/admin/chatbot/studio",
        icon: Bot,
        description: "Menus, messages, pricing, teams, scoring and automation rules.",
        permission: "chatbot.manage",
      },
      {
        label: "Simulator",
        href: "/admin/chatbot/simulator",
        icon: FlaskConical,
        description: "Talk to the assistant with the live configuration. Nothing is saved.",
        permission: "chatbot.manage",
      },
      {
        label: "Chatbot Analytics",
        href: "/admin/chatbot/analytics",
        icon: BarChart3,
        description: "Conversations, leads, handovers, intents and languages.",
        permission: "chatbot.view",
      },
      {
        label: "Templates",
        href: "/admin/chatbot/templates",
        icon: FileText,
        description: "WhatsApp message templates, synced from Meta and submitted for review.",
        permission: "chatbot.manage",
      },
      {
        label: "Broadcasts",
        href: "/admin/chatbot/broadcasts",
        icon: Megaphone,
        description: "Send an approved template to many WhatsApp contacts at once.",
        permission: "chatbot.manage",
      },
      {
        label: "Chatbot Setup",
        href: "/admin/chatbot/setup",
        icon: Plug,
        description: "AI provider, WhatsApp connection, webhook URL and follow-up cron.",
        permission: "chatbot.manage",
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
        icon: Sparkles,
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
      ...group,
      items: group.items.filter((item) => !item.permission || hasPermission(role, item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

export interface AdminShortcut {
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
}

/** The navbar's shortcuts grid, filtered per role like the sidebar. */
const adminShortcuts: AdminShortcut[] = [
  { label: "New lead", hint: "Add an inquiry by hand", href: "/admin/leads/new", icon: UserPlus, permission: "leads.write" },
  { label: "Pipeline", hint: "Move deals along", href: "/admin/leads/board", icon: KanbanSquare, permission: "leads.read" },
  { label: "New article", hint: "Write for the blog", href: "/admin/blog/new", icon: SquarePen, permission: "content.write" },
  { label: "Media", hint: "Upload images", href: "/admin/media", icon: ImageIcon, permission: "media.write" },
  { label: "Conversations", hint: "Website and WhatsApp", href: "/admin/chatbot/conversations", icon: MessagesSquare, permission: "chatbot.view" },
  { label: "Social", hint: "Write and publish posts", href: "/admin/social", icon: Share2, permission: "social.post" },
  { label: "Activity", hint: "Who changed what", href: "/admin/activity", icon: History, permission: "activity.read" },
  { label: "Settings", hint: "Environment and database", href: "/admin/settings", icon: Settings, permission: "settings.view" },
];

export function shortcutsForRole(role: AdminRole): AdminShortcut[] {
  return adminShortcuts.filter((s) => !s.permission || hasPermission(role, s.permission));
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
