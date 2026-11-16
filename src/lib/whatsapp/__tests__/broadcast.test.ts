import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory recipient table, enough for the delivery-receipt logic.
const db = vi.hoisted(() => ({
  recipients: new Map<string, { id: string; broadcastId: string; status: string; messageId: string | null; error?: string | null; deliveredAt?: Date | null; readAt?: Date | null }>(),
  broadcastUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    broadcastRecipient: {
      findUnique: vi.fn(async ({ where }: { where: { messageId: string } }) => {
        const row = [...db.recipients.values()].find((r) => r.messageId === where.messageId);
        return row ? { id: row.id, broadcastId: row.broadcastId, status: row.status } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.recipients.get(where.id)!;
        Object.assign(row, data);
        return row;
      }),
      groupBy: vi.fn(async ({ where }: { where: { broadcastId: string } }) => {
        const counts = new Map<string, number>();
        for (const row of db.recipients.values()) {
          if (row.broadcastId === where.broadcastId) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
        }
        return [...counts].map(([status, n]) => ({ status, _count: { _all: n } }));
      }),
    },
    broadcast: {
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        db.broadcastUpdates.push(data);
        return data;
      }),
    },
  },
}));

import {
  applyStatusUpdate,
  audienceWhere,
  fillParameters,
  headerMediaFor,
  parseParameters,
  previewBody,
  readAudience,
  readStrings,
  requiresHeaderMedia,
  validateParameters,
} from "../broadcast";

describe("template parameters", () => {
  it("keeps only well-formed parameter sources", () => {
    expect(
      parseParameters([
        { kind: "static", value: "20%" },
        { kind: "contactName", fallback: "friend" },
        { kind: "contactName", fallback: 7 },
        { kind: "contactPhone" },
        { kind: "lookup", field: "email" },
        null,
        "static",
      ])
    ).toEqual([{ kind: "static", value: "20%" }, { kind: "contactName", fallback: "friend" }, { kind: "contactName", fallback: undefined }, { kind: "contactPhone" }]);
    expect(parseParameters("nope")).toEqual([]);
  });

  it("never sends an empty slot: a nameless contact gets the fallback, then a neutral greeting", () => {
    const sources = parseParameters([{ kind: "contactName", fallback: "friend" }, { kind: "contactName" }, { kind: "static", value: "  " }, { kind: "contactPhone" }]);
    expect(fillParameters(sources, { profileName: null, phone: "+923001234567" })).toEqual(["friend", "there", "-", "+923001234567"]);
    expect(fillParameters(sources, { profileName: "Ayesha ", phone: "+923001234567" })).toEqual(["Ayesha", "Ayesha", "-", "+923001234567"]);
  });

  it("refuses a parameter count that does not match the template", () => {
    const body = "Hi {{1}}, your {{2}} is ready.";
    expect(validateParameters(body, parseParameters([{ kind: "contactName" }]))).toEqual({
      ok: false,
      error: "This template takes 2 parameters, but 1 was configured.",
    });
    expect(validateParameters(body, parseParameters([{ kind: "contactName" }, { kind: "static", value: "report" }]))).toEqual({ ok: true });
    expect(validateParameters("No placeholders here.", [])).toEqual({ ok: true });
  });

  it("previews the body with a sample contact", () => {
    expect(previewBody("Hi {{1}}, {{2}} off until Friday.", parseParameters([{ kind: "contactName" }, { kind: "static", value: "20%" }]))).toBe("Hi Ali, 20% off until Friday.");
  });

  it("reads the saved parameter array leniently", () => {
    expect(readStrings(["a", 1, null])).toEqual(["a", "1", ""]);
    expect(readStrings("x")).toEqual([]);
  });
});

describe("media headers", () => {
  it("knows which header formats need a file on every send", () => {
    expect(requiresHeaderMedia("IMAGE")).toBe(true);
    expect(requiresHeaderMedia("document")).toBe(true);
    expect(requiresHeaderMedia("TEXT")).toBe(false);
    expect(requiresHeaderMedia(null)).toBe(false);
  });

  it("builds the header argument only when it is needed and given", () => {
    expect(headerMediaFor("IMAGE", " https://example.com/a.png ")).toEqual({ format: "IMAGE", link: "https://example.com/a.png" });
    expect(headerMediaFor("IMAGE", "")).toBeUndefined();
    expect(headerMediaFor("TEXT", "https://example.com/a.png")).toBeUndefined();
  });
});

describe("audiences", () => {
  it("always excludes opted-out and blocked contacts", () => {
    expect(audienceWhere({})).toEqual({ optedOut: false, isBlocked: false });
  });

  it("limits a segment to recently active contacts when asked", () => {
    const where = audienceWhere({ activeWithinDays: 30 });
    const since = (where.lastInboundAt as { gte: Date }).gte;
    expect(Date.now() - since.getTime()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(Date.now() - since.getTime()).toBeLessThan(31 * 24 * 60 * 60 * 1000);
  });

  it("uses a pasted list as the audience, still minus opt-outs", () => {
    expect(audienceWhere({ kind: "list", waIds: ["923001234567"], activeWithinDays: 30 })).toEqual({
      optedOut: false,
      isBlocked: false,
      waId: { in: ["923001234567"] },
    });
  });

  it("defaults every field of a saved audience", () => {
    expect(readAudience(null)).toEqual({ kind: "segment", waIds: [], activeWithinDays: null, limit: null });
    expect(readAudience({ kind: "list", waIds: ["1", 2], activeWithinDays: "90", limit: 50 })).toEqual({ kind: "list", waIds: ["1"], activeWithinDays: null, limit: 50 });
  });
});

describe("delivery receipts", () => {
  beforeEach(() => {
    db.recipients.clear();
    db.broadcastUpdates.length = 0;
    db.recipients.set("r1", { id: "r1", broadcastId: "b1", status: "SENT", messageId: "wamid.1" });
    db.recipients.set("r2", { id: "r2", broadcastId: "b1", status: "SENT", messageId: "wamid.2" });
  });

  it("ignores receipts for messages that are not part of a broadcast", async () => {
    await applyStatusUpdate("wamid.reply", "delivered");
    expect(db.broadcastUpdates).toEqual([]);
  });

  it("moves a recipient forward and recounts the broadcast", async () => {
    await applyStatusUpdate("wamid.1", "delivered");
    expect(db.recipients.get("r1")?.status).toBe("DELIVERED");
    expect(db.recipients.get("r1")?.deliveredAt).toBeInstanceOf(Date);
    expect(db.broadcastUpdates.at(-1)).toEqual({ recipients: 2, sent: 2, delivered: 1, readCount: 0, failed: 0 });
  });

  it("treats a read as delivered too, and never moves a status backwards", async () => {
    await applyStatusUpdate("wamid.1", "read");
    expect(db.recipients.get("r1")?.status).toBe("READ");
    expect(db.recipients.get("r1")?.deliveredAt).toBeInstanceOf(Date);
    await applyStatusUpdate("wamid.1", "delivered");
    await applyStatusUpdate("wamid.1", "sent");
    expect(db.recipients.get("r1")?.status).toBe("READ");
    expect(db.broadcastUpdates.at(-1)).toEqual({ recipients: 2, sent: 2, delivered: 1, readCount: 1, failed: 0 });
  });

  it("records a failure with Meta's reason", async () => {
    await applyStatusUpdate("wamid.2", "failed", "Message undeliverable");
    expect(db.recipients.get("r2")).toMatchObject({ status: "FAILED", error: "Message undeliverable" });
    expect(db.broadcastUpdates.at(-1)).toEqual({ recipients: 2, sent: 1, delivered: 0, readCount: 0, failed: 1 });
  });
});
