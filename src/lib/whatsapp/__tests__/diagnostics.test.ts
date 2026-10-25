import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  verifiedAt: null as Date | null,
  failedAt: null as Date | null,
  lastInboundAt: null as Date | null,
  rejected: 0,
  fail: false,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    activityLog: {
      findFirst: vi.fn(async ({ where }: { where: { action: string } }) => {
        if (db.fail) throw new Error("database down");
        const at = where.action === "whatsapp.webhook.verified" ? db.verifiedAt : db.failedAt;
        return at ? { createdAt: at } : null;
      }),
      count: vi.fn(async () => db.rejected),
    },
    whatsappContact: {
      findFirst: vi.fn(async () => (db.lastInboundAt ? { lastInboundAt: db.lastInboundAt } : null)),
    },
  },
}));

import { signBody } from "../client";
import {
  checkApp,
  checkCallback,
  checkInbound,
  checkPhone,
  checkReplies,
  checkSignature,
  checkSubscription,
  checkToken,
  checkVerified,
  runWhatsAppChecks,
  subscribeApp,
  webhookHistory,
} from "../diagnostics";
import { WHATSAPP_KEYS, type SettingSource, type WhatsAppKey } from "../fields";
import { SELF_TEST_HEADER } from "../self-test";
import { buildSettings, type WhatsAppSettings } from "../settings";

const APP_ID = "1234567890";
const SECRET = "0123456789abcdef0123456789abcdef";
const TOKEN = `EAAG${"t".repeat(120)}`;
const WEBHOOK = "https://bitsolmarketing.com/webhook";

function settings(given: Partial<Record<WhatsAppKey, string>> = {}, webhookUrl = WEBHOOK): WhatsAppSettings {
  const values = Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, given[key] ?? ""])) as Record<WhatsAppKey, string>;
  const sources = Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, values[key] ? "panel" : "none"])) as Record<WhatsAppKey, SettingSource>;
  return { ...buildSettings(values, sources), webhookUrl };
}

const FULL = {
  WHATSAPP_APP_ID: APP_ID,
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_PHONE_ID: "109876543210",
  WHATSAPP_WABA_ID: "200000000000001",
  WHATSAPP_TOKEN: TOKEN,
  WHATSAPP_VERIFY_TOKEN: "verify-me",
};

type Reply = { status?: number; json?: unknown; text?: string; headers?: Record<string, string> } | Error;
type Seen = { url: URL; method: string; headers: Headers; body?: string };

/** A fake network: each handler matches a URL and answers it. */
function network(handler: (request: Seen) => Reply | undefined) {
  const seen: Seen[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const request: Seen = { url: new URL(input.toString()), method: init.method ?? "GET", headers: new Headers(init.headers), body: init.body as string | undefined };
      seen.push(request);
      const reply = handler(request);
      if (reply instanceof Error) throw reply;
      if (!reply) throw new Error(`unexpected request to ${request.url}`);
      const body = reply.text ?? JSON.stringify(reply.json ?? {});
      return new Response(body, { status: reply.status ?? 200, headers: reply.headers });
    })
  );
  return seen;
}

const graphError = (message: string, code = 190, status = 400): Reply => ({ status, json: { error: { message, code } } });

beforeEach(() => {
  Object.assign(db, { verifiedAt: null, failedAt: null, lastInboundAt: null, rejected: 0, fail: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App ID and secret", () => {
  it("fails without a secret and asks for the App ID to check one", async () => {
    expect((await checkApp(settings())).status).toBe("fail");
    expect((await checkApp(settings({ WHATSAPP_APP_SECRET: SECRET }))).status).toBe("warn");
  });

  it("asks Meta with the app token, in the header", async () => {
    const seen = network(() => ({ json: { id: APP_ID, name: "BITSOL Assistant" } }));
    const check = await checkApp(settings(FULL));
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("BITSOL Assistant");
    expect(seen[0].url.pathname).toBe(`/v23.0/${APP_ID}`);
    expect(seen[0].url.search).not.toContain(SECRET);
    expect(seen[0].headers.get("authorization")).toBe(`Bearer ${APP_ID}|${SECRET}`);
  });

  it("fails when Meta refuses the pair, and only warns when Meta cannot be reached", async () => {
    network(() => graphError("Error validating client secret.", 101));
    const refused = await checkApp(settings(FULL));
    expect(refused.status).toBe("fail");
    expect(refused.detail).toContain("Error validating client secret.");

    network(() => new TypeError("fetch failed"));
    const offline = await checkApp(settings(FULL));
    expect(offline.status).toBe("warn");
    expect(offline.detail).toContain("cannot reach graph.facebook.com");
  });
});

describe("Access token", () => {
  const debug = (data: Record<string, unknown>) => network((request) => (request.url.pathname.endsWith("/debug_token") ? { json: { data } } : undefined));

  it("passes a never-expiring System User token with both permissions, and learns its WhatsApp accounts", async () => {
    const seen = debug({
      app_id: APP_ID,
      application: "BITSOL Assistant",
      type: "SYSTEM_USER",
      is_valid: true,
      expires_at: 0,
      scopes: ["whatsapp_business_messaging", "whatsapp_business_management"],
      granular_scopes: [
        { scope: "whatsapp_business_messaging", target_ids: ["200000000000001"] },
        { scope: "whatsapp_business_management", target_ids: ["200000000000001"] },
        { scope: "business_management", target_ids: ["999"] },
      ],
    });
    const { check, facts } = await checkToken(settings(FULL));
    expect(check.status).toBe("ok");
    expect(check.detail).toContain("never expires");
    expect(facts.wabaIds).toEqual(["200000000000001"]);
    expect(seen[0].url.searchParams.get("input_token")).toBe(TOKEN);
    expect(seen[0].headers.get("authorization")).toBe(`Bearer ${APP_ID}|${SECRET}`);
  });

  it("fails a token that cannot send, and warns about one that expires", async () => {
    debug({ type: "USER", is_valid: true, scopes: ["whatsapp_business_management"], expires_at: Math.floor(Date.now() / 1000) + 3 * 3600 });
    const { check } = await checkToken(settings(FULL));
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("cannot send WhatsApp messages");
    expect(check.detail).toContain("expires in 3 hours");
    expect(check.fix).toContain("whatsapp_business_messaging");
  });

  it("fails a token Meta says no longer works", async () => {
    debug({ is_valid: false, error: { code: 190, message: "Session has expired." }, scopes: [] });
    const { check } = await checkToken(settings(FULL));
    expect(check.status).toBe("fail");
    expect(check.detail).toBe("Meta says this token no longer works: Session has expired.");
  });

  it("warns about a token made in another app", async () => {
    debug({ app_id: "5555", application: "Old test app", type: "SYSTEM_USER", is_valid: true, scopes: ["whatsapp_business_messaging", "whatsapp_business_management"] });
    const { check } = await checkToken(settings(FULL));
    expect(check.status).toBe("warn");
    expect(check.detail).toContain("Old test app");
  });

  it("uses the token itself when no app details are saved", async () => {
    const seen = network(() => graphError("(#100) The App_id in the input_token did not match the Viewing App", 100));
    const { check } = await checkToken(settings({ WHATSAPP_TOKEN: TOKEN }));
    expect(check.status).toBe("warn");
    expect(check.fix).toContain("Add the App ID and app secret");
    expect(seen[0].headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
  });
});

describe("Phone number", () => {
  it("reports the number Meta opens with these details", async () => {
    network(() => ({ json: { display_phone_number: "+92 310 3175175", verified_name: "BITSOL Marketing", quality_rating: "GREEN", status: "CONNECTED", platform_type: "CLOUD_API" } }));
    const check = await checkPhone(settings(FULL));
    expect(check.status).toBe("ok");
    expect(check.detail).toBe("+92 310 3175175 · BITSOL Marketing · quality green.");
  });

  it("warns about a number not registered for the Cloud API", async () => {
    network(() => ({ json: { display_phone_number: "+92 310 3175175", verified_name: "BITSOL", status: "PENDING", platform_type: "NOT_APPLICABLE" } }));
    const check = await checkPhone(settings(FULL));
    expect(check.status).toBe("warn");
    expect(check.fix).toContain("6-digit PIN");
  });

  it("fails an unknown phone number ID", async () => {
    network(() => graphError("Unsupported get request.", 100));
    const check = await checkPhone(settings(FULL));
    expect(check.status).toBe("fail");
    expect(check.detail).toContain("does not know this phone number ID");
  });
});

describe("Callback URL", () => {
  const answer = (reply: Reply | ((url: URL) => Reply)) =>
    network((request) => (request.url.origin + request.url.pathname === WEBHOOK ? (typeof reply === "function" ? reply(request.url) : reply) : undefined));

  it("needs a verify token first", async () => {
    expect((await checkCallback(settings({ WHATSAPP_APP_SECRET: SECRET }))).status).toBe("fail");
  });

  it("passes when the address echoes Meta's challenge, and marks itself as a test", async () => {
    const seen = answer((url) => ({ text: url.searchParams.get("hub.challenge") ?? "" }));
    const check = await checkCallback(settings(FULL));
    expect(check.status).toBe("ok");
    expect(seen[0].url.searchParams.get("hub.mode")).toBe("subscribe");
    expect(seen[0].url.searchParams.get("hub.verify_token")).toBe("verify-me");
    expect(seen[0].headers.get(SELF_TEST_HEADER)).toBeTruthy();
  });

  it("explains each way the address can answer wrongly", async () => {
    const cases: Array<[Reply, RegExp]> = [
      [{ status: 404, text: "<html>Not found</html>" }, /no webhook at/],
      [{ status: 403, text: "Forbidden" }, /different verify token/],
      [{ status: 403, text: "<html>Access denied by firewall</html>" }, /unexpected answer \(HTTP 403\)/],
      [{ status: 500, text: "Webhook not configured" }, /has no verify token yet/],
      [{ status: 301, text: "", headers: { location: "https://www.bitsolmarketing.com/webhook" } }, /redirects to https:\/\/www\.bitsolmarketing\.com\/webhook/],
      [{ status: 200, text: "<html>home page</html>" }, /unexpected answer \(HTTP 200\)/],
      [new TypeError("fetch failed"), /could not be reached from this server/],
    ];
    for (const [reply, detail] of cases) {
      answer(reply);
      const check = await checkCallback(settings(FULL));
      expect(check.status, String(detail)).toBe("fail");
      expect(check.detail).toMatch(detail);
    }
  });

  it("only warns about an address Meta cannot call", async () => {
    network((request) => ({ text: request.url.searchParams.get("hub.challenge") ?? "" }));
    const check = await checkCallback(settings(FULL, "http://localhost:3000/webhook"));
    expect(check.status).toBe("warn");
  });
});

describe("Signature check", () => {
  it("waits for the callback URL, but fails at once without an app secret", async () => {
    expect((await checkSignature(settings(FULL), false)).status).toBe("skip");
    expect((await checkSignature(settings({ WHATSAPP_VERIFY_TOKEN: "x" }), true)).status).toBe("fail");
  });

  it("signs the test delivery exactly as Meta does", async () => {
    const seen = network((request) => {
      const good = request.headers.get("x-hub-signature-256") === signBody(request.body ?? "", SECRET);
      return { status: good ? 200 : 401, text: good ? "OK" : "Invalid signature" };
    });
    const check = await checkSignature(settings(FULL), true);
    expect(check.status).toBe("ok");
    expect(seen).toHaveLength(2);
    expect(seen.every((request) => request.method === "POST" && request.headers.get(SELF_TEST_HEADER))).toBe(true);
  });

  it("fails when the site holds another secret or checks nothing", async () => {
    network(() => ({ status: 401, text: "Invalid signature" }));
    expect((await checkSignature(settings(FULL), true)).detail).toMatch(/holds a different one/);
    network(() => ({ status: 200, text: "OK" }));
    expect((await checkSignature(settings(FULL), true)).detail).toMatch(/accepted a delivery with a wrong signature/);
  });
});

describe("Webhook subscription", () => {
  const apps = (data: unknown[]) => network(() => ({ json: { data } }));

  it("passes when the saved app receives the account's messages", async () => {
    const seen = apps([{ whatsapp_business_api_data: { id: APP_ID, name: "BITSOL Assistant" } }]);
    const check = await checkSubscription(settings(FULL), { wabaIds: [] });
    expect(check.status).toBe("ok");
    expect(seen[0].url.pathname).toBe("/v23.0/200000000000001/subscribed_apps");
    expect(seen[0].headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("offers to subscribe when no app, or another app, receives them", async () => {
    apps([]);
    const none = await checkSubscription(settings(FULL), { wabaIds: [] });
    expect(none).toMatchObject({ status: "fail", canSubscribe: true });

    apps([{ whatsapp_business_api_data: { id: "777", name: "Someone else" } }]);
    const other = await checkSubscription(settings(FULL), { wabaIds: [] });
    expect(other).toMatchObject({ status: "fail", canSubscribe: true });
    expect(other.detail).toContain("Someone else");
  });

  it("finds the account from the token when no account ID is saved", async () => {
    const seen = apps([{ whatsapp_business_api_data: { id: APP_ID, name: "BITSOL Assistant" } }]);
    const withoutWaba = { ...FULL, WHATSAPP_WABA_ID: "" };
    await checkSubscription(settings(withoutWaba), { wabaIds: ["300000000000003"] });
    expect(seen[0].url.pathname).toBe("/v23.0/300000000000003/subscribed_apps");
    expect((await checkSubscription(settings(withoutWaba), { wabaIds: [] })).status).toBe("warn");
  });

  it("subscribes the token's app", async () => {
    const seen = network(() => ({ json: { success: true } }));
    const result = await subscribeApp(settings(FULL));
    expect(result.ok).toBe(true);
    expect(seen[0].method).toBe("POST");

    network(() => graphError("(#200) Permissions error", 200, 403));
    expect(await subscribeApp(settings(FULL))).toEqual({ ok: false, message: "Meta refused: (#200) Permissions error." });
  });
});

describe("history and replies", () => {
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

  it("reads what Meta has done from the activity log", async () => {
    db.verifiedAt = hoursAgo(2);
    db.lastInboundAt = hoursAgo(1);
    const history = await webhookHistory();
    expect(checkVerified(history).status).toBe("ok");
    expect(checkInbound(history).status).toBe("ok");
  });

  it("flags a later verification with a different token", async () => {
    db.verifiedAt = hoursAgo(5);
    db.failedAt = hoursAgo(1);
    expect(checkVerified(await webhookHistory()).status).toBe("fail");
  });

  it("flags deliveries refused for a bad signature", async () => {
    db.rejected = 3;
    const check = checkInbound(await webhookHistory());
    expect(check.status).toBe("fail");
    expect(check.detail).toMatch(/^3 deliveries were refused/);
  });

  it("asks for a first verification and a first message", async () => {
    const history = await webhookHistory();
    expect(checkVerified(history).status).toBe("warn");
    expect(checkInbound(history).status).toBe("warn");
  });

  it("skips both when the database cannot be read", async () => {
    db.fail = true;
    const history = await webhookHistory();
    expect(history).toBeNull();
    expect(checkVerified(history).status).toBe("skip");
  });

  it("reports whether the assistant replies", () => {
    expect(checkReplies(settings()).status).toBe("fail");
    expect(checkReplies(settings({ ...FULL, WHATSAPP_AUTO_REPLY: "false" })).status).toBe("warn");
    expect(checkReplies(settings(FULL)).status).toBe("ok");
  });
});

describe("all checks", () => {
  it("runs every check in setup order and sends no signed test to a site that refused the verify token", async () => {
    const seen = network((request) => {
      if (request.url.origin + request.url.pathname === WEBHOOK) return { status: 403, text: "Forbidden" };
      if (request.url.pathname.endsWith("/debug_token")) return { json: { data: { is_valid: true, type: "SYSTEM_USER", scopes: ["whatsapp_business_messaging", "whatsapp_business_management"] } } };
      if (request.url.pathname.endsWith("/subscribed_apps")) return { json: { data: [{ whatsapp_business_api_data: { id: APP_ID, name: "BITSOL" } }] } };
      if (request.url.pathname === `/v23.0/${APP_ID}`) return { json: { id: APP_ID, name: "BITSOL" } };
      return { json: { display_phone_number: "+92 310 3175175", verified_name: "BITSOL", status: "CONNECTED", platform_type: "CLOUD_API" } };
    });
    const checks = await runWhatsAppChecks(settings(FULL));
    expect(checks.map((check) => check.id)).toEqual(["app", "token", "phone", "callback", "signature", "verified", "subscription", "inbound", "replies"]);
    expect(checks.find((check) => check.id === "callback")?.status).toBe("fail");
    expect(checks.find((check) => check.id === "signature")?.status).toBe("skip");
    expect(seen.filter((request) => request.method === "POST")).toHaveLength(0);
  });

  it("never puts a secret in a result", async () => {
    network((request) => {
      if (request.url.origin + request.url.pathname === WEBHOOK) {
        return request.method === "GET" ? { text: request.url.searchParams.get("hub.challenge") ?? "" } : { status: 401, text: "Invalid signature" };
      }
      return graphError(`Invalid OAuth access token - Cannot parse access token`);
    });
    const text = JSON.stringify(await runWhatsAppChecks(settings(FULL)));
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("verify-me");
  });
});
