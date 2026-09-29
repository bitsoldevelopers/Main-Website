import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, PERMISSIONS, hasPermission, isAdminRole } from "../rbac";

describe("rbac", () => {
  it("gives ADMIN every permission", () => {
    for (const permission of PERMISSIONS) expect(hasPermission("ADMIN", permission)).toBe(true);
  });

  it("scopes MANAGER to CRM and campaigns", () => {
    expect(hasPermission("MANAGER", "leads.write")).toBe(true);
    expect(hasPermission("MANAGER", "campaigns.write")).toBe(true);
    expect(hasPermission("MANAGER", "users.manage")).toBe(false);
    expect(hasPermission("MANAGER", "content.write")).toBe(false);
    expect(hasPermission("MANAGER", "settings.view")).toBe(false);
  });

  it("scopes EDITOR to content, media and SEO", () => {
    expect(hasPermission("EDITOR", "content.write")).toBe(true);
    expect(hasPermission("EDITOR", "media.write")).toBe(true);
    expect(hasPermission("EDITOR", "seo.write")).toBe(true);
    expect(hasPermission("EDITOR", "leads.read")).toBe(false);
    expect(hasPermission("EDITOR", "users.manage")).toBe(false);
  });

  it("lets MANAGER and EDITOR post to social accounts but not connect them", () => {
    for (const role of ["MANAGER", "EDITOR"] as const) {
      expect(hasPermission(role, "social.post")).toBe(true);
      expect(hasPermission(role, "social.manage")).toBe(false);
    }
  });

  it("lets MANAGER run outreach but not connect accounts or change the sender", () => {
    expect(hasPermission("MANAGER", "outreach.read")).toBe(true);
    expect(hasPermission("MANAGER", "outreach.write")).toBe(true);
    expect(hasPermission("MANAGER", "outreach.manage")).toBe(false);
    for (const permission of ["outreach.read", "outreach.write", "outreach.manage"] as const) {
      expect(hasPermission("EDITOR", permission)).toBe(false);
    }
  });

  it("recognises only admin-capable roles", () => {
    for (const role of ADMIN_ROLES) expect(isAdminRole(role)).toBe(true);
    expect(isAdminRole("STUDENT")).toBe(false);
    expect(isAdminRole("CLIENT")).toBe(false);
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
