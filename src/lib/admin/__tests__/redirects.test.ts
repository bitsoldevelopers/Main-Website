import { describe, expect, it } from "vitest";
import { normalizePath, redirectError } from "../redirects";

describe("redirect helpers", () => {
  it("normalises case, trailing slashes and missing leading slash", () => {
    expect(normalizePath("/Old-Page/")).toBe("/old-page");
    expect(normalizePath("old-page")).toBe("/old-page");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/a/b/")).toBe("/a/b");
  });

  it("accepts valid path and URL targets", () => {
    expect(redirectError("/old", "/new")).toBeNull();
    expect(redirectError("/old", "https://example.com/page")).toBeNull();
  });

  it("rejects invalid rules", () => {
    expect(redirectError("old", "/new")).toMatch(/must be a path/);
    expect(redirectError("/", "/new")).toMatch(/homepage/);
    expect(redirectError("/admin/leads", "/new")).toMatch(/Admin paths/);
    expect(redirectError("/old", "new")).toMatch(/must be a path starting/);
    expect(redirectError("/old", "/OLD/")).toMatch(/itself/);
  });
});
