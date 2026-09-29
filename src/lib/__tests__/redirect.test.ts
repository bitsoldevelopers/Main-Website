import { describe, expect, it } from "vitest";
import { redirectToPath, sitePath, withQuery } from "../redirect";

describe("redirectToPath", () => {
  it("answers with a relative Location, so the browser keeps the public host", () => {
    const res = redirectToPath("/unsubscribe?token=abc");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/unsubscribe?token=abc");
  });

  it("uses the status it is given", () => {
    expect(redirectToPath("/admin/login", 303).status).toBe(303);
  });

  it("never leaves the site", () => {
    for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "evil", "", "/ok\r\nSet-Cookie: x=1"]) {
      expect(redirectToPath(path).headers.get("location")).toBe("/");
    }
  });
});

describe("sitePath", () => {
  it("keeps paths on this site as they are", () => {
    expect(sitePath("/admin/automation/sources/google-sheets?step=2")).toBe("/admin/automation/sources/google-sheets?step=2");
  });
});

describe("withQuery", () => {
  it("adds a parameter and keeps the existing ones", () => {
    expect(withQuery("/admin/social", "error", "Set A and B")).toBe("/admin/social?error=Set+A+and+B");
    expect(withQuery("/admin/x?step=2", "error", "no")).toBe("/admin/x?step=2&error=no");
  });

  it("replaces a parameter that is already there", () => {
    expect(withQuery("/admin/x?error=old", "error", "new")).toBe("/admin/x?error=new");
  });

  it("falls back to the home page for a path off the site", () => {
    expect(withQuery("//evil.example/x", "error", "no")).toBe("/?error=no");
  });
});
