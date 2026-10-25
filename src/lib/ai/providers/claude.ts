import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import type { AIProvider } from "../types";

/**
 * Anthropic Claude provider (default). Streams with the official SDK.
 *
 * - Model: AI_MODEL, default `claude-opus-5-5`.
 * - Effort: AI_EFFORT, default `low` — current Claude models always think a
 *   little, and a live chat wants a quick answer more than a deep one.
 * - Refusal fallback: on the current models, a request the safety classifiers
 *   decline is re-run server-side on Anthropic's recommended model for that
 *   category (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`),
 *   on the same stream. A software agency's catalogue includes cyber security
 *   and penetration testing, which is exactly where false positives happen.
 *   The installed SDK predates the parameter's typings, so it is passed
 *   untyped; if the API ever rejects it, the request is retried without it
 *   and the fallback stays off for this process.
 * - A refusal that still ends the turn throws, so the caller discards the
 *   partial reply and shows its friendly message instead.
 *
 * Works against Anthropic's API or Claude Platform on AWS (ANTHROPIC_BASE_URL
 * + ANTHROPIC_WORKSPACE_ID with a key from the AWS console).
 */

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** Models with server-side refusal fallback. Haiku 5.5 has none; older models have no classifiers. */
const FALLBACK_MODELS = /^claude-(opus-5|fable-5|sonnet-5-5)/;

/** Models that take `output_config.effort`. It is a 400 on Sonnet 4.5 and Haiku 4.5. */
const EFFORT_MODELS = /^claude-(opus-4-[5-9]|opus-5|sonnet-4-6|sonnet-5|fable|mythos|haiku-5)/;

/** Set once the API has rejected the fallback parameter, so it is not sent again. */
let fallbackRejected = false;

export class RefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`The model declined to answer${category ? ` (${category})` : ""}.`);
    this.name = "RefusalError";
  }
}

interface StreamEvent {
  type: string;
  delta?: { type?: string; text?: string; stop_reason?: string | null };
  content_block?: { type?: string };
  message?: { model?: string };
  stop_details?: { category?: string | null } | null;
}

export function createClaudeProvider(): AIProvider {
  const { anthropicApiKey: apiKey, anthropicBaseUrl: baseURL, anthropicWorkspaceId: workspaceId } = config.ai;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Configure it on the server or list another provider in AI_PROVIDER.");
  }
  checkClaudeOnAws(apiKey, baseURL, workspaceId);

  const client = new Anthropic({
    apiKey,
    baseURL,
    defaultHeaders: workspaceId ? { "anthropic-workspace-id": workspaceId } : undefined,
  });

  return {
    name: "claude",
    async *streamChat({ system, messages, model, maxTokens, thinking }) {
      const resolvedModel = model ?? config.ai.modelFor("claude");
      const params: Anthropic.MessageCreateParamsStreaming = {
        model: resolvedModel,
        max_tokens: maxTokens ?? config.ai.maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
      if (EFFORT_MODELS.test(resolvedModel)) params.output_config = { effort: config.ai.effort };
      // Thinking summaries are opt-in and never shown to customers; current
      // models think adaptively whether or not this is sent.
      if (config.ai.thinking && thinking !== false) params.thinking = { type: "adaptive" };

      // Anthropic's own API only; Claude Platform on AWS has its own rules.
      const withFallback = config.ai.refusalFallback && !fallbackRejected && !baseURL && FALLBACK_MODELS.test(resolvedModel);

      const open = (fallback: boolean): Promise<AsyncIterable<StreamEvent>> =>
        fallback
          ? (client.beta.messages.create({
              ...params,
              betas: [FALLBACK_BETA],
              fallbacks: "default",
            } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming) as unknown as Promise<AsyncIterable<StreamEvent>>)
          : (client.messages.create(params) as unknown as Promise<AsyncIterable<StreamEvent>>);

      let stream: AsyncIterable<StreamEvent>;
      try {
        stream = await open(withFallback);
      } catch (error) {
        if (withFallback && error instanceof Anthropic.BadRequestError && /fallback|beta/i.test(error.message)) {
          fallbackRejected = true;
          console.warn("[ai] the API rejected the refusal fallback; continuing without it:", error.message.slice(0, 200));
          stream = await open(false);
        } else {
          throw error;
        }
      }

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          yield event.delta.text;
        } else if (event.type === "content_block_start" && event.content_block?.type === "fallback") {
          // A declined attempt was handed to the fallback model, which carries on
          // from the text already streamed. Nothing to do but note it.
          console.info("[ai] a declined request continued on the fallback model");
        } else if (event.type === "message_delta" && event.delta?.stop_reason === "refusal") {
          throw new RefusalError(event.stop_details?.category ?? null);
        }
      }
    },
  };
}

/**
 * A Claude Platform on AWS key sent to Anthropic's API, or an AWS request
 * without a workspace, fails with a bare 401 that never says why. Both are
 * one missing environment variable, so name it before the first request.
 */
function checkClaudeOnAws(apiKey: string, baseURL?: string, workspaceId?: string): void {
  const awsEndpoint = baseURL?.includes("aws-external-anthropic") ?? false;

  // Long-term keys generated under Claude Platform on AWS start with AEAA.
  if (apiKey.startsWith("AEAA") && !awsEndpoint) {
    throw new Error(
      "ANTHROPIC_API_KEY is a Claude Platform on AWS key. Set ANTHROPIC_BASE_URL to " +
        "https://aws-external-anthropic.<region>.api.aws and ANTHROPIC_WORKSPACE_ID to your workspace id."
    );
  }
  if (awsEndpoint && !workspaceId) {
    throw new Error("ANTHROPIC_WORKSPACE_ID is not set. Claude Platform on AWS requires the workspace id (wrkspc_…) shown in the AWS console.");
  }
}
