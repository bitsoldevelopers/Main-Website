import { config } from "@/lib/config";
import { configuredProviders, getPrimaryProvider } from "./provider";

export interface ProviderCheck {
  ok: boolean;
  /** One line, written for whoever is looking at the Setup page. */
  detail: string;
}

/**
 * Ask the preferred AI provider, from this server, for a one-word answer.
 *
 * A key can be present and still be invalid, expired or out of quota; this is
 * the difference between "a value is set" and "it works". Costs a few tokens
 * per Setup page load, like the WhatsApp connection check.
 */
export async function checkAiProvider(): Promise<ProviderCheck> {
  const fallbacks = configuredProviders().filter((name) => name !== config.ai.provider);
  const fallbackNote = fallbacks.length ? ` Fallback: ${fallbacks.join(", ")}.` : "";

  if (!config.ai.hasKey(config.ai.provider)) {
    return {
      ok: false,
      detail: `No key for ${config.ai.provider} on this server.${
        config.ai.configured ? fallbackNote : " The widget asks visitors to WhatsApp instead of answering."
      }`,
    };
  }

  try {
    for await (const chunk of getPrimaryProvider().streamChat({
      system: "Reply with the single word OK.",
      messages: [{ role: "user", content: "Ready?" }],
      maxTokens: 256,
      thinking: false,
    })) {
      void chunk;
    }
    return { ok: true, detail: `${config.ai.provider} answered on ${config.ai.model} (effort ${config.ai.effort}).${fallbackNote}` };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const detail = /invalid x-api-key|authentication_error|API key not valid|\b401\b/i.test(raw)
      ? `The ${config.ai.provider} key on this server is not valid (the API answered 401). Replace it and redeploy.`
      : /not_found|\b404\b/i.test(raw)
        ? `The model ${config.ai.model} is not available to this key (404).`
        : /\b429\b|quota|RESOURCE_EXHAUSTED|rate/i.test(raw)
          ? `${config.ai.provider} is out of quota or rate-limited (429).`
          : raw.slice(0, 200);
    return { ok: false, detail: `${detail}${fallbackNote}` };
  }
}
