/**
 * "AI Personalize": drafts one sentence for an outreach email from what the
 * CRM knows about the lead's company. It is a draft for a person to read,
 * edit and save; nothing here is sent or stored on its own.
 *
 * The model is given only the CRM fields and is told to use nothing else.
 * Because a model can still embellish, the draft is checked afterwards and
 * rejected when it contains a figure that is not in the source.
 *
 * Runs on the same free tiers as the social copy writer, light models first.
 */

const REQUEST_TIMEOUT = 25_000;
const MAX_WORDS = 45;

interface Provider {
  name: string;
  keyEnv: string;
  url: string;
  models: string[];
}

const PROVIDERS: Provider[] = [
  {
    name: "Gemini",
    keyEnv: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    models: ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-flash-latest"],
  },
  {
    name: "Groq",
    keyEnv: "GROQ_API_KEY",
    url: "https://api.groq.com/openai/v1/chat/completions",
    models: ["llama-3.3-70b-versatile"],
  },
  {
    name: "OpenRouter",
    keyEnv: "OPENROUTER_API_KEY",
    url: "https://openrouter.ai/api/v1/chat/completions",
    models: ["openrouter/free"],
  },
];

export function isPersonalizerConfigured(): boolean {
  return PROVIDERS.some((provider) => process.env[provider.keyEnv]);
}

export interface PersonalizationFacts {
  companyName?: string | null;
  website?: string | null;
  companyDescription?: string | null;
  title?: string | null;
  location?: string | null;
}

function factLines(facts: PersonalizationFacts): string[] {
  const entries: [string, string | null | undefined][] = [
    ["Company name", facts.companyName],
    ["Website", facts.website],
    ["Company description", facts.companyDescription],
    ["Recipient's job title", facts.title],
    ["Recipient's location", facts.location],
  ];
  return entries.filter(([, value]) => value && value.trim()).map(([label, value]) => `- ${label}: ${(value as string).trim()}`);
}

/** There must be something about the company itself to personalise on. */
export function hasEnoughFacts(facts: PersonalizationFacts): boolean {
  return Boolean(facts.companyDescription?.trim()) && Boolean(facts.companyName?.trim() || facts.website?.trim());
}

export function buildPrompt(facts: PersonalizationFacts): string {
  return `You help BITSOL Marketing, a digital marketing and AI automation agency, write one sentence of a business outreach email.

Write ONE sentence of at most 35 words, to go right after the greeting, showing that we looked at the recipient's company.

Facts (this is everything we know):
${factLines(facts).join("\n")}

Rules:
- Use only the facts above. Do not add, guess or imply anything that is not written there: no achievements, numbers, clients, awards, news, growth, or judgements of quality.
- Present what the company does as something we noticed ("I noticed…", "I saw that…"), and our help as a possibility ("I thought … could…"), never as a fact about them.
- Plain text. No greeting, no sign-off, no quotation marks, no emojis, no markdown.
- If the facts are too thin to say anything specific, reply with exactly: INSUFFICIENT

Reply with the sentence only.`;
}

export function cleanDraft(raw: string): string {
  return raw
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^["“'‘]([\s\S]*)["”'’]$/, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Why a draft cannot be used, or null when it can. Catches the failures that
 * can be checked mechanically; the person reading the draft catches the rest.
 */
export function draftProblem(draft: string, facts: PersonalizationFacts): string | null {
  if (!draft || /^INSUFFICIENT\b/i.test(draft)) return "There is not enough about this company in the CRM to personalise on.";
  if (draft.split(/\s+/).length > MAX_WORDS) return "The draft came back too long.";
  const source = factLines(facts).join(" ").toLowerCase();
  const figures = draft.match(/\d[\d.,%]*/g) ?? [];
  const invented = figures.find((figure) => !source.includes(figure.replace(/[.,]$/, "").toLowerCase()));
  if (invented) return `The draft mentions "${invented}", which is not in the CRM, so it was discarded.`;
  return null;
}

export async function draftPersonalization(facts: PersonalizationFacts): Promise<{ text: string; source: string }> {
  if (!hasEnoughFacts(facts)) {
    throw new Error("Add a company description (and the company name or website) first: the draft is written from those.");
  }
  const prompt = buildPrompt(facts);
  const failures: string[] = [];

  for (const provider of PROVIDERS) {
    const key = process.env[provider.keyEnv];
    if (!key) continue;
    for (const model of provider.models) {
      try {
        const res = await fetch(provider.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], max_tokens: 512, temperature: 0.4 }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const text = cleanDraft(data.choices?.[0]?.message?.content ?? "");
        const problem = draftProblem(text, facts);
        // The model understood and declined: another model would only guess.
        if (problem && /^INSUFFICIENT\b/i.test(text)) throw Object.assign(new Error(problem), { final: true });
        if (problem) throw new Error(problem);
        return { text, source: `${provider.name} (${model})` };
      } catch (err) {
        if (err instanceof Error && "final" in err) throw new Error(err.message);
        failures.push(`${provider.name} ${model}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  throw new Error(
    failures.length === 0
      ? "No AI key is set on the server. Add GEMINI_API_KEY (or GROQ_API_KEY / OPENROUTER_API_KEY) to use AI Personalize."
      : `No usable draft came back (${failures.slice(0, 3).join("; ")}). Try again in a minute, or write the line yourself.`
  );
}
