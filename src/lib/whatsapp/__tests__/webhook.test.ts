import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WhatsAppSettings } from "../settings";

const mocks = vi.hoisted(() => ({
  pending: [] as Array<() => Promise<void>>,
  logEvent: vi.fn(async (entry: { action: string; message?: string }) => void entry),
  handleInbound: vi.fn(async (message: { id: string; text?: string }) => void message),
  applyStatusUpdate: vi.fn(async (...args: unknown[]) => void args),
  // `stale` stands in for another process's cache: what a non-fresh read returns.
  settings: { current: null as WhatsAppSettings | null, stale: null as WhatsAppSettings | null },
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (task: () => Promise<void>) => void mocks.pending.push(task) };
});
vi.mock("@/lib/notify", () => ({ logEvent: mocks.logEvent }));
vi.mock("@/lib/whatsapp/handler", () => ({ handleInbound: mocks.handleInbound }));
vi.mock("@/lib/whatsapp/broadcast", () => ({ applyStatusUpdate: mocks.applyStatusUpdate }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/whatsapp/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../settings")>();
  return {
    ...actual,
    getWhatsAppSettings: async (options?: { fresh?: boolean }) => (!options?.fresh && mocks.settings.stale) || mocks.settings.current,
  };
});

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/whatsapp/webhook/route";
import { signBody } from "../client";
import { checkCallback, checkSignature } from "../diagnostics";
import { WHATSAPP_KEYS, type SettingSource, type WhatsAppKey } from "../fields";
import { SELF_TEST_HEADER, SELF_TEST_VALUE } from "../self-test";
import { buildSettings } from "../settings";

const URL_BASE = "https://bitsolmarketing.com/api/whatsapp/webhook";
const SECRET = "0123456789abcdef0123456789abcdef";
const VERIFY = "verify-token-for-tests";

function use(given: Partial<Record<WhatsAppKey, string>>): WhatsAppSettings {
  const values = Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, given[key] ?? ""])) as Record<WhatsAppKey, string>;
  const sources = Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, values[key] ? "panel" : "none"])) as Record<WhatsAppKey, SettingSource>;
  mocks.settings.current = buildSettings(values, sources);
  return mocks.settings.current;
}

function handshake(token: string, headers: Record<string, string> = {}) {
  const url = new URL(URL_BASE);
  url.searchParams.set("hub.mode", "subscribe");
  url.searchParams.set("hub.verify_token", token);
  url.searchParams.set("hub.challenge", "1158201444");
  return GET(new NextRequest(url, { headers }));
}

function deliver(body: string, signature: string | null, headers: Record<string, string> = {}) {
  return POST(
    new NextRequest(URL_BASE, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json", ...(signature ? { "X-Hub-Signature-256": signature } : {}), ...headers },
    })
  );
}

const actions = () => mocks.logEvent.mock.calls.map(([entry]) => entry.action);

const MESSAGE = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "WABA",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: { phone_number_id: "111" },
            contacts: [{ wa_id: "923001234567", profile: { name: "Ayesha" } }],
            messages: [
              { id: "wamid.1", from: "923001234567", timestamp: "1761400000", type: "text", text: { body: "Hello" } },
              { id: "wamid.2", from: "923001234567", timestamp: "1761400001", type: "text", text: { body: "Prices?" } },
            ],
          },
        },
      ],
    },
  ],
});

beforeEach(() => {
  mocks.pending.length = 0;
  mocks.logEvent.mockClear();
  mocks.handleInbound.mockClear();
  mocks.applyStatusUpdate.mockClear();
  mocks.settings.stale = null;
  use({ WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_APP_SECRET: SECRET });
});

describe("details saved a moment ago", () => {
  it("verifies with a verify token generated a second ago, past a stale cache", async () => {
    mocks.settings.stale = use({ WHATSAPP_APP_SECRET: SECRET });
    use({ WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_APP_SECRET: SECRET });
    const res = await handshake(VERIFY);
    expect(res.status).toBe(200);
  });

  it("accepts a delivery signed with an app secret saved a second ago", async () => {
    const newSecret = "fedcba9876543210fedcba9876543210";
    mocks.settings.stale = use({ WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_APP_SECRET: SECRET });
    use({ WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_APP_SECRET: newSecret });
    const res = await deliver(MESSAGE, signBody(MESSAGE, newSecret));
    expect(res.status).toBe(200);
    expect(actions()).toEqual([]);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("webhook verification (GET)", () => {
  it("refuses to verify without a verify token", async () => {
    use({ WHATSAPP_APP_SECRET: SECRET });
    const res = await handshake("anything");
    expect(res.status).toBe(500);
    expect(await res.text()).toBe("Webhook not configured");
  });

  it("echoes the challenge for the right token, uncached, and records Meta's verification", async () => {
    const res = await handshake(VERIFY);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("1158201444");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(actions()).toEqual(["whatsapp.webhook.verified"]);
  });

  it("refuses a different token and records the attempt", async () => {
    const res = await handshake("not-the-token");
    expect(res.status).toBe(403);
    expect(await res.text()).toBe("Forbidden");
    expect(actions()).toEqual(["whatsapp.webhook.verify_failed"]);
  });

  it("does not record the Setup page's own tests, passed or refused", async () => {
    expect((await handshake(VERIFY, { [SELF_TEST_HEADER]: SELF_TEST_VALUE })).status).toBe(200);
    expect((await handshake("other", { [SELF_TEST_HEADER]: "from-another-installation" })).status).toBe(403);
    expect(actions()).toEqual([]);
  });

  it("ignores requests that are not a subscription handshake", async () => {
    const res = await GET(new NextRequest(`${URL_BASE}?hub.challenge=1`));
    expect(res.status).toBe(403);
    expect(actions()).toEqual([]);
  });
});

describe("webhook deliveries (POST)", () => {
  it("refuses an unsigned delivery and records it", async () => {
    const res = await deliver(MESSAGE, null);
    expect(res.status).toBe(401);
    expect(actions()).toEqual(["whatsapp.webhook.rejected"]);
    expect(mocks.pending).toHaveLength(0);
  });

  it("refuses a signature that is not hex without throwing", async () => {
    expect((await deliver(MESSAGE, "sha256=zz-not-hex")).status).toBe(401);
    expect((await deliver(MESSAGE, `sha256=${"a".repeat(10)}`)).status).toBe(401);
  });

  it("refuses everything while no app secret is set, and says why", async () => {
    use({ WHATSAPP_VERIFY_TOKEN: VERIFY });
    const res = await deliver(MESSAGE, signBody(MESSAGE, SECRET));
    expect(res.status).toBe(401);
    expect(mocks.logEvent.mock.calls[0][0].message).toMatch(/no app secret is set/);
  });

  it("does not record a refused self-test", async () => {
    const res = await deliver(MESSAGE, signBody(MESSAGE, "ffffffffffffffffffffffffffffffff"), { [SELF_TEST_HEADER]: SELF_TEST_VALUE });
    expect(res.status).toBe(401);
    expect(actions()).toEqual([]);
  });

  it("answers a signed delivery at once and handles its messages afterwards, in order", async () => {
    const res = await deliver(MESSAGE, signBody(MESSAGE, SECRET));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
    expect(mocks.handleInbound).not.toHaveBeenCalled();

    expect(mocks.pending).toHaveLength(1);
    await mocks.pending[0]();
    expect(mocks.handleInbound.mock.calls.map(([message]) => message.id)).toEqual(["wamid.1", "wamid.2"]);
    expect(mocks.handleInbound.mock.calls[0][0].text).toBe("Hello");
  });

  it("passes delivery receipts to the broadcast ledger, and still answers the messages", async () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { phone_number_id: "111" },
                statuses: [
                  { id: "wamid.a", status: "delivered", timestamp: "1761400002", recipient_id: "923001234567" },
                  { id: "wamid.b", status: "failed", timestamp: "1761400003", recipient_id: "923009999999", errors: [{ code: 131026, title: "Message undeliverable" }] },
                  { status: "read" },
                ],
                messages: [{ id: "wamid.3", from: "923001234567", timestamp: "1761400004", type: "text", text: { body: "Thanks" } }],
              },
            },
          ],
        },
      ],
    });
    mocks.applyStatusUpdate.mockRejectedValueOnce(new Error("ledger down"));
    const res = await deliver(body, signBody(body, SECRET));
    expect(res.status).toBe(200);
    expect(mocks.pending).toHaveLength(1);
    await mocks.pending[0]();
    // The first receipt threw: the second is skipped, the customer's message is still answered.
    expect(mocks.applyStatusUpdate.mock.calls).toEqual([["wamid.a", "delivered", undefined]]);
    expect(mocks.handleInbound.mock.calls.map(([message]) => message.id)).toEqual(["wamid.3"]);

    mocks.pending.length = 0;
    mocks.applyStatusUpdate.mockClear();
    mocks.handleInbound.mockClear();
    await deliver(body, signBody(body, SECRET));
    await mocks.pending[0]();
    expect(mocks.applyStatusUpdate.mock.calls).toEqual([
      ["wamid.a", "delivered", undefined],
      ["wamid.b", "failed", "Message undeliverable"],
    ]);
    expect(mocks.handleInbound).toHaveBeenCalledTimes(1);
  });

  it("acknowledges a signed body that is not JSON, so Meta stops resending it", async () => {
    const res = await deliver("{not json", signBody("{not json", SECRET));
    expect(res.status).toBe(200);
    expect(mocks.pending).toHaveLength(0);
  });
});

describe("the Setup page's live tests against this webhook", () => {
  // Route the probes' fetch calls straight into the route handlers.
  function serve() {
    const calls: Array<{ method: string; headers: Headers }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const request = new NextRequest(input.toString().replace(/\/webhook(\?|$)/, "/api/whatsapp/webhook$1"), init as never);
        calls.push({ method: request.method, headers: request.headers });
        return request.method === "POST" ? POST(request) : GET(request);
      })
    );
    return calls;
  }

  it("passes the callback and signature checks when this page and the webhook agree", async () => {
    const calls = serve();
    const settings = use({ WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_APP_SECRET: SECRET });
    const callback = await checkCallback({ ...settings, webhookUrl: "https://bitsolmarketing.com/webhook" });
    expect(callback.status).toBe("ok");
    const signature = await checkSignature({ ...settings, webhookUrl: "https://bitsolmarketing.com/webhook" }, true);
    expect(signature.status).toBe("ok");

    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "POST"]);
    expect(calls.every((call) => call.headers.get(SELF_TEST_HEADER) === SELF_TEST_VALUE)).toBe(true);
    // Tests leave nothing in the activity log, and the empty test delivery handles nothing.
    expect(actions()).toEqual([]);
    for (const task of mocks.pending) await task();
    expect(mocks.handleInbound).not.toHaveBeenCalled();
  });

  it("reports a webhook that holds a different verify token or app secret", async () => {
    serve();
    const page = use({ WHATSAPP_VERIFY_TOKEN: "this-page", WHATSAPP_APP_SECRET: "ffffffffffffffffffffffffffffffff" });
    const pageSettings = { ...page, webhookUrl: "https://bitsolmarketing.com/webhook" };
    use({ WHATSAPP_VERIFY_TOKEN: VERIFY, WHATSAPP_APP_SECRET: SECRET });

    const callback = await checkCallback(pageSettings);
    expect(callback.status).toBe("fail");
    expect(callback.detail).toMatch(/different verify token/);

    const signature = await checkSignature(pageSettings, true);
    expect(signature.status).toBe("fail");
    expect(signature.detail).toMatch(/holds a different one/);
    expect(actions()).toEqual([]);
  });
});
