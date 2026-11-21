import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Nothing here delivers an email or calls an AI: test mode records sends, and
// the social writer (the AI this server falls back to) is replaced below.
process.env.OUTREACH_EMAIL_MODE = "test";
process.env.ADMIN_SECRET ||= "integration-test-secret";
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;

const ai = vi.hoisted(() => ({ answer: "", fail: false, prompts: [] as string[] }));
vi.mock("@/lib/admin/social/copy", () => ({
  writeText: vi.fn(async (prompt: string, _keys: unknown, accept: (text: string) => string | null) => {
    ai.prompts.push(prompt);
    if (ai.fail) throw new Error("The AI writer is unavailable right now (test)");
    const problem = accept(ai.answer);
    if (problem) throw new Error(problem);
    return { text: ai.answer, source: "Test AI" };
  }),
}));

const url = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "");
  } catch {
    return null;
  }
})();
const local = url !== null && ["localhost", "127.0.0.1"].includes(url.hostname);

const { prisma } = await import("@/lib/prisma");
const { SHEET_COLUMNS } = await import("../columns");
const { enrollLead } = await import("../engine");
const { buildSteps } = await import("../defaults");
const { queueCsvImport } = await import("../imports");
const { getOutreachSettings, saveOutreachSettings } = await import("../settings");
const { toCsv, parseCsv } = await import("../sources/csv");
const { DEFAULT_IMPORT_SETTINGS } = await import("../sources/types");
const { runDueJobs } = await import("../worker");
const { handleInboundMail } = await import("../email/inbox");
const { isSuppressed } = await import("../suppression");

const RUN = `ar${Date.now().toString(36)}`;
const COMPANY = `Zztest ${RUN} Replies`;
const DOMAIN = `${RUN}-zztest.com`;
const OWN = `outreach@${DOMAIN}`;
const HEADERS = SHEET_COLUMNS.map((column) => column.header);
const mapping = Object.fromEntries(SHEET_COLUMNS.map((column) => [column.field, column.header]));

const imports: string[] = [];
const templateIds: string[] = [];
let automationId = "";
let sequenceId = "";
let settingsBefore: Awaited<ReturnType<typeof getOutreachSettings>>;

async function drain() {
  for (let i = 0; i < 10; i++) {
    const report = await runDueJobs({ source: "test", budgetMs: 60_000 });
    if (report.skipped) throw new Error(report.skipped);
    if (report.claimed === 0) return;
  }
}

/** Makes waiting reply jobs due now (they retry with a backoff) and runs them. */
async function runReplyJobs() {
  await prisma.automationJob.updateMany({ where: { type: "REPLY_TRIAGE", status: "PENDING" }, data: { runAt: new Date(Date.now() - 1000) } });
  await drain();
}

const lead = (firstName: string) =>
  prisma.lead.findFirstOrThrow({
    where: { company: COMPANY, firstName },
    include: { runs: true, messages: { orderBy: { createdAt: "asc" } }, activities: { orderBy: { createdAt: "asc" } } },
  });

async function sendFirstEmail(firstName: string): Promise<{ leadId: string; runId: string; providerMessageId: string }> {
  const { id } = await lead(firstName);
  const enrolled = await enrollLead({ leadId: id, automationId, actor: "Integration test" });
  if (!enrolled.ok) throw new Error(enrolled.message);
  await drain();
  const message = await prisma.emailMessage.findFirstOrThrow({ where: { leadId: id }, orderBy: { createdAt: "asc" } });
  const providerMessageId = `bitsol-outreach-${message.id}@${DOMAIN}`;
  await prisma.emailMessage.update({ where: { id: message.id }, data: { provider: "smtp", providerMessageId } });
  return { leadId: id, runId: enrolled.runId, providerMessageId };
}

function reply(firstName: string, providerMessageId: string, body: string): string {
  return [
    `From: ${firstName} Test <${firstName.toLowerCase()}@${DOMAIN}>`,
    `To: ${OWN}`,
    "Subject: Re: Step 1",
    `Message-ID: <reply-${firstName}-${RUN}@mail.example.com>`,
    `In-Reply-To: <${providerMessageId}>`,
    `References: <${providerMessageId}>`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");
}

const meta = (key: string) => ({ ownAddress: OWN, eventKey: `test:${RUN}:${key}`, receivedAt: new Date(), mailbox: OWN, triage: { delayMinutes: 0 } });

const ANSWER = `Hi Sana,

Thanks for getting back to us. A chatbot for a dental clinic usually answers questions about treatments and opening hours, books appointments and passes urgent cases to your team, on your website and WhatsApp.

The cost depends on how many services and branches it covers, so the quickest way to a precise figure is a short call. When would suit you this week, and which number should we call?`;

describe.runIf(local)("answering lead replies with AI, against the local database", () => {
  beforeAll(async () => {
    settingsBefore = await getOutreachSettings();
    await saveOutreachSettings({
      fromName: "BITSOL Test",
      fromEmail: OWN,
      replyTo: "",
      companyName: "BITSOL Marketing",
      companyAddress: "1 Test Road, Lahore",
      dailyLimit: 2000,
      batchLimit: 100,
      sendWindowStart: 0,
      sendWindowEnd: 24,
      spreadEvenly: false,
      autoReplyMode: "auto",
      autoReplyDelay: 0,
      autoReplyMax: 3,
      autoReplyNotes: "Offer a free website audit.",
    });

    const sequence = await prisma.emailSequence.create({ data: { name: `${RUN} sequence` } });
    sequenceId = sequence.id;
    const steps = [];
    for (const [i, delayDays] of [0, 2].entries()) {
      const template = await prisma.emailTemplate.create({ data: { name: `${RUN} email ${i + 1}`, subject: `Step ${i + 1} for {{company_name}}`, body: "Hi {{first_name|there}}." } });
      templateIds.push(template.id);
      steps.push(await prisma.emailSequenceStep.create({ data: { sequenceId, order: i + 1, name: `Email ${i + 1}`, delayDays, templateId: template.id } }));
    }
    const automation = await prisma.automation.create({ data: { name: `${RUN} automation`, status: "ACTIVE", sequenceId, createTask: false, createdBy: "Integration test" } });
    automationId = automation.id;
    await prisma.automationStep.createMany({ data: buildSteps(automationId, steps, false) });

    const people = ["Sana", "Omar", "Hina", "Asad", "Nadia"];
    const importId = await queueCsvImport({
      filename: `${RUN}.csv`,
      table: parseCsv(
        toCsv(
          HEADERS,
          people.map((name) => HEADERS.map((header) => ({ "First Name": name, "Last Name": "Test", "Company Name": COMPANY, "Email 1": `${name.toLowerCase()}@${DOMAIN}` })[header] ?? ""))
        )
      ),
      settings: { ...DEFAULT_IMPORT_SETTINGS, mapping, checkDomains: false },
      actor: "Integration test",
    });
    imports.push(importId);
    await drain();
  });

  afterAll(async () => {
    const leads = await prisma.lead.findMany({ where: { company: COMPANY }, select: { id: true } });
    const ids = leads.map((l) => l.id);
    const runs = await prisma.automationRun.findMany({ where: { leadId: { in: ids } }, select: { id: true } });
    const events = await prisma.emailEvent.findMany({ where: { leadId: { in: ids } }, select: { id: true } });
    await prisma.automationJob.deleteMany({
      where: { OR: [{ refId: { in: runs.map((r) => r.id) } }, { refId: { in: imports } }, { refId: { in: events.map((e) => e.id) } }] },
    });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    await prisma.leadImport.deleteMany({ where: { id: { in: imports } } });
    await prisma.leadSource.deleteMany({ where: { key: { contains: RUN } } });
    await prisma.company.deleteMany({ where: { nameKey: { contains: RUN } } });
    await prisma.suppressionEntry.deleteMany({ where: { value: { contains: RUN } } });
    if (automationId) await prisma.automation.deleteMany({ where: { id: automationId } });
    if (sequenceId) await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.emailTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await saveOutreachSettings(settingsBefore);
    await prisma.$disconnect();
  });

  it("a person's question is answered in the thread, and the sequence stops", async () => {
    const sent = await sendFirstEmail("Sana");
    ai.answer = JSON.stringify({ category: "question", summary: "Asks what a chatbot costs", reply: ANSWER });
    expect(await handleInboundMail(reply("Sana", sent.providerMessageId, "How much would a chatbot cost for our clinic?\r\n\r\n> Hi Sana."), meta("sana"))).toBe("REPLY");

    // Until the reply is read the follow-up is held back, but nothing is decided yet.
    const held = await prisma.automationJob.findFirstOrThrow({ where: { type: "RUN_STEP", refId: sent.runId, status: "PENDING" } });
    expect(held.runAt.getTime()).toBeGreaterThan(Date.now() + 55 * 60_000);
    expect((await lead("Sana")).status).toBe("EMAIL_SENT");

    await drain();
    const sana = await lead("Sana");
    expect(sana.status).toBe("REPLIED");
    expect(sana.runs[0]).toMatchObject({ status: "STOPPED", stopReason: "REPLIED" });
    const answer = sana.messages.at(-1);
    expect(answer).toMatchObject({ subject: "Re: Step 1", status: "SENT", toEmail: `sana@${DOMAIN}`, runId: null });
    expect(answer?.bodyText).toContain("which number should we call?\n\nKind regards,\nThe BITSOL Marketing team");
    expect(sana.activities.map((a) => a.type)).toEqual(expect.arrayContaining(["REPLIED", "AI_REPLY_SENT"]));
    // The AI saw the lead's words without the quoted email, and the owner's notes.
    expect(ai.prompts.at(-1)).toContain("<<<\nHow much would a chatbot cost for our clinic?\n>>>");
    expect(ai.prompts.at(-1)).toContain("Offer a free website audit.");
    // Read once: running the jobs again sends nothing more.
    await runReplyJobs();
    expect((await lead("Sana")).messages).toHaveLength(answer ? sana.messages.length : 0);
  });

  it("an automatic reply the rules miss gets no answer, and the sequence goes on", async () => {
    const sent = await sendFirstEmail("Omar");
    ai.answer = JSON.stringify({ category: "auto_reply", summary: "Helpdesk acknowledgement", reply: "" });
    expect(await handleInboundMail(reply("Omar", sent.providerMessageId, "Dear sender, ticket opened. Ref 88812."), meta("omar"))).toBe("REPLY");
    await drain();
    const omar = await lead("Omar");
    expect(omar.status).toBe("EMAIL_SENT");
    expect(omar.runs[0].status).toBe("ACTIVE");
    expect(omar.messages).toHaveLength(1);
    expect(omar.activities.map((a) => a.type)).toContain("AUTO_REPLY_RECEIVED");
  });

  it("'please stop' unsubscribes the address without answering", async () => {
    const sent = await sendFirstEmail("Hina");
    ai.answer = JSON.stringify({ category: "unsubscribe", summary: "Asks to be removed", reply: "" });
    await handleInboundMail(reply("Hina", sent.providerMessageId, "Remove me from your list."), meta("hina"));
    await drain();
    const hina = await lead("Hina");
    expect(hina.status).toBe("UNSUBSCRIBED");
    expect(hina.messages).toHaveLength(1);
    expect(await isSuppressed(`hina@${DOMAIN}`)).toBe("UNSUBSCRIBED");
  });

  it("when the AI cannot answer three times, a person gets the reply", async () => {
    const sent = await sendFirstEmail("Asad");
    ai.fail = true;
    try {
      await handleInboundMail(reply("Asad", sent.providerMessageId, "Can you call me on Monday?"), meta("asad"));
      await drain();
      expect((await lead("Asad")).status).toBe("EMAIL_SENT");
      await runReplyJobs();
      await runReplyJobs();
    } finally {
      ai.fail = false;
    }
    const asad = await lead("Asad");
    expect(asad.status).toBe("REPLIED");
    expect(asad.runs[0].status).toBe("STOPPED");
    expect(asad.messages).toHaveLength(1);
    expect(asad.activities.find((a) => a.type === "REPLIED")?.detail).toContain("The AI could not read this reply");
  });

  it("in draft mode the answer goes on the timeline, not to the lead", async () => {
    await saveOutreachSettings({ autoReplyMode: "draft" });
    try {
      const sent = await sendFirstEmail("Nadia");
      ai.answer = JSON.stringify({ category: "interested", summary: "Wants a call", reply: ANSWER.replace("Sana", "Nadia") });
      await handleInboundMail(reply("Nadia", sent.providerMessageId, "Sounds good, call me."), meta("nadia"));
      await drain();
      const nadia = await lead("Nadia");
      expect(nadia.status).toBe("REPLIED");
      expect(nadia.messages).toHaveLength(1);
      expect(nadia.activities.find((a) => a.title.startsWith("Suggested answer"))?.detail).toContain("Hi Nadia,");
    } finally {
      await saveOutreachSettings({ autoReplyMode: "auto" });
    }
  });
});
