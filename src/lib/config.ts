/**
 * Server-side configuration for the chatbot: which AI provider answers, the
 * WhatsApp Business credentials, where the team is notified and the secret
 * for the follow-up cron. Read from environment variables once per process.
 *
 * Import only from server code (route handlers, server components, lib).
 *
 * AI provider: Claude (ANTHROPIC_API_KEY) unless AI_PROVIDER says otherwise.
 * AI_PROVIDER may list several, first one preferred: `claude,gemini` answers
 * with Claude and falls back to Gemini when Claude cannot answer. The Gemini,
 * Groq and OpenRouter keys the Social page uses are only touched when listed
 * here: the owner reserved them for short social posts, and Gemini's free tier
 * passes conversations to Google.
 */

export type ProviderName = "claude" | "openai" | "ollama" | "gemini";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

const PROVIDERS: readonly ProviderName[] = ["claude", "openai", "ollama", "gemini"];
const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

function env(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function bool(key: string, fallback: boolean): boolean {
  const value = env(key);
  return value == null ? fallback : /^(1|true|yes|on)$/i.test(value);
}

function int(key: string, fallback: number): number {
  const value = Number(env(key));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

/** `AI_PROVIDER=claude,gemini` → ["claude", "gemini"]; unknown names are ignored. */
const chain: ProviderName[] = (env("AI_PROVIDER") ?? "claude")
  .split(",")
  .map((name) => name.trim().toLowerCase())
  .filter((name, index, all): name is ProviderName => PROVIDERS.includes(name as ProviderName) && all.indexOf(name) === index);
if (!chain.length) chain.push("claude");

const provider = chain[0];

/** The OpenAI-compatible service in use, from whichever key is set. */
function openaiCompatible(): { apiKey?: string; baseUrl: string; model: string } {
  const explicitBase = env("OPENAI_BASE_URL");
  if (env("OPENAI_API_KEY")) {
    return { apiKey: env("OPENAI_API_KEY"), baseUrl: explicitBase ?? "https://api.openai.com/v1", model: "gpt-4o-mini" };
  }
  if (env("GROQ_API_KEY")) {
    return { apiKey: env("GROQ_API_KEY"), baseUrl: explicitBase ?? "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" };
  }
  if (env("OPENROUTER_API_KEY")) {
    return { apiKey: env("OPENROUTER_API_KEY"), baseUrl: explicitBase ?? "https://openrouter.ai/api/v1", model: "openrouter/free" };
  }
  return { apiKey: undefined, baseUrl: explicitBase ?? "https://api.openai.com/v1", model: "gpt-4o-mini" };
}

const compatible = openaiCompatible();

/** The model each provider answers on when AI_MODEL does not apply to it. */
const DEFAULT_MODEL: Record<ProviderName, string> = {
  claude: "claude-opus-5-5",
  gemini: "gemini-3.5-flash-lite",
  openai: compatible.model,
  ollama: "llama3.1",
};

/** AI_MODEL belongs to the preferred provider; a fallback answers on its own default. */
function modelFor(name: ProviderName): string {
  return name === provider ? env("AI_MODEL") ?? DEFAULT_MODEL[name] : DEFAULT_MODEL[name];
}

function hasKey(name: ProviderName): boolean {
  switch (name) {
    case "claude":
      return Boolean(env("ANTHROPIC_API_KEY"));
    case "gemini":
      return Boolean(env("GEMINI_API_KEY"));
    case "ollama":
      return true;
    default:
      return Boolean(compatible.apiKey);
  }
}

const model = modelFor(provider);
const siteUrl = (env("NEXT_PUBLIC_SITE_URL") ?? env("APP_URL") ?? "http://localhost:3000").replace(/\/+$/, "");
const geminiThinkingRaw = env("GEMINI_THINKING")?.toLowerCase();
const effortRaw = env("AI_EFFORT")?.toLowerCase();

export const config = {
  appUrl: siteUrl,

  ai: {
    /** The preferred provider. */
    provider,
    /** Preferred provider first, then the fallbacks, in the order AI_PROVIDER lists them. */
    chain: chain as readonly ProviderName[],
    model,
    /**
     * Model for the JSON-only call that reads the customer's details. Defaults
     * to AI_MODEL; a smaller model from the same provider (claude-haiku-5-5)
     * is cheaper and plenty.
     */
    extractionModel: env("AI_EXTRACTION_MODEL") ?? model,
    modelFor,
    hasKey,
    /** Cap on thinking plus reply text. Current Claude models always think a little. */
    maxTokens: int("AI_MAX_TOKENS", 2048),
    /** Claude effort. `low` keeps a live chat snappy; raise it if answers need more care. */
    effort: (EFFORTS.find((value) => value === effortRaw) ?? "low") as Effort,
    /** Claude adaptive thinking summaries on the reply call (never shown to customers). */
    thinking: bool("AI_THINKING", false),
    /**
     * Server-side refusal fallback on the current Claude models: a request the
     * safety classifiers decline is re-run on Anthropic's recommended model
     * for that category instead of returning a refusal. On by default.
     */
    refusalFallback: bool("AI_REFUSAL_FALLBACK", true),
    anthropicApiKey: env("ANTHROPIC_API_KEY"),
    anthropicBaseUrl: env("ANTHROPIC_BASE_URL")?.replace(/\/+$/, ""),
    anthropicWorkspaceId: env("ANTHROPIC_WORKSPACE_ID"),
    openaiApiKey: compatible.apiKey,
    openaiBaseUrl: compatible.baseUrl,
    ollamaBaseUrl: env("OPENAI_BASE_URL") ?? "http://localhost:11434/v1",
    geminiApiKey: env("GEMINI_API_KEY"),
    geminiThinking: (["off", "minimal", "low", "medium", "high"] as const).find((v) => v === geminiThinkingRaw),
    /** Some provider in the chain has what it needs, so the assistant can answer open questions. */
    configured: chain.some(hasKey),
  },

  // WhatsApp details live in src/lib/whatsapp/settings.ts: they can be entered
  // on Admin → Chatbot → Setup as well as set as environment variables.

  routing: {
    /**
     * Inbox for leads, consultations, tickets and handovers from the chatbot
     * when a team in Chatbot Studio has no inbox of its own. Defaults to the
     * address the website's contact form already notifies.
     */
    salesEmail: env("CHATBOT_NOTIFY_EMAIL") ?? env("SALES_NOTIFY_EMAIL") ?? "adnan.bashir7895@gmail.com",
  },

  cron: {
    /** Bearer secret for /api/cron/follow-ups. Shares the lead-automation cron secret by default. */
    secret: env("CHATBOT_CRON_SECRET") ?? env("AUTOMATION_CRON_SECRET"),
  },
} as const;

export type AppConfig = typeof config;
