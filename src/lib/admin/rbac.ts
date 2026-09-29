/**
 * Role-based access control for the admin panel. Three of the User roles may
 * sign in to /admin; STUDENT and CLIENT accounts exist for the academy and
 * client portal and are rejected by the login route.
 *
 * Permissions are deliberately coarse: one key per admin module, checked
 * server-side by requireAdminPage / requireAdminAction and used again to
 * filter the sidebar. Grow keys here as modules grow.
 */

export const ADMIN_ROLES = ["ADMIN", "EDITOR", "MANAGER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

export const PERMISSIONS = [
  "leads.read",
  "leads.write",
  "content.write", // blog, courses, testimonials, FAQs
  "media.write",
  "seo.write", // redirects and SEO settings
  "campaigns.read",
  "campaigns.write",
  "users.manage",
  "settings.view",
  "activity.read",
  "automation.view",
  "social.post", // write and publish posts
  "social.manage", // connect and disconnect accounts
  "outreach.read", // lead sources, automations, sequences, logs
  "outreach.write", // run imports, start and stop automations, edit templates
  "outreach.manage", // connect Google, sender settings, suppression list
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  MANAGER: [
    "leads.read",
    "leads.write",
    "campaigns.read",
    "campaigns.write",
    "activity.read",
    "social.post",
    "outreach.read",
    "outreach.write",
  ],
  EDITOR: ["content.write", "media.write", "seo.write", "social.post"],
};

export function hasPermission(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  ADMIN: "Admin — full access",
  MANAGER: "Business Development Manager — CRM & campaigns",
  EDITOR: "Editor — content & media",
};
