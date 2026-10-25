import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * The website chat end to end, against the local database: /api/chat streams
 * a reply, stores the conversation, and turns what the customer said into a
 * lead, a consultation request and a support ticket.
 *
 * The AI is a local mock speaking the OpenAI-compatible protocol (and, for
 * the fallback case, answering Anthropic's endpoint with a 401), so the test
 * spends no API quota and needs no key.
 *
 *   DATABASE_URL=mysql://root@localhost:3306/bitsol_next npm run test:integration
 */

const url = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const local = url !== null && ["localhost", "127.0.0.1"].includes(url.hostname);

// ─── Mock AI ────────────────────────────────────────────────────────────────

interface Call {
  path: string;
  system: string;
  extraction: boolean;
}

const calls: Call[] = [];
let nextDetails: Record<string, unknown> = {};
const REPLY = "Absolutely — a WhatsApp assistant can book appointments around the clock and pass every booking to your front desk.";

const server = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    if (req.url?.startsWith("/v1/messages")) {
      // Anthropic's endpoint, refusing the key: the provider chain must move on.
      calls.push({ path: req.url, system: "", extraction: false });
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }));
      return;
    }
    const body = JSON.parse(raw || "{}") as { messages?: Array<{ role: string; content: string }> };
    const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
    const extraction = system.includes("Return ONLY a JSON object");
    calls.push({ path: req.url ?? "", system, extraction });
    const text = extraction ? JSON.stringify(nextDetails) : REPLY;
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (let i = 0; i < text.length; i += 24) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 24) } }] })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

// ─── Environment, set before any chatbot module reads it ────────────────────

delete process.env.RESEND_API_KEY; // nothing in this file may send an email
process.env.CHATBOT_NOTIFY_EMAIL = "integration-test@example.invalid";
process.env.AI_PROVIDER = "ollama";
process.env.OPENAI_BASE_URL = `${base}/v1`;

const { prisma } = await import("@/lib/prisma");
const { invalidateKnowledgeCache } = await import("@/lib/ai/knowledge");
const { NextRequest } = await import("next/server");
let { POST } = await import("@/app/api/chat/route");

const RUN = `it${Date.now().toString(36)}`;
const STARTED = new Date();
const conversations: string[] = [];
const knowledgeSlugs: string[] = [];

interface ChatEvent {
  type: string;
  [key: string]: unknown;
}

function ref(n: number): string {
  // BM-CONV- followed by exactly ten characters from the reference alphabet.
  return `BM-CONV-${(RUN.toUpperCase().replace(/[^A-Z2-9]/g, "X") + "ZZZZZZZZZZ").slice(0, 9)}${"ABCDEFGHJK"[n]}`;
}

async function chat(reference: string, messages: Array<{ role: "user" | "assistant"; content: string }>, pageUrl = "/services") {
  if (!conversations.includes(reference)) conversations.push(reference);
  const req = new NextRequest("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.9.${conversations.length}.1` },
    body: JSON.stringify({ conversationRef: reference, messages, pageUrl }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const text = await res.text();
  const events = text
    .split("\n\n")
    .map((block) => block.trim())
    .filter((block) => block.startsWith("data:"))
    .map((block) => JSON.parse(block.slice(5).trim()) as ChatEvent);
  const reply = events.filter((e) => e.type === "chunk").map((e) => e.text as string).join("");
  return { events, reply };
}

function tomorrowInPakistan(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + 24 * 3_600_000)
  );
}

describe.runIf(local)("website chat, against the local database", () => {
  afterAll(async () => {
    const rows = await prisma.chatConversation.findMany({ where: { reference: { in: conversations } }, select: { id: true, leadId: true } });
    const ids = rows.map((r) => r.id);
    const leadIds = rows.map((r) => r.leadId).filter((id): id is string => Boolean(id));
    await prisma.chatEvent.deleteMany({ where: { conversationId: { in: ids } } });
    await prisma.chatRequest.deleteMany({ where: { conversationId: { in: ids } } });
    await prisma.chatConversation.deleteMany({ where: { id: { in: ids } } });
    await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
    await prisma.chatKnowledge.deleteMany({ where: { slug: { in: knowledgeSlugs } } });
    await prisma.activityLog.deleteMany({ where: { actor: "Chatbot", createdAt: { gte: STARTED } } });
    invalidateKnowledgeCache();
    await prisma.$disconnect();
    server.close();
  });

  const reference = ref(0);
  const first = "Hi, I am Sara Khan from Nova Clinics in Lahore. I need a WhatsApp chatbot for my clinic to handle appointment bookings. My number is 0300 1234567.";
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  it("answers, stores the turn and captures a lead with its chat profile", async () => {
    nextDetails = {
      name: "Sara Khan",
      phone: "0300 1234567",
      company: "Nova Clinics",
      businessType: "Healthcare clinic",
      city: "Lahore",
      service: "whatsapp-automation",
      requirements: "A WhatsApp chatbot that handles appointment bookings for the clinic.",
      intent: "PROJECT",
    };
    history.push({ role: "user", content: first });
    const { events, reply } = await chat(reference, history);
    history.push({ role: "assistant", content: reply });

    expect(events[0]).toEqual({ type: "meta", language: "en" });
    expect(reply).toBe(REPLY);
    expect(events.some((e) => e.type === "done")).toBe(true);
    const capture = events.find((e) => e.type === "capture");
    const records = (capture?.records ?? []) as Array<{ kind: string; reference: string }>;
    expect(records.map((r) => r.kind)).toEqual(["LEAD"]);
    expect(records[0].reference).toMatch(/^BM-LEAD-/);

    // The representative was grounded in the knowledge base and Studio pricing.
    const replyCall = calls.find((c) => !c.extraction && c.system.includes("customer service representative"));
    expect(replyCall?.system).toContain("Tell me about WhatsApp Automation.");
    expect(replyCall?.system).toContain("WhatBot Pro");

    const conversation = await prisma.chatConversation.findUniqueOrThrow({
      where: { reference },
      include: { messages: { orderBy: { createdAt: "asc" } }, events: true, lead: { include: { chatProfile: true, phones: true, activities: true } } },
    });
    expect(conversation.channel).toBe("WEB");
    expect(conversation.trafficSource).toBe("WEBSITE");
    expect(conversation.campaign).toBe("/services");
    expect(conversation.messages.map((m) => m.role)).toEqual(["USER", "ASSISTANT"]);
    expect(conversation.events.map((e) => e.type).sort()).toEqual(["AI_REPLY", "CONVERSATION_STARTED", "LEAD_CAPTURED"]);

    const lead = conversation.lead!;
    expect(lead).toMatchObject({ name: "Sara Khan", phone: "0300 1234567", company: "Nova Clinics", city: "Lahore", source: "chatbot", status: "NEW", subject: "WhatsApp Automation" });
    expect(lead.chatProfile).toMatchObject({ reference: records[0].reference, source: "CHATBOT", serviceSlug: "whatsapp-automation", businessType: "Healthcare clinic" });
    expect(lead.phones.map((p) => p.phone)).toEqual(["0300 1234567"]);
    expect(lead.activities.map((a) => a.type)).toContain("LEAD_CREATED");
  });

  it("remembers the customer and books a consultation on the next turn", async () => {
    nextDetails = { ...nextDetails, intent: "CONSULTATION", meetingDate: tomorrowInPakistan(), meetingTime: "3:00 PM", meetingMode: "ZOOM" };
    history.push({ role: "user", content: "Can we have a call tomorrow at 3pm on Zoom?" });
    const { events, reply } = await chat(reference, history);
    history.push({ role: "assistant", content: reply });

    // What the customer said last turn reached the prompt from the database.
    const replyCalls = calls.filter((c) => !c.extraction && c.system.includes("customer service representative"));
    expect(replyCalls.at(-1)?.system).toContain("Name: Sara Khan");

    const records = (events.find((e) => e.type === "capture")?.records ?? []) as Array<{ kind: string; reference: string }>;
    expect(records.map((r) => r.kind)).toEqual(["MEETING"]);
    const meeting = await prisma.chatRequest.findUniqueOrThrow({ where: { reference: records[0].reference } });
    const conversation = await prisma.chatConversation.findUniqueOrThrow({ where: { reference } });
    expect(meeting).toMatchObject({ kind: "MEETING", status: "REQUESTED", preferredTime: "3:00 PM", mode: "ZOOM", leadId: conversation.leadId, contactName: "Sara Khan" });
  });

  it("opens a ticket and hands the conversation over when the customer asks for a person", async () => {
    history.push({ role: "user", content: "Can I talk to a human please?" });
    const { events, reply } = await chat(reference, history);
    history.push({ role: "assistant", content: reply });

    const done = events.find((e) => e.type === "done");
    expect(done?.ticketId).toMatch(/^BM-TKT-/);
    expect(reply).toContain(done?.ticketId as string);
    const ticket = await prisma.chatRequest.findUniqueOrThrow({ where: { reference: done?.ticketId as string } });
    expect(ticket).toMatchObject({ kind: "TICKET", status: "OPEN", team: "SUPPORT", contactPhone: "0300 1234567" });
    const conversation = await prisma.chatConversation.findUniqueOrThrow({ where: { reference }, include: { events: true } });
    expect(conversation.handedOff).toBe(true);
    expect(conversation.events.map((e) => e.type)).toContain("HANDOVER");
  });

  it("answers from a knowledge entry published in the admin panel", async () => {
    const slug = `${RUN}-zebra`;
    knowledgeSlugs.push(slug);
    await prisma.chatKnowledge.create({
      data: { slug, category: "Test", kind: "FAQ", question: "Do you do zebra striping?", answer: `Zebra striping is a ${RUN} service.`, keywords: ["zebra striping"], state: "PUBLISHED" },
    });
    invalidateKnowledgeCache();
    nextDetails = {};
    await chat(ref(1), [{ role: "user", content: "Do you do zebra striping for offices?" }]);
    const replyCall = calls.filter((c) => !c.extraction && c.system.includes("customer service representative")).at(-1);
    expect(replyCall?.system).toContain(`Zebra striping is a ${RUN} service.`);
  });

  it("falls back to the next provider when Claude rejects the key", async () => {
    vi.resetModules();
    process.env.AI_PROVIDER = "claude,ollama";
    process.env.ANTHROPIC_API_KEY = "sk-ant-integration-invalid";
    process.env.ANTHROPIC_BASE_URL = base;
    ({ POST } = await import("@/app/api/chat/route"));
    const before = calls.length;

    const { events, reply } = await chat(ref(2), [{ role: "user", content: "Hello, what do you do?" }], "/");
    expect(events.some((e) => e.type === "error")).toBe(false);
    expect(reply).toBe(REPLY);
    expect(calls.slice(before).some((c) => c.path.startsWith("/v1/messages"))).toBe(true);
  });

  it("tells the visitor how to reach the team when no AI key is configured", async () => {
    vi.resetModules();
    process.env.AI_PROVIDER = "claude";
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_BASE_URL;
    ({ POST } = await import("@/app/api/chat/route"));

    const { events } = await chat(ref(3), [{ role: "user", content: "Hello?" }], "/");
    const error = events.find((e) => e.type === "error");
    expect(error?.message).toContain("not switched on yet");
    expect(error?.message).toContain("+92 312 0141581");
    const conversation = await prisma.chatConversation.findUniqueOrThrow({ where: { reference: ref(3) }, include: { messages: true } });
    // The visitor's message is kept; no assistant reply is stored for a failed turn.
    expect(conversation.messages.map((m) => m.role)).toEqual(["USER"]);
  });
});

describe.runIf(!local)("website chat", () => {
  it("only runs against a local database", () => {
    expect(local).toBe(false);
    server.close();
  });
});
