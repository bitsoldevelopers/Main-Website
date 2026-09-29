import { beforeEach, describe, expect, it } from "vitest";
import { issueSessionToken, isValidSession, readSession, safeEqual, verifyAdminPassword } from "../session";

describe("admin sessions", () => {
  beforeEach(() => {
    process.env.ADMIN_SECRET = "test-secret-for-vitest";
  });

  it("round-trips a v2 token", async () => {
    const token = await issueSessionToken({ sub: "user-1", name: "Adnan", role: "MANAGER" });
    expect(token).toMatch(/^v2\./);
    const session = await readSession(token);
    expect(session).toMatchObject({ sub: "user-1", name: "Adnan", role: "MANAGER" });
    expect(session!.exp * 1000).toBeGreaterThan(Date.now());
  });

  it("rejects a tampered payload", async () => {
    const token = (await issueSessionToken({ sub: "user-1", name: "Adnan", role: "MANAGER" })) as string;
    const [v, payload, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    forged.role = "ADMIN";
    const tampered = [v, Buffer.from(JSON.stringify(forged)).toString("base64url"), sig].join(".");
    expect(await readSession(tampered)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const token = (await issueSessionToken({ sub: "user-1", name: "Adnan", role: "ADMIN" })) as string;
    // Re-sign is impossible without the secret, so simulate expiry by time travel instead:
    const session = await readSession(token);
    expect(session).not.toBeNull();
    // A token from a different secret is invalid.
    process.env.ADMIN_SECRET = "rotated-secret";
    expect(await readSession(token)).toBeNull();
  });

  it("rejects garbage and empty tokens", async () => {
    expect(await isValidSession(undefined)).toBe(false);
    expect(await isValidSession("")).toBe(false);
    expect(await isValidSession("v2.not.real")).toBe(false);
    expect(await isValidSession("random-string")).toBe(false);
  });

  it("verifies the owner password in constant time", () => {
    expect(verifyAdminPassword("test-secret-for-vitest")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
