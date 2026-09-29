import { describe, expect, it } from "vitest";
import { rateLimit, resetRateLimit } from "../rate-limit";

describe("rate limiter", () => {
  it("allows up to the limit then blocks", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("clears on reset", () => {
    const key = `t-${Math.random()}`;
    for (let i = 0; i < 4; i++) rateLimit(key, 3, 60_000);
    resetRateLimit(key);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
  });

  it("keys are independent", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    for (let i = 0; i < 4; i++) rateLimit(a, 3, 60_000);
    expect(rateLimit(b, 3, 60_000)).toBe(true);
  });
});
