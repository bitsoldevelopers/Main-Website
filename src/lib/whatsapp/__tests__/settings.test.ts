import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory SiteSetting table.
const db = vi.hoisted(() => ({ rows: new Map<string, string>(), fail: false }));

vi.mock("@/lib/prisma", () => {
  const siteSetting = {
    findMany: vi.fn(async ({ where }: { where: { key: { startsWith: string } } }) => {
      if (db.fail) throw new Error("Can't reach database server at `localhost:3306`\nmore detail");
      return [...db.rows].filter(([key]) => key.startsWith(where.key.startsWith)).map(([key, value]) => ({ key, value }));
    }),
    upsert: vi.fn(async ({ where, update, create }: { where: { key: string }; update: { value: string }; create: { value: string } }) => {
      db.rows.set(where.key, db.rows.has(where.key) ? update.value : create.value);
      return {};
    }),
    deleteMany: vi.fn(async ({ where }: { where: { key: { startsWith: string } } }) => {
      let count = 0;
      for (const key of [...db.rows.keys()]) {
        if (key.startsWith(where.key.startsWith)) {
          db.rows.delete(key);
          count++;
        }
      }
      return { count };
    }),
  };
  return { prisma: { siteSetting, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) } };
});

import { config } from "@/lib/config";
import { encryptSecret } from "@/lib/admin/social/crypto";
import { WHATSAPP_KEYS, readWhatsAppInput, type DetailKey, type SettingSource, type WhatsAppKey } from "../fields";
import {
  buildSettings,
  clearWhatsAppSettings,
  getWhatsAppSettings,
  invalidateWhatsAppSettings,
  newVerifyToken,
  saveWhatsAppSettings,
} from "../settings";

const TOKEN = `EAAG${"x".repeat(120)}`;
const SECRET = "0123456789abcdef0123456789abcdef";

function values(given: Partial<Record<WhatsAppKey, string>> = {}): Record<WhatsAppKey, string> {
  return Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, given[key] ?? ""])) as Record<WhatsAppKey, string>;
}

function sources(given: Record<WhatsAppKey, string>): Record<WhatsAppKey, SettingSource> {
  return Object.fromEntries(WHATSAPP_KEYS.map((key) => [key, given[key] ? "panel" : "none"])) as Record<WhatsAppKey, SettingSource>;
}

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-for-whatsapp-settings");
  for (const key of WHATSAPP_KEYS) vi.stubEnv(key, "");
  db.rows.clear();
  db.fail = false;
  invalidateWhatsAppSettings();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildSettings", () => {
  it("can send only with a phone number ID and a token", () => {
    expect(buildSettings(values({ WHATSAPP_PHONE_ID: "123456789" }), sources(values())).enabled).toBe(false);
    const both = values({ WHATSAPP_PHONE_ID: "123456789", WHATSAPP_TOKEN: TOKEN });
    expect(buildSettings(both, sources(both)).enabled).toBe(true);
  });

  it("can receive only with a verify token and the app secret", () => {
    const tokenOnly = values({ WHATSAPP_VERIFY_TOKEN: "abc" });
    expect(buildSettings(tokenOnly, sources(tokenOnly)).webhookReady).toBe(false);
    const both = values({ WHATSAPP_VERIFY_TOKEN: "abc", WHATSAPP_APP_SECRET: SECRET });
    expect(buildSettings(both, sources(both)).webhookReady).toBe(true);
  });

  it("replies unless replies are switched off", () => {
    for (const off of ["false", "0", "off", "no", "FALSE"]) {
      expect(buildSettings(values({ WHATSAPP_AUTO_REPLY: off }), sources(values())).autoReply).toBe(false);
    }
    for (const on of ["", "true", "1", "yes"]) {
      expect(buildSettings(values({ WHATSAPP_AUTO_REPLY: on }), sources(values())).autoReply).toBe(true);
    }
  });

  it("gives Meta the /webhook address of this site and defaults to Graph v23.0", () => {
    const settings = buildSettings(values(), sources(values()));
    expect(settings.webhookUrl).toBe(`${config.appUrl}/webhook`);
    expect(settings.apiVersion).toBe("v23.0");
    vi.stubEnv("WHATSAPP_API_VERSION", "v24.0");
    expect(buildSettings(values(), sources(values())).apiVersion).toBe("v24.0");
  });
});

describe("stored settings", () => {
  it("reads server variables when nothing is saved", async () => {
    vi.stubEnv("WHATSAPP_PHONE_ID", "111222333444");
    const settings = await getWhatsAppSettings({ fresh: true });
    expect(settings.phoneId).toBe("111222333444");
    expect(settings.sources.WHATSAPP_PHONE_ID).toBe("environment");
    expect(settings.sources.WHATSAPP_TOKEN).toBe("none");
  });

  it("stores values encrypted, and a saved value wins over a server variable", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "EAA-from-the-environment-0000000000000000000");
    await saveWhatsAppSettings({ WHATSAPP_TOKEN: TOKEN, WHATSAPP_PHONE_ID: "555666777888" });

    const stored = db.rows.get("whatsapp.WHATSAPP_TOKEN");
    expect(stored).toBeDefined();
    expect(stored).not.toContain(TOKEN);

    const settings = await getWhatsAppSettings();
    expect(settings.token).toBe(TOKEN);
    expect(settings.sources.WHATSAPP_TOKEN).toBe("panel");
    expect(settings.enabled).toBe(true);
  });

  it("does not save empty values", async () => {
    await saveWhatsAppSettings({ WHATSAPP_TOKEN: "", WHATSAPP_APP_ID: "123456789" });
    expect([...db.rows.keys()]).toEqual(["whatsapp.WHATSAPP_APP_ID"]);
  });

  it("caches briefly, and saving clears the cache at once", async () => {
    expect((await getWhatsAppSettings()).verifyToken).toBe("");
    db.rows.set("whatsapp.WHATSAPP_VERIFY_TOKEN", encryptSecret("written-behind-the-cache"));
    expect((await getWhatsAppSettings()).verifyToken).toBe("");
    await saveWhatsAppSettings({ WHATSAPP_APP_ID: "123456789" });
    expect((await getWhatsAppSettings()).verifyToken).toBe("written-behind-the-cache");
  });

  it("clears the cache for every copy of the module in the process", async () => {
    // Next.js loads this module separately for the Setup page and the webhook route.
    const first = await import("../settings");
    vi.resetModules();
    const second = await import("../settings");
    expect(second).not.toBe(first);

    expect((await second.getWhatsAppSettings()).verifyToken).toBe("");
    await first.saveWhatsAppSettings({ WHATSAPP_VERIFY_TOKEN: "generated-on-the-setup-page" });
    expect((await second.getWhatsAppSettings()).verifyToken).toBe("generated-on-the-setup-page");
  });

  it("ignores a value saved under a different ADMIN_SECRET", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "EAA-from-the-environment-0000000000000000000");
    await saveWhatsAppSettings({ WHATSAPP_TOKEN: TOKEN });
    vi.stubEnv("ADMIN_SECRET", "the-secret-was-rotated");
    const settings = await getWhatsAppSettings({ fresh: true });
    expect(settings.token).toBe("EAA-from-the-environment-0000000000000000000");
    expect(settings.sources.WHATSAPP_TOKEN).toBe("environment");
  });

  it("falls back to server variables when the database cannot be read", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "from-env");
    db.fail = true;
    const settings = await getWhatsAppSettings({ fresh: true });
    expect(settings.verifyToken).toBe("from-env");
    expect(settings.error).toBe("Can't reach database server at `localhost:3306`");
  });

  it("forgets every saved value, leaving server variables in force", async () => {
    vi.stubEnv("WHATSAPP_PHONE_ID", "111222333444");
    await saveWhatsAppSettings({ WHATSAPP_PHONE_ID: "999888777666", WHATSAPP_VERIFY_TOKEN: "abc" });
    expect(await clearWhatsAppSettings()).toBe(2);
    const settings = await getWhatsAppSettings();
    expect(settings.phoneId).toBe("111222333444");
    expect(settings.verifyToken).toBe("");
  });

  it("generates long random verify tokens", () => {
    const a = newVerifyToken();
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(newVerifyToken()).not.toBe(a);
  });
});

describe("readWhatsAppInput", () => {
  const current = { WHATSAPP_APP_ID: "", WHATSAPP_APP_SECRET: "", WHATSAPP_PHONE_ID: "", WHATSAPP_WABA_ID: "", WHATSAPP_TOKEN: "" };
  const read = (input: Partial<Record<DetailKey, string>>, now: Record<DetailKey, string> = current) =>
    readWhatsAppInput((key) => input[key] ?? "", now);

  it("strips the spaces and line breaks a paste brings along", () => {
    expect(read({ WHATSAPP_PHONE_ID: " 1234 5678 9012\n", WHATSAPP_TOKEN: `${TOKEN.slice(0, 50)}\n${TOKEN.slice(50)}` })).toEqual({
      changed: { WHATSAPP_PHONE_ID: "123456789012", WHATSAPP_TOKEN: TOKEN },
    });
  });

  it("keeps saved values when an input is left empty or unchanged", () => {
    expect(read({}, { ...current, WHATSAPP_TOKEN: TOKEN })).toEqual({ changed: {} });
    expect(read({ WHATSAPP_PHONE_ID: "123456789" }, { ...current, WHATSAPP_PHONE_ID: "123456789" })).toEqual({ changed: {} });
  });

  it("refuses values of the wrong shape", () => {
    expect(read({ WHATSAPP_PHONE_ID: "+92 300 1234567" })).toHaveProperty("error");
    expect(read({ WHATSAPP_WABA_ID: "abc123456" })).toHaveProperty("error");
    expect(read({ WHATSAPP_APP_SECRET: "not-a-secret" })).toHaveProperty("error");
    expect(read({ WHATSAPP_TOKEN: "short" })).toHaveProperty("error");
  });

  it("notices an app secret pasted where the token goes", () => {
    const result = read({ WHATSAPP_TOKEN: SECRET });
    expect(result).toEqual({ error: "That is an app secret, not an access token." });
  });

  it("accepts an app secret in either case", () => {
    expect(read({ WHATSAPP_APP_SECRET: SECRET.toUpperCase() })).toEqual({ changed: { WHATSAPP_APP_SECRET: SECRET.toUpperCase() } });
  });
});
