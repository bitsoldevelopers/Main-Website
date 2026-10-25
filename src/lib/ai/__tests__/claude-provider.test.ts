import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Claude provider against a stubbed `fetch`: what it sends (model,
 * effort, the refusal-fallback beta) and how it reads the stream (text,
 * a mid-stream fallback, a refusal). No network, no key.
 */

process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
delete process.env.ANTHROPIC_BASE_URL;
delete process.env.AI_PROVIDER;
delete process.env.AI_MODEL;
delete process.env.AI_EFFORT;
delete process.env.AI_REFUSAL_FALLBACK;

const { createClaudeProvider, RefusalError } = await import("../providers/claude");

interface Captured {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

let captured: Captured[] = [];

function sse(events: Array<Record<string, unknown>>): string {
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}

function textEvents(...pieces: string[]): Array<Record<string, unknown>> {
  return pieces.map((text) => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }));
}

const START = [
  { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
];
const END = [
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } },
  { type: "message_stop" },
];

function stubFetch(responses: Array<() => Response>) {
  let call = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      captured.push({
        url: String(input instanceof Request ? input.url : input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body ?? "{}")),
      });
      const next = responses[Math.min(call, responses.length - 1)];
      call += 1;
      return next();
    })
  );
}

const ok = (events: Array<Record<string, unknown>>) => () =>
  new Response(sse(events), { status: 200, headers: { "content-type": "text/event-stream" } });

async function collect(options: { model?: string } = {}): Promise<string> {
  let text = "";
  for await (const chunk of createClaudeProvider().streamChat({
    system: "You are a test.",
    messages: [{ role: "user", content: "Hello" }],
    ...options,
  })) {
    text += chunk;
  }
  return text;
}

describe("Claude provider", () => {
  beforeEach(() => {
    captured = [];
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams text on claude-opus-5-5 at low effort, with the refusal fallback opted in", async () => {
    stubFetch([ok([...START, ...textEvents("Hello ", "there."), ...END])]);
    expect(await collect()).toBe("Hello there.");

    const [request] = captured;
    expect(request.url).toContain("/v1/messages");
    expect(request.url).toContain("beta=true");
    expect(request.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(request.body.model).toBe("claude-opus-5-5");
    expect(request.body.fallbacks).toBe("default");
    expect(request.body.output_config).toEqual({ effort: "low" });
    expect(request.body.stream).toBe(true);
    expect(request.body.thinking).toBeUndefined();
    expect(request.body.betas).toBeUndefined();
  });

  it("keeps streaming across a mid-stream fallback", async () => {
    stubFetch([
      ok([
        ...START,
        ...textEvents("Part one. "),
        { type: "content_block_start", index: 1, content_block: { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-4-8" } } },
        { type: "content_block_stop", index: 1 },
        { type: "content_block_start", index: 2, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 2, delta: { type: "text_delta", text: "Part two." } },
        ...END,
      ]),
    ]);
    expect(await collect()).toBe("Part one. Part two.");
  });

  it("throws a RefusalError when the turn ends in a refusal", async () => {
    stubFetch([
      ok([
        ...START,
        ...textEvents("Partial"),
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "refusal", stop_sequence: null }, stop_details: { type: "refusal", category: "cyber" }, usage: { output_tokens: 1 } },
        { type: "message_stop" },
      ]),
    ]);
    await expect(collect()).rejects.toBeInstanceOf(RefusalError);
  });

  it("sends neither effort nor fallbacks to a model that takes neither", async () => {
    stubFetch([ok([...START, ...textEvents("Hi."), ...END])]);
    expect(await collect({ model: "claude-haiku-4-5" })).toBe("Hi.");
    const [request] = captured;
    expect(request.url).not.toContain("beta=true");
    expect(request.body.fallbacks).toBeUndefined();
    expect(request.body.output_config).toBeUndefined();
  });

  it("retries without the fallback when the API rejects it, then stops sending it", async () => {
    const rejected = () =>
      new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "fallbacks: Extra inputs are not permitted" } }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    stubFetch([rejected, ok([...START, ...textEvents("Recovered."), ...END])]);
    expect(await collect()).toBe("Recovered.");
    expect(captured).toHaveLength(2);
    expect(captured[0].body.fallbacks).toBe("default");
    expect(captured[1].body.fallbacks).toBeUndefined();
    expect(captured[1].url).not.toContain("beta=true");

    captured = [];
    stubFetch([ok([...START, ...textEvents("Again."), ...END])]);
    expect(await collect()).toBe("Again.");
    expect(captured[0].body.fallbacks).toBeUndefined();
  });
});
