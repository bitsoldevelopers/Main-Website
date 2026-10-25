import { config, type ProviderName } from "@/lib/config";
import type { AIProvider, StreamChatOptions } from "./types";
import { RefusalError, createClaudeProvider } from "./providers/claude";
import { createOpenAIProvider } from "./providers/openai";
import { createGeminiProvider } from "./providers/gemini";

/**
 * Resolve the AI provider from AI_PROVIDER (default `claude`).
 *
 * When AI_PROVIDER lists more than one (`claude,gemini`), the provider
 * returned falls back: if the preferred one fails before it has produced a
 * single token — an invalid or expired key, a model that does not exist, a
 * quota, an outage — the next one answers instead, on its own default model.
 * A provider that failed is skipped for a while so every customer message does
 * not wait on the same error again. A customer never sees which key was wrong;
 * the Setup page does.
 */

function create(name: ProviderName): AIProvider {
  switch (name) {
    case "openai":
      return createOpenAIProvider(false);
    case "ollama":
      return createOpenAIProvider(true);
    case "gemini":
      return createGeminiProvider();
    case "claude":
    default:
      return createClaudeProvider();
  }
}

/** The chain from AI_PROVIDER, keeping only providers that have what they need. */
export function configuredProviders(): ProviderName[] {
  const usable = config.ai.chain.filter((name) => config.ai.hasKey(name));
  return usable.length ? usable : [config.ai.provider];
}

/** The preferred provider only — what the Setup page tests. */
export function getPrimaryProvider(): AIProvider {
  return create(config.ai.provider);
}

/** Until when a provider that just failed is tried last instead of first. */
const coolingUntil = new Map<ProviderName, number>();

function cooldownFor(error: unknown): number {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  // A wrong key or a missing model will not fix itself within a minute.
  if (/401|403|404|authentication|permission|invalid x-api-key|not_found|API key not valid/i.test(text)) return 10 * 60_000;
  return 60_000;
}

export function getProvider(): AIProvider {
  const names = configuredProviders();
  if (names.length === 1) return create(names[0]);

  return {
    name: names.join(" → "),
    async *streamChat(options: StreamChatOptions) {
      const now = Date.now();
      const ordered = [
        ...names.filter((name) => (coolingUntil.get(name) ?? 0) <= now),
        ...names.filter((name) => (coolingUntil.get(name) ?? 0) > now),
      ];

      let lastError: unknown;
      for (const name of ordered) {
        // The model override (AI_MODEL / AI_EXTRACTION_MODEL) belongs to the
        // preferred provider; a fallback answers on its own default.
        const attempt = name === config.ai.provider ? options : { ...options, model: undefined };
        let started = false;
        try {
          for await (const chunk of create(name).streamChat(attempt)) {
            started = true;
            yield chunk;
          }
          coolingUntil.delete(name);
          return;
        } catch (error) {
          // Text already reached the customer, or the model itself declined:
          // another provider would only repeat or contradict it.
          if (started || error instanceof RefusalError) throw error;
          lastError = error;
          coolingUntil.set(name, Date.now() + cooldownFor(error));
          console.warn(`[ai] ${name} failed before answering, trying the next provider:`, error instanceof Error ? error.message.slice(0, 200) : error);
        }
      }
      throw lastError instanceof Error ? lastError : new Error("No AI provider could answer.");
    },
  };
}
