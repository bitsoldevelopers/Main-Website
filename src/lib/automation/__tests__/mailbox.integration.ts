import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Nothing in this file may deliver an email or touch a remote database. The
// one test that leaves test mode points SMTP at a closed local port.
process.env.OUTREACH_EMAIL_MODE = "test";
process.env.ADMIN_SECRET ||= "integration-test-secret";

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
const { saveMailboxConfig } = await import("../email/mailbox");
const { clearSmtpPause, smtpPause } = await import("../email/smtp");
const { DRIP_ACTOR, runDrip } = await import("../drip");
const { suppress } = await import("../suppression");

const RUN = `mb${Date.now().toString(36)}`;
const COMPANY = `Zztest ${RUN} Mailbox`;
const DOMAIN = `${RUN}-zztest.com`;
const OWN = `outreach@${DOMAIN}`;
const HEADERS = SHEET_COLUMNS.map((column) => column.header);
const mapping = Object.fromEntries(SHEET_COLUMNS.map((column) => [column.field, column.header]));

const imports: string[] = [];
const templateIds: string[] = [];
let automationId = "";
let sequenceId = "";
let settingsBefore: Awaited<ReturnType<typeof getOutreachSettings>>;
let mailboxRowsBefore: { key: string; value: string }[] = [];

async function drain() {
  for (let i = 0; i < 10; i++) {
    const report = await runDueJobs({ source: "test", budgetMs: 60_000 });
    if (report.skipped) throw new Error(report.skipped);
    if (report.claimed === 0) return;
  }
}

const lead = (firstName: string) =>
  prisma.lead.findFirstOrThrow({
    where: { company: COMPANY, firstName },
    include: { emails: true, runs: true, messages: { orderBy: { createdAt: "asc" } } },
  });

/** Enrols a lead, sends email 1 in test mode, then makes the row look like an SMTP send. */
async function sendFirstEmail(firstName: string): Promise<{ leadId: string; runId: string; messageId: string; providerMessageId: string }> {
  const { id } = await lead(firstName);
  const enrolled = await enrollLead({ leadId: id, automationId, actor: "Integration test" });
  if (!enrolled.ok) throw new Error(enrolled.message);
  await drain();
  const message = await prisma.emailMessage.findFirstOrThrow({ where: { leadId: id }, orderBy: { createdAt: "asc" } });
  const providerMessageId = `bitsol-outreach-${message.id}@${DOMAIN}`;
  await prisma.emailMessage.update({ where: { id: message.id }, data: { provider: "smtp", providerMessageId } });
  return { leadId: id, runId: enrolled.runId, messageId: message.id, providerMessageId };
}

function raw(headers: string[], body = "Thanks for reaching out."): string {
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

const meta = (key: string) => ({ ownAddress: OWN, eventKey: `test:${RUN}:${key}`, receivedAt: new Date() });

describe.runIf(local)("outreach mailbox: replies and bounces from the inbox, against the local database", () => {
  beforeAll(async () => {
    settingsBefore = await getOutreachSettings();
    mailboxRowsBefore = await prisma.siteSetting.findMany({
      where: { OR: [{ key: { startsWith: "outreach.mailbox." } }, { key: "outreach.drip.cursor" }] },
      select: { key: true, value: true },
    });
    await saveOutreachSettings({ fromName: "BITSOL Test", fromEmail: OWN, replyTo: "", companyAddress: "1 Test Road, Lahore", dailyLimit: 2000, batchLimit: 100 });

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

    const people = ["Rina", "Tariq", "Zoe", "Bilal", "Hamza", "Sana"];
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
    process.env.OUTREACH_EMAIL_MODE = "test";
    clearSmtpPause();
    const leads = await prisma.lead.findMany({ where: { company: COMPANY }, select: { id: true } });
    const ids = leads.map((l) => l.id);
    const runs = await prisma.automationRun.findMany({ where: { leadId: { in: ids } }, select: { id: true } });
    await prisma.automationJob.deleteMany({ where: { OR: [{ refId: { in: runs.map((r) => r.id) } }, { refId: { in: imports } }] } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    await prisma.leadImport.deleteMany({ where: { id: { in: imports } } });
    await prisma.leadSource.deleteMany({ where: { key: { contains: RUN } } });
    await prisma.company.deleteMany({ where: { nameKey: { contains: RUN } } });
    await prisma.suppressionEntry.deleteMany({ where: { value: { contains: RUN } } });
    if (automationId) await prisma.automation.deleteMany({ where: { id: automationId } });
    if (sequenceId) await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.emailTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await saveOutreachSettings(settingsBefore);
    await prisma.siteSetting.deleteMany({ where: { OR: [{ key: { startsWith: "outreach.mailbox." } }, { key: "outreach.drip.cursor" }] } });
    if (mailboxRowsBefore.length) await prisma.siteSetting.createMany({ data: mailboxRowsBefore });
    await prisma.$disconnect();
  });

  it("a reply that answers our email stops the sequence, even from another address", async () => {
    const sent = await sendFirstEmail("Rina");
    const reply = raw([
      `From: Assistant <assistant@${DOMAIN}>`,
      `To: ${OWN}`,
      "Subject: Re: Step 1",
      `Message-ID: <reply-rina-${RUN}@mail.example.com>`,
      `In-Reply-To: <${sent.providerMessageId}>`,
    ]);
    expect(await handleInboundMail(reply, meta("rina"))).toBe("REPLY");
    // The scheduler may read the same message again: nothing changes.
    expect(await handleInboundMail(reply, meta("rina"))).toBe("IGNORED");

    const rina = await lead("Rina");
    expect(rina.status).toBe("REPLIED");
    expect(rina.runs[0]).toMatchObject({ status: "STOPPED", stopReason: "REPLIED" });
    expect(rina.messages[0].status).toBe("REPLIED");
    expect(await prisma.emailEvent.count({ where: { messageId: sent.messageId, type: "RECEIVED" } })).toBe(1);
  });

  it("a reply without threading headers is matched by the sender's address", async () => {
    await sendFirstEmail("Tariq");
    const reply = raw([`From: Tariq Test <TARIQ@${DOMAIN.toUpperCase()}>`, "Subject: interested, call me", `Message-ID: <reply-tariq-${RUN}@x.example>`]);
    expect(await handleInboundMail(reply, meta("tariq"))).toBe("REPLY");
    expect((await lead("Tariq")).status).toBe("REPLIED");
  });

  it("an out-of-office reply changes nothing, and the follow-up still goes out", async () => {
    const sent = await sendFirstEmail("Zoe");
    const ooo = raw([`From: zoe@${DOMAIN}`, "Subject: Automatic reply: Step 1", "Auto-Submitted: auto-replied", `In-Reply-To: <${sent.providerMessageId}>`]);
    expect(await handleInboundMail(ooo, meta("zoe"))).toBe("AUTO_REPLY");

    const zoe = await lead("Zoe");
    expect(zoe.status).toBe("EMAIL_SENT");
    expect(zoe.runs[0].status).toBe("ACTIVE");
    await prisma.automationJob.updateMany({ where: { type: "RUN_STEP", refId: sent.runId, status: "PENDING" }, data: { runAt: new Date(Date.now() - 1000) } });
    await drain();
    expect((await lead("Zoe")).messages).toHaveLength(2);
  });

  it("a bounce report quoting our Message-ID suppresses the address and stops the run", async () => {
    const sent = await sendFirstEmail("Bilal");
    const dsn = raw(
      [
        "From: Mail Delivery System <MAILER-DAEMON@mx1.hostinger.com>",
        "Subject: Undelivered Mail Returned to Sender",
        `Message-ID: <dsn-bilal-${RUN}@mx1.hostinger.com>`,
        'Content-Type: multipart/report; report-type=delivery-status; boundary="b"',
      ],
      [
        "--b",
        "Content-Type: message/delivery-status",
        "",
        `Final-Recipient: rfc822; bilal@${DOMAIN}`,
        "Action: failed",
        "Status: 5.1.1",
        "Diagnostic-Code: smtp; 550 5.1.1 User unknown",
        "--b",
        "Content-Type: text/rfc822-headers",
        "",
        `Message-ID: <${sent.providerMessageId}>`,
        "--b--",
      ].join("\r\n")
    );
    expect(await handleInboundMail(dsn, meta("bilal"))).toBe("BOUNCE");

    const bilal = await lead("Bilal");
    expect(bilal.status).toBe("BOUNCED");
    expect(bilal.runs[0]).toMatchObject({ status: "STOPPED" });
    expect(bilal.emails[0]).toMatchObject({ validity: "INVALID", validityReason: "BOUNCED" });
    expect(bilal.messages[0].status).toBe("BOUNCED");
    expect(await prisma.suppressionEntry.count({ where: { value: `bilal@${DOMAIN}`, reason: "BOUNCED" } })).toBe(1);
  });

  it("a non-standard bounce is matched by the failed address", async () => {
    await sendFirstEmail("Hamza");
    const notice = raw(["From: MAILER-DAEMON@mail.example.net", "Subject: failure notice", `Message-ID: <qmail-hamza-${RUN}@mail.example.net>`], `Hi. This is the qmail-send program.\n\n<hamza@${DOMAIN}>:\nSorry, no mailbox here by that name.`);
    expect(await handleInboundMail(notice, meta("hamza"))).toBe("BOUNCE");
    expect((await lead("Hamza")).status).toBe("BOUNCED");
  });

  it("mail from strangers and from the mailbox itself is left alone", async () => {
    expect(await handleInboundMail(raw(["From: someone@unknown-zztest.org", "Subject: hello"]), meta("stranger"))).toBe("IGNORED");
    expect(await handleInboundMail(raw([`From: ${OWN}`, "Subject: note to self"]), meta("self"))).toBe("IGNORED");
  });

  it("the daily drip starts imported prospects a few at a time, passing over one it cannot email", async () => {
    const names = ["Dripa", "Dripb", "Dripc", "Dripd", "Dripe"];
    const before = new Date(Date.now() - 1000);
    const importId = await queueCsvImport({
      filename: `${RUN}-drip.csv`,
      table: parseCsv(
        toCsv(
          HEADERS,
          names.map((name) => HEADERS.map((header) => ({ "First Name": name, "Last Name": "Test", "Company Name": COMPANY, "Email 1": `${name.toLowerCase()}@${DOMAIN}` })[header] ?? ""))
        )
      ),
      settings: { ...DEFAULT_IMPORT_SETTINGS, mapping, checkDomains: false },
      actor: "Integration test",
    });
    imports.push(importId);
    await drain();
    // Only this test's prospects: start the list just before them.
    await prisma.siteSetting.upsert({
      where: { key: "outreach.drip.cursor" },
      update: { value: JSON.stringify({ createdAt: before.toISOString(), id: "" }) },
      create: { key: "outreach.drip.cursor", value: JSON.stringify({ createdAt: before.toISOString(), id: "" }) },
    });
    // The second prospect unsubscribed somewhere else since the import.
    await suppress({ value: `dripb@${DOMAIN}`, reason: "UNSUBSCRIBED", source: "Integration test" });
    await saveOutreachSettings({ dripPerDay: 3, dripAutomationId: automationId });

    const first = await runDrip();
    expect(first.started).toBe(3);
    const started = await prisma.automationRun.findMany({ where: { startedBy: DRIP_ACTOR, lead: { company: COMPANY } }, include: { lead: { select: { firstName: true } } } });
    expect(started.map((run) => run.lead.firstName).sort()).toEqual(["Dripa", "Dripc", "Dripd"]);

    // The day's quota is used up: nobody else starts until 24 hours have passed.
    expect((await runDrip()).started).toBe(0);
    expect((await lead("Dripe")).runs).toHaveLength(0);
    expect((await lead("Dripb")).runs).toHaveLength(0);

    // The started ones get their first email on the next scheduler pass.
    await drain();
    expect((await lead("Dripa")).messages).toHaveLength(1);
    await saveOutreachSettings({ dripPerDay: 0 });
  });

  it("a mailbox that refuses the connection pauses sending; it fails no lead", async () => {
    await saveMailboxConfig({ transport: "smtp", smtpHost: "127.0.0.1", smtpPort: 1, user: OWN, password: "wrong", imapHost: "127.0.0.1", imapPort: 1, watchInbox: false });
    process.env.OUTREACH_EMAIL_MODE = "";
    try {
      const { id } = await lead("Sana");
      const enrolled = await enrollLead({ leadId: id, automationId, actor: "Integration test" });
      expect(enrolled.ok).toBe(true);
      await drain();

      const sana = await lead("Sana");
      expect(sana.runs[0].status).toBe("ACTIVE");
      expect(sana.status).not.toBe("BOUNCED");
      expect(sana.messages).toHaveLength(1);
      expect(sana.messages[0]).toMatchObject({ status: "FAILED", provider: "smtp" });
      expect(smtpPause()).not.toBeNull();
      const job = await prisma.automationJob.findFirstOrThrow({ where: { type: "RUN_STEP", refId: enrolled.ok ? enrolled.runId : "", status: "PENDING" } });
      expect(job.lastError).toMatch(/paused/i);
      expect(job.runAt.getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    } finally {
      process.env.OUTREACH_EMAIL_MODE = "test";
      clearSmtpPause();
    }
  });
});
