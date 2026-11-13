import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "../crypto";
import { issueState, readState, STATE_MAX_AGE } from "../oauth-state";
import { escapeLittleText, linkedInAuthUrl, versionCandidates } from "../linkedin";
import { facebookAuthUrl } from "../facebook";
import { buildPrompt, cleanCopy, countWords } from "../copy";
import { callbackUrl, platformFromSlug, providerError } from "../platforms";
import { SETUP_FIELDS, isSetupGroup, missingSetup, readSetupInput, type SocialConfig } from "../config";

const EMPTY: SocialConfig = {
  LINKEDIN_CLIENT_ID: "",
  LINKEDIN_CLIENT_SECRET: "",
  LINKEDIN_COMPANY_ID: "",
  FACEBOOK_APP_ID: "",
  FACEBOOK_APP_SECRET: "",
  GEMINI_API_KEY: "",
};

beforeEach(() => {
  vi.stubEnv("ADMIN_SECRET", "test-secret-for-social-module");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("token encryption", () => {
  it("round-trips a token and never stores it in the clear", () => {
    const stored = encryptSecret("AQX-linkedin-token-123");
    expect(stored).not.toContain("AQX-linkedin-token-123");
    expect(decryptSecret(stored)).toBe("AQX-linkedin-token-123");
  });

  it("produces a different ciphertext each time", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects a tampered value", () => {
    const [prefix, iv, tag, data] = encryptSecret("token").split(".");
    const flipped = data.startsWith("A") ? `B${data.slice(1)}` : `A${data.slice(1)}`;
    expect(() => decryptSecret([prefix, iv, tag, flipped].join("."))).toThrow();
  });

  it("cannot be read after ADMIN_SECRET changes", () => {
    const stored = encryptSecret("token");
    vi.stubEnv("ADMIN_SECRET", "a-different-secret");
    expect(() => decryptSecret(stored)).toThrow();
  });
});

describe("oauth state", () => {
  it("accepts the state it issued", () => {
    const { cookie, state } = issueState("LINKEDIN", "Owner (ADMIN)");
    expect(readState(cookie, state, "LINKEDIN")).toMatchObject({ platform: "LINKEDIN", actor: "Owner (ADMIN)" });
  });

  it("rejects a state from another flow, platform or browser", () => {
    const first = issueState("LINKEDIN", "Owner (ADMIN)");
    const second = issueState("LINKEDIN", "Owner (ADMIN)");
    expect(readState(first.cookie, second.state, "LINKEDIN")).toBeNull();
    expect(readState(first.cookie, first.state, "FACEBOOK")).toBeNull();
    expect(readState(undefined, first.state, "LINKEDIN")).toBeNull();
    expect(readState(first.cookie, null, "LINKEDIN")).toBeNull();
  });

  it("rejects a forged cookie", () => {
    const { cookie, state } = issueState("FACEBOOK", "Owner (ADMIN)");
    const [body] = cookie.split(".");
    expect(readState(`${body}.not-the-signature`, state, "FACEBOOK")).toBeNull();
  });

  it("expires", () => {
    vi.useFakeTimers();
    const { cookie, state } = issueState("LINKEDIN", "Owner (ADMIN)");
    vi.advanceTimersByTime((STATE_MAX_AGE + 5) * 1000);
    expect(readState(cookie, state, "LINKEDIN")).toBeNull();
  });
});

describe("linkedin", () => {
  it("escapes markup characters but keeps hashtags", () => {
    expect(escapeLittleText("Grow sales (fast) with AI_tools #Marketing #SEO2026")).toBe(
      "Grow sales \\(fast\\) with AI\\_tools #Marketing #SEO2026"
    );
    expect(escapeLittleText("We are # 1 @ 50% * [test] {x} <y> a|b ~c \\d")).toBe(
      "We are \\# 1 \\@ 50% \\* \\[test\\] \\{x\\} \\<y\\> a\\|b \\~c \\\\d"
    );
  });

  it("tries recent API versions newest first, starting a month back", () => {
    expect(versionCandidates(new Date("2026-09-29T12:00:00Z"))).toEqual(["202608", "202607", "202606", "202605", "202604", "202603"]);
    expect(versionCandidates(new Date("2027-02-10T12:00:00Z"))[0]).toBe("202701");
    expect(versionCandidates(new Date("2027-02-10T12:00:00Z"))[1]).toBe("202612");
  });

  it("uses the pinned API version when one is set", () => {
    vi.stubEnv("LINKEDIN_API_VERSION", "202607");
    expect(versionCandidates()).toEqual(["202607"]);
  });

  it("builds the authorization URL", () => {
    const config = { ...EMPTY, LINKEDIN_CLIENT_ID: "client123" };
    const url = new URL(linkedInAuthUrl(config, "state-abc", "https://bitsolmarketing.com/api/admin/social/linkedin/callback"));
    expect(url.origin + url.pathname).toBe("https://www.linkedin.com/oauth/v2/authorization");
    expect(url.searchParams.get("client_id")).toBe("client123");
    expect(url.searchParams.get("state")).toBe("state-abc");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toContain("w_organization_social");
    expect(url.searchParams.get("redirect_uri")).toBe("https://bitsolmarketing.com/api/admin/social/linkedin/callback");
  });
});

describe("facebook", () => {
  it("builds the authorization URL with the page permissions", () => {
    const config = { ...EMPTY, FACEBOOK_APP_ID: "app456" };
    const url = new URL(facebookAuthUrl(config, "state-xyz", "https://bitsolmarketing.com/api/admin/social/facebook/callback"));
    expect(url.hostname).toBe("www.facebook.com");
    expect(url.pathname).toMatch(/^\/v\d+\.\d+\/dialog\/oauth$/);
    expect(url.searchParams.get("client_id")).toBe("app456");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("scope")).toContain("pages_manage_posts");
  });
});

describe("platforms", () => {
  it("maps URL slugs to platforms", () => {
    expect(platformFromSlug("linkedin")).toBe("LINKEDIN");
    expect(platformFromSlug("Facebook")).toBe("FACEBOOK");
    expect(platformFromSlug("twitter")).toBeNull();
  });

  it("builds callback URLs", () => {
    expect(callbackUrl("https://bitsolmarketing.com", "FACEBOOK")).toBe("https://bitsolmarketing.com/api/admin/social/facebook/callback");
  });


  it("reads error messages from either provider's format", () => {
    expect(providerError(400, { error: { message: "Invalid OAuth access token." } })).toBe("HTTP 400 — Invalid OAuth access token.");
    expect(providerError(401, { error: "invalid_client", error_description: "Client authentication failed" })).toBe(
      "HTTP 401 — Client authentication failed"
    );
    expect(providerError(403, { message: "Not enough permissions", status: 403 })).toBe("HTTP 403 — Not enough permissions");
    expect(providerError(500, null)).toBe("HTTP 500");
  });
});

describe("app details", () => {
  it("lists what a platform still needs", () => {
    const config = { ...EMPTY, FACEBOOK_APP_ID: "app456", LINKEDIN_CLIENT_ID: "c", LINKEDIN_CLIENT_SECRET: "s" };
    expect(missingSetup("FACEBOOK", config).map((f) => f.key)).toEqual(["FACEBOOK_APP_SECRET"]);
    expect(missingSetup("LINKEDIN", config).map((f) => f.key)).toEqual(["LINKEDIN_COMPANY_ID"]);
    expect(missingSetup("AI", { ...EMPTY, GEMINI_API_KEY: "k" })).toEqual([]);
  });

  it("marks every secret as one", () => {
    const secrets = Object.values(SETUP_FIELDS).flat().filter((f) => f.secret).map((f) => f.key);
    expect(secrets.sort()).toEqual(["FACEBOOK_APP_SECRET", "GEMINI_API_KEY", "LINKEDIN_CLIENT_SECRET"]);
  });

  it("reads a submitted form, keeping what was left empty or unchanged", () => {
    const current = { ...EMPTY, FACEBOOK_APP_ID: "2230340401117627", FACEBOOK_APP_SECRET: "old-secret" };
    const form = (values: Record<string, string>) => (key: string) => values[key] ?? "";

    expect(readSetupInput("FACEBOOK", form({ FACEBOOK_APP_ID: "2230340401117627", FACEBOOK_APP_SECRET: " new-secret " }), current)).toEqual({
      changed: { FACEBOOK_APP_SECRET: "new-secret" },
    });
    expect(readSetupInput("FACEBOOK", form({ FACEBOOK_APP_ID: "2230340401117627" }), current)).toEqual({ error: "Nothing was changed." });
    expect(readSetupInput("LINKEDIN", form({ LINKEDIN_CLIENT_ID: "77abc", LINKEDIN_COMPANY_ID: "64600000" }), EMPTY)).toEqual({
      changed: { LINKEDIN_CLIENT_ID: "77abc", LINKEDIN_COMPANY_ID: "64600000" },
    });
  });

  it("refuses an id that is not a number", () => {
    const form = (values: Record<string, string>) => (key: string) => values[key] ?? "";
    expect(readSetupInput("FACEBOOK", form({ FACEBOOK_APP_ID: "12ab" }), EMPTY)).toEqual({
      error: "The App ID is a number, with no spaces or letters.",
    });
    expect(readSetupInput("LINKEDIN", form({ LINKEDIN_COMPANY_ID: "linkedin.com/company/646" }), EMPTY)).toHaveProperty("error");
  });

  it("recognises only its own groups", () => {
    expect(isSetupGroup("LINKEDIN")).toBe(true);
    expect(isSetupGroup("AI")).toBe(true);
    expect(isSetupGroup("TWITTER")).toBe(false);
  });
});

describe("post copy", () => {
  it("asks for about 100 words and forbids invented facts and links", () => {
    const prompt = buildPrompt({ audience: "LinkedIn", subject: "Local SEO for shops", details: "A short guide." });
    expect(prompt).toContain("90 to 110 words");
    expect(prompt).toContain("Do not invent statistics");
    expect(prompt).toContain("Do not include a link");
    expect(prompt).toContain("Subject: Local SEO for shops");
    expect(prompt).toContain("Background: A short guide.");
  });

  it("strips code fences, quotes and bold markers", () => {
    expect(cleanCopy('```\n"A **strong** opening line.\n\n\n\n#SEO #Pakistan"\n```')).toBe("A strong opening line.\n\n#SEO #Pakistan");
  });

  it("counts words without the hashtags", () => {
    expect(countWords("Five words in this line\n\n#SEO #Pakistan #Marketing")).toBe(5);
  });
});
