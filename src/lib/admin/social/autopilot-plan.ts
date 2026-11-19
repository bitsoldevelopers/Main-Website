/**
 * The planning half of the social autopilot: its settings, which subject and
 * style the next post gets, and the prompt that writes it. No database or
 * network here, so all of it is unit-tested; autopilot.ts does the work.
 */

export const AUTOPILOT_SOURCES = ["ARTICLE", "SERVICE", "TIP"] as const;
export type AutopilotSource = (typeof AUTOPILOT_SOURCES)[number];

export const SOURCE_LABEL: Record<AutopilotSource, string> = {
  ARTICLE: "Blog articles",
  SERVICE: "Our services",
  TIP: "Marketing & AI tips",
};

export const INTERVAL_CHOICES = [1, 2, 3, 4, 6, 8, 12, 24] as const;

export interface AutopilotSettings {
  enabled: boolean;
  intervalHours: number;
  sources: AutopilotSource[];
  withImage: boolean;
}

/**
 * The owner's choice on 19 Nov 2026: every 2 hours, day and night, all three
 * kinds of subject, with an image. Off until it is switched on in the panel.
 */
export const DEFAULT_SETTINGS: AutopilotSettings = {
  enabled: false,
  intervalHours: 2,
  sources: [...AUTOPILOT_SOURCES],
  withImage: true,
};

export function parseSettings(raw: unknown): AutopilotSettings {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof AutopilotSettings, unknown>>;
  const interval = Number(value.intervalHours);
  const sources = Array.isArray(value.sources)
    ? AUTOPILOT_SOURCES.filter((source) => (value.sources as unknown[]).includes(source))
    : DEFAULT_SETTINGS.sources;
  return {
    enabled: value.enabled === true,
    intervalHours: (INTERVAL_CHOICES as readonly number[]).includes(interval) ? interval : DEFAULT_SETTINGS.intervalHours,
    sources: sources.length > 0 ? sources : DEFAULT_SETTINGS.sources,
    withImage: value.withImage !== false,
  };
}

// ─── State ──────────────────────────────────────────────────────────────────

export interface HistoryEntry {
  source: AutopilotSource;
  /** Article slug, "service-slug:angle", or "theme:tip" for a tip. */
  key: string;
  format: string;
  at: string;
}

export interface AutopilotState {
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastResult: { at: string; ok: boolean; message: string } | null;
  /** Runs in a row in which nothing was published; three pause the autopilot. */
  failuresInARow: number;
  /** Counts runs, to take the subject kinds in turn. */
  turn: number;
  /** Newest first. */
  history: HistoryEntry[];
}

export const EMPTY_STATE: AutopilotState = {
  nextRunAt: null,
  lastRunAt: null,
  lastResult: null,
  failuresInARow: 0,
  turn: 0,
  history: [],
};

export const MAX_HISTORY = 120;
export const FAILURES_BEFORE_PAUSE = 3;

export function parseState(raw: unknown): AutopilotState {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<AutopilotState>;
  return {
    nextRunAt: typeof value.nextRunAt === "string" ? value.nextRunAt : null,
    lastRunAt: typeof value.lastRunAt === "string" ? value.lastRunAt : null,
    lastResult: value.lastResult && typeof value.lastResult.message === "string" ? value.lastResult : null,
    failuresInARow: Number.isInteger(value.failuresInARow) ? (value.failuresInARow as number) : 0,
    turn: Number.isInteger(value.turn) ? (value.turn as number) : 0,
    history: Array.isArray(value.history)
      ? value.history.filter((e): e is HistoryEntry => Boolean(e && typeof e.key === "string" && typeof e.source === "string"))
      : [],
  };
}

const HOUR_MS = 3_600_000;

export function isDue(settings: AutopilotSettings, state: AutopilotState, now: Date): boolean {
  if (!settings.enabled) return false;
  return !state.nextRunAt || new Date(state.nextRunAt).getTime() <= now.getTime();
}

export function nextRunAfter(from: Date, intervalHours: number): Date {
  return new Date(from.getTime() + intervalHours * HOUR_MS);
}

/**
 * When the next post goes out after the settings change: right away when the
 * autopilot was just switched on, otherwise one interval after the last post.
 */
export function rescheduleOnSave(before: AutopilotSettings, after: AutopilotSettings, state: AutopilotState, now: Date): string | null {
  if (!after.enabled) return state.nextRunAt;
  if (!before.enabled || !state.lastRunAt) return now.toISOString();
  const next = nextRunAfter(new Date(state.lastRunAt), after.intervalHours);
  return (next < now ? now : next).toISOString();
}

/** Adds a run to the history, newest first, keeping it short. */
export function remember(history: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...history].slice(0, MAX_HISTORY);
}

// ─── What the next post is about ────────────────────────────────────────────

export function pickSource(sources: AutopilotSource[], turn: number): AutopilotSource {
  return sources[((turn % sources.length) + sources.length) % sources.length];
}

/** How long ago (in history positions) a key was used: Infinity when never. */
function lastUsed(history: HistoryEntry[], match: (entry: HistoryEntry) => boolean): number {
  const index = history.findIndex(match);
  return index === -1 ? Infinity : index;
}

/** The item whose last use is oldest; ties go to the earlier item in the list. */
function leastRecent<T>(items: readonly T[], used: (item: T) => number): T {
  let best = items[0];
  let bestScore = used(best);
  for (const item of items.slice(1)) {
    const score = used(item);
    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

export interface ArticleCandidate {
  slug: string;
  title: string;
  excerpt: string | null;
  image: string | null;
}

/** Articles newest first: the newest one never posted, else the one posted longest ago. */
export function pickArticle<T extends ArticleCandidate>(articles: T[], history: HistoryEntry[]): T | null {
  if (articles.length === 0) return null;
  return leastRecent(articles, (a) => lastUsed(history, (e) => e.source === "ARTICLE" && e.key === a.slug));
}

export const SERVICE_ANGLES = [
  "a mistake businesses often make with it, and how to avoid it",
  "how a business owner can tell they need it now",
  "what a good result looks like and how to measure it",
  "three questions to ask before choosing a provider",
  "one quick win a business can try this week",
  "how it fits together with the rest of a business's marketing",
] as const;

export interface ServiceCandidate {
  slug: string;
  title: string;
}

/** The service used longest ago, with the angle it has gone longest without. */
export function pickService<T extends ServiceCandidate>(services: T[], history: HistoryEntry[]): { service: T; angle: string } | null {
  if (services.length === 0) return null;
  const isService = (slug: string) => (e: HistoryEntry) => e.source === "SERVICE" && e.key.startsWith(`${slug}:`);
  const service = leastRecent(services, (s) => lastUsed(history, isService(s.slug)));
  const angle = leastRecent(SERVICE_ANGLES, (a) => lastUsed(history, (e) => e.source === "SERVICE" && e.key === `${service.slug}:${a}`));
  return { service, angle };
}

export const TIP_THEMES = [
  "local SEO and the Google Business Profile",
  "WhatsApp marketing and replying to customers",
  "Facebook and Instagram marketing",
  "LinkedIn for business owners",
  "website speed and turning visitors into enquiries",
  "email marketing",
  "Google Ads on a small budget",
  "content marketing",
  "AI tools that save a small business time",
  "AI chatbots for customer service",
  "online reviews and reputation",
  "selling online and e-commerce",
  "branding for small businesses",
  "measuring marketing results",
] as const;

export function pickTipTheme(history: HistoryEntry[]): string {
  return leastRecent(TIP_THEMES, (theme) => lastUsed(history, (e) => e.source === "TIP" && e.key.startsWith(`${theme}:`)));
}

/** Tips already posted, newest first, so the AI can be told not to repeat them. */
export function recentTips(history: HistoryEntry[], count = 15): string[] {
  return history
    .filter((e) => e.source === "TIP")
    .slice(0, count)
    .map((e) => e.key.slice(e.key.indexOf(":") + 1))
    .filter(Boolean);
}

// ─── How it is written ──────────────────────────────────────────────────────

/**
 * Post styles, taken in turn so the feed does not read the same twice in a
 * row. Each says how the main part is built, because the models otherwise
 * shrink a "list" to a few bare words (seen with Llama 3.3 and 4, 19 Nov 2026).
 */
export const POST_FORMATS = {
  tips: "three practical tips as a numbered list (1., 2., 3.), each tip explained in one or two full sentences",
  mistake: "a common mistake, what it costs the business, and the fix, each in two or three sentences",
  myth: "a popular myth, the reality, and what to do instead, each in two or three sentences",
  steps: "a guide of three steps (1., 2., 3.) the reader can follow today, each step explained in one or two full sentences",
  question: "a question business owners often ask, answered plainly in two or three short paragraphs",
  checklist: "a checklist of three or four things to check this week, one per line, each with a sentence on why it matters",
} as const;
export type PostFormat = keyof typeof POST_FORMATS;

export function pickFormat(history: HistoryEntry[]): PostFormat {
  const formats = Object.keys(POST_FORMATS) as PostFormat[];
  return leastRecent(formats, (f) => lastUsed(history, (e) => e.format === f));
}

export interface PostBrief {
  source: AutopilotSource;
  format: PostFormat;
  /** What the post is about, in one line. */
  subject: string;
  /** What to do with the subject. */
  instruction: string;
  background?: string;
  /** Recent tips not to repeat (TIP only). */
  avoid?: string[];
  hasLink: boolean;
}

const TOPIC_LINE = "TOPIC:";

/** Filler the models reach for; it makes a feed read as machine-written. */
export const BANNED_PHRASES = [
  "boost",
  "unlock",
  "in today's",
  "crucial",
  "game-changer",
  "leverage",
  "elevate",
  "streamline",
  "digital landscape",
  "take your business to the next level",
  "as a business owner",
];

export function buildAutopilotPrompt(brief: PostBrief): string {
  const tip = brief.source === "TIP";
  const structure = [
    'Hook: one line of at most 12 words that makes a business owner stop scrolling. It must work on its own, because LinkedIn hides the rest behind "see more". Make it specific to this subject: a surprising truth, a costly mistake, a bold opinion, or a sharp question. Never a generic command like "Boost your business"',
    "Why it matters: two or three sentences about the reader's business",
    `The main part: ${POST_FORMATS[brief.format]}`,
    "Payoff: one sentence on what changes when they act on it",
    "One short question that invites the reader to comment",
    "A blank line, then 3 to 5 relevant hashtags on one line",
  ];
  const rules = [
    "110 to 160 words in total, not counting the hashtags. A post under 100 words is too short",
    "A blank line between paragraphs and between list items, so it reads easily on a phone",
    "Plain text: no markdown, no asterisks, no emojis",
    "Practical and specific: something the reader can use today. Write like a person talking to a shop or company owner, not like an advert",
    `Never use these worn phrases: ${BANNED_PHRASES.join(", ")}`,
    "Never invent statistics, prices, client names, results or quotes. Never put a number on results, losses, traffic or growth: no percentages, no \"half\", no \"twice as many\"",
    "Write only the post itself, without the part names above (no \"Hook:\", \"Payoff:\" and so on)",
    brief.hasLink ? "Do not write a link or web address: it is added under the post" : "Do not write a link or web address",
    tip
      ? `Before the post, write one line that starts with ${TOPIC_LINE} and names the tip in under 10 words`
      : "Reply with the post only, nothing before or after it",
  ];

  return `You write posts for the LinkedIn company page and the Facebook Page of BITSOL Marketing, a digital marketing and AI automation agency in Pakistan (bitsolmarketing.com). The readers are business owners and managers.

Write one post. ${brief.instruction}

Build it in this order:
${structure.map((part, i) => `${i + 1}. ${part}`).join("\n")}

Rules:
${rules.map((rule) => `- ${rule}`).join("\n")}

Subject: ${brief.subject}${brief.background ? `\nBackground: ${brief.background.slice(0, 1200)}` : ""}${
    brief.avoid && brief.avoid.length > 0 ? `\nAlready posted, so choose a different tip: ${brief.avoid.join("; ")}` : ""
  }`;
}

const PREAMBLE = /^(here('|’)?s|here is|sure|certainly|of course)\b/i;

/** The prompt's part names, which a model sometimes copies into the post. */
const PART_LABEL = /^(hook|why it matters|the main part|main part|payoff|question|hashtags)\s*:\s*/gim;

/**
 * Claims about results that an automatic post cannot back up. A model once
 * opened with "A 3-second load time can cost you half the traffic" (19 Nov
 * 2026) despite being told not to invent statistics.
 */
const MADE_UP_FIGURE = /\d\s*%|\bper ?cent\b|\bhalf (of )?(your|the|their|all)\b|\btwice as\b|\b\d+x (more|faster|higher)\b/i;

/**
 * Splits the AI's answer into the post and, for a tip, the one-line topic.
 * Returns why the answer is unusable instead when it is.
 */
export function readAutopilotAnswer(
  text: string,
  source: AutopilotSource
): { ok: true; post: string; topic: string } | { ok: false; problem: string } {
  let post = text.trim();
  let topic = "";
  const first = post.split("\n", 1)[0];
  if (first.toUpperCase().startsWith(TOPIC_LINE)) {
    topic = first.slice(TOPIC_LINE.length).trim().replace(/[.*"]+$/g, "");
    post = post.slice(first.length).trim();
  }
  if (source === "TIP" && !topic) return { ok: false, problem: "no TOPIC line" };
  post = post.replace(PART_LABEL, "").trim();
  if (PREAMBLE.test(post)) return { ok: false, problem: "starts with a preamble" };
  if (MADE_UP_FIGURE.test(post)) return { ok: false, problem: "puts a figure on results" };
  // The hook is what decides whether anyone reads on, so a cliché there is refused.
  const hook = post.split("\n", 1)[0].toLowerCase();
  const cliche = BANNED_PHRASES.find((phrase) => hook.includes(phrase));
  if (cliche) return { ok: false, problem: `the first line uses "${cliche}"` };
  if (/https?:\/\/|www\./i.test(post)) return { ok: false, problem: "contains a link" };

  const words = post.split(/\s+/).filter((w) => w && !w.startsWith("#")).length;
  if (words < 70) return { ok: false, problem: `too short (${words} words)` };
  if (words > 220) return { ok: false, problem: `too long (${words} words)` };
  return { ok: true, post, topic: topic.slice(0, 120) };
}
