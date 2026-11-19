import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  EMPTY_STATE,
  MAX_HISTORY,
  SERVICE_ANGLES,
  TIP_THEMES,
  buildAutopilotPrompt,
  isDue,
  nextRunAfter,
  parseSettings,
  parseState,
  pickArticle,
  pickFormat,
  pickService,
  pickSource,
  pickTipTheme,
  readAutopilotAnswer,
  recentTips,
  remember,
  rescheduleOnSave,
  type HistoryEntry,
} from "../autopilot-plan";

const at = "2026-11-19T10:00:00.000Z";
const entry = (e: Partial<HistoryEntry>): HistoryEntry => ({ source: "TIP", key: "x:y", format: "tips", at, ...e });

const POST = `Most shops lose customers in the first hour of silence.

When a customer messages you on WhatsApp, they are ready to buy. Every hour without an answer cools that interest, and many simply ask the next shop.

1. Turn on a greeting message so nobody waits in silence.
2. Save quick replies for prices, timings and delivery.
3. Check messages at fixed times, even on busy days.

Small habits like these make a shop feel reliable, and reliable shops get recommended to friends and family.

How quickly does your business reply today?

#WhatsAppBusiness #SmallBusiness #CustomerService`;

describe("autopilot settings", () => {
  it("defaults to the owner's choice, switched off", () => {
    expect(DEFAULT_SETTINGS).toEqual({ enabled: false, intervalHours: 2, sources: ["ARTICLE", "SERVICE", "TIP"], withImage: true });
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps only valid values", () => {
    expect(parseSettings({ enabled: true, intervalHours: 5, sources: ["TIP", "NEWS"], withImage: false })).toEqual({
      enabled: true,
      intervalHours: 2,
      sources: ["TIP"],
      withImage: false,
    });
    expect(parseSettings({ intervalHours: 6, sources: [] }).sources).toEqual(["ARTICLE", "SERVICE", "TIP"]);
    expect(parseSettings({ intervalHours: "12" }).intervalHours).toBe(12);
  });

  it("reads a damaged state as empty", () => {
    expect(parseState("nonsense")).toEqual(EMPTY_STATE);
    expect(parseState({ history: [null, { key: "a", source: "TIP" }], turn: 2.5 }).history).toHaveLength(1);
  });
});

describe("autopilot timing", () => {
  const on = { ...DEFAULT_SETTINGS, enabled: true };
  const now = new Date(at);

  it("is due when on and the slot has come", () => {
    expect(isDue(on, EMPTY_STATE, now)).toBe(true);
    expect(isDue(DEFAULT_SETTINGS, EMPTY_STATE, now)).toBe(false);
    expect(isDue(on, { ...EMPTY_STATE, nextRunAt: "2026-11-19T10:00:01.000Z" }, now)).toBe(false);
    expect(isDue(on, { ...EMPTY_STATE, nextRunAt: "2026-11-19T09:59:59.000Z" }, now)).toBe(true);
  });

  it("schedules one interval later", () => {
    expect(nextRunAfter(now, 2).toISOString()).toBe("2026-11-19T12:00:00.000Z");
  });

  it("posts right away when switched on, and keeps the rhythm when only the interval changes", () => {
    expect(rescheduleOnSave(DEFAULT_SETTINGS, on, EMPTY_STATE, now)).toBe(at);
    const ranAt = { ...EMPTY_STATE, lastRunAt: "2026-11-19T09:30:00.000Z", nextRunAt: "2026-11-19T11:30:00.000Z" };
    expect(rescheduleOnSave(on, { ...on, intervalHours: 4 }, ranAt, now)).toBe("2026-11-19T13:30:00.000Z");
    expect(rescheduleOnSave(on, { ...on, intervalHours: 1 }, { ...ranAt, lastRunAt: "2026-11-19T08:00:00.000Z" }, now)).toBe(at);
    expect(rescheduleOnSave(on, DEFAULT_SETTINGS, ranAt, now)).toBe(ranAt.nextRunAt);
  });

  it("keeps a bounded history, newest first", () => {
    let history: HistoryEntry[] = [];
    for (let i = 0; i < MAX_HISTORY + 5; i++) history = remember(history, entry({ key: `t:${i}` }));
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].key).toBe(`t:${MAX_HISTORY + 4}`);
  });
});

describe("autopilot subjects", () => {
  it("takes the kinds of subject in turn", () => {
    const sources = ["ARTICLE", "SERVICE", "TIP"] as const;
    expect([0, 1, 2, 3].map((turn) => pickSource([...sources], turn))).toEqual(["ARTICLE", "SERVICE", "TIP", "ARTICLE"]);
    expect(pickSource(["TIP"], 7)).toBe("TIP");
  });

  it("posts the newest article not posted yet, then the one posted longest ago", () => {
    const articles = ["new", "middle", "old"].map((slug) => ({ slug, title: slug, excerpt: null, image: null }));
    expect(pickArticle(articles, [])?.slug).toBe("new");
    expect(pickArticle(articles, [entry({ source: "ARTICLE", key: "new" })])?.slug).toBe("middle");
    const all = [entry({ source: "ARTICLE", key: "middle" }), entry({ source: "ARTICLE", key: "old" }), entry({ source: "ARTICLE", key: "new" })];
    expect(pickArticle(articles, all)?.slug).toBe("new");
    expect(pickArticle([], [])).toBeNull();
  });

  it("moves through services and their angles", () => {
    const services = [{ slug: "web", title: "Web" }, { slug: "apps", title: "Apps" }];
    const first = pickService(services, []);
    expect(first).toEqual({ service: services[0], angle: SERVICE_ANGLES[0] });
    const second = pickService(services, [entry({ source: "SERVICE", key: `web:${SERVICE_ANGLES[0]}` })]);
    expect(second?.service.slug).toBe("apps");
    const third = pickService(services, [
      entry({ source: "SERVICE", key: `apps:${SERVICE_ANGLES[0]}` }),
      entry({ source: "SERVICE", key: `web:${SERVICE_ANGLES[0]}` }),
    ]);
    expect(third).toEqual({ service: services[0], angle: SERVICE_ANGLES[1] });
  });

  it("rotates tip themes and remembers recent tips", () => {
    expect(pickTipTheme([])).toBe(TIP_THEMES[0]);
    expect(pickTipTheme([entry({ key: `${TIP_THEMES[0]}:Reply within an hour` })])).toBe(TIP_THEMES[1]);
    expect(recentTips([entry({ key: `${TIP_THEMES[0]}:Reply within an hour` }), entry({ source: "ARTICLE", key: "slug" })])).toEqual([
      "Reply within an hour",
    ]);
  });

  it("does not use the same style twice in a row", () => {
    expect(pickFormat([])).toBe("tips");
    expect(pickFormat([entry({ format: "tips" })])).toBe("mistake");
  });
});

describe("autopilot writing", () => {
  it("asks for a hook, short lines, a question and no invented facts", () => {
    const prompt = buildAutopilotPrompt({
      source: "TIP",
      format: "myth",
      subject: "one practical tip about email marketing",
      instruction: "Teach one tip.",
      avoid: ["Clean your list"],
      hasLink: false,
    });
    expect(prompt).toContain("Hook: one line of at most 12 words");
    expect(prompt).toContain("Never invent statistics");
    expect(prompt).toContain("One short question that invites the reader to comment");
    expect(prompt).toContain("110 to 160 words");
    expect(prompt).toContain("a popular myth, the reality");
    expect(prompt).toContain("starts with TOPIC:");
    expect(prompt).toContain("Already posted, so choose a different tip: Clean your list");
  });

  it("separates the topic line from the post", () => {
    const read = readAutopilotAnswer(`TOPIC: Reply to WhatsApp within an hour.\n\n${POST}`, "TIP");
    expect(read).toEqual({ ok: true, topic: "Reply to WhatsApp within an hour", post: POST });
    expect(readAutopilotAnswer(POST, "ARTICLE")).toMatchObject({ ok: true, topic: "" });
  });

  it("removes the prompt's part names when a model copies them", () => {
    const labelled = POST.replace("Most shops", "Hook: Most shops").replace("How quickly", "Question: How quickly");
    expect(readAutopilotAnswer(labelled, "ARTICLE")).toMatchObject({ ok: true, post: POST });
  });

  it("refuses made-up figures and clichés in the hook", () => {
    expect(readAutopilotAnswer(`A 3-second delay can cost you half the traffic.\n\n${POST}`, "ARTICLE")).toEqual({
      ok: false,
      problem: "puts a figure on results",
    });
    expect(readAutopilotAnswer(POST.replace("reliable", "40% more reliable"), "ARTICLE")).toMatchObject({ ok: false });
    expect(readAutopilotAnswer(`Boost your sales with WhatsApp\n\n${POST}`, "ARTICLE")).toEqual({
      ok: false,
      problem: 'the first line uses "boost"',
    });
    // Ordinary numbers are fine.
    expect(readAutopilotAnswer(POST.replace("at fixed times", "at 10 AM and 4 PM"), "ARTICLE")).toMatchObject({ ok: true });
  });

  it("refuses answers that should not be posted", () => {
    expect(readAutopilotAnswer(POST, "TIP")).toEqual({ ok: false, problem: "no TOPIC line" });
    expect(readAutopilotAnswer(`Here is your post:\n${POST}`, "ARTICLE")).toEqual({ ok: false, problem: "starts with a preamble" });
    expect(readAutopilotAnswer(`${POST}\nhttps://bitsolmarketing.com`, "ARTICLE")).toEqual({ ok: false, problem: "contains a link" });
    expect(readAutopilotAnswer("Too short to post.", "ARTICLE")).toMatchObject({ ok: false });
  });
});
