import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Nothing in this file may ever deliver an email or touch a remote database.
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
const { enrollLead, handleLeadStatusChange, markLeadReplied, markUnsubscribed } = await import("../engine");
const { recordEmailEvent } = await import("../email/events");
const { buildSteps } = await import("../defaults");
const { queueCsvImport } = await import("../imports");
const { resolveReviewRow } = await import("../import-pipeline");
const { getOutreachSettings, saveOutreachSettings } = await import("../settings");
const { toCsv, parseCsv } = await import("../sources/csv");
const { DEFAULT_IMPORT_SETTINGS } = await import("../sources/types");
const { runDueJobs } = await import("../worker");

const RUN = `it${Date.now().toString(36)}`;
const COMPANY = `Zztest ${RUN} Technologies`;
const DOMAIN = `${RUN}-zztest.com`;
const HEADERS = SHEET_COLUMNS.map((column) => column.header);
const mapping = Object.fromEntries(SHEET_COLUMNS.map((column) => [column.field, column.header]));

type Row = Partial<Record<string, string>>;

function csv(rows: Row[]): string {
  return toCsv(
    HEADERS,
    rows.map((row) => HEADERS.map((header) => row[header] ?? ""))
  );
}

async function importCsv(rows: Row[], settings: Partial<typeof DEFAULT_IMPORT_SETTINGS> = {}) {
  const importId = await queueCsvImport({
    filename: `${RUN}.csv`,
    table: parseCsv(csv(rows)),
    settings: { ...DEFAULT_IMPORT_SETTINGS, mapping, checkDomains: false, tags: [`${RUN}-tag`], ...settings },
    actor: "Integration test",
  });
  await drain();
  const batch = await prisma.leadImport.findUniqueOrThrow({ where: { id: importId }, include: { rows: { orderBy: { rowNumber: "asc" } } } });
  imports.push(importId);
  return batch;
}

/** Runs the queue until nothing of ours is due. */
async function drain() {
  for (let i = 0; i < 10; i++) {
    const report = await runDueJobs({ source: "test", budgetMs: 60_000 });
    if (report.skipped) throw new Error(report.skipped);
    if (report.claimed === 0) return;
  }
}

/** Makes a run's waiting job due now, as if the days had passed. */
async function fastForward(runId: string) {
  await prisma.automationJob.updateMany({ where: { type: "RUN_STEP", refId: runId, status: "PENDING" }, data: { runAt: new Date(Date.now() - 1000) } });
  await drain();
}

const imports: string[] = [];
let automationId = "";
let sequenceId = "";
const templateIds: string[] = [];
let settingsBefore: Awaited<ReturnType<typeof getOutreachSettings>>;

const leadsOfRun = () => prisma.lead.findMany({ where: { company: COMPANY }, include: { emails: true, phones: true, tags: true }, orderBy: { sourceRow: "asc" } });
const leadByFirstName = async (firstName: string) =>
  prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName }, include: { emails: true, runs: true, tasks: true, followUps: true, messages: { orderBy: { createdAt: "asc" } } } });

const JOHN: Row = {
  "First Name": "John",
  "Last Name": "Smith",
  Title: "CEO",
  "Company Name": COMPANY,
  Website: `www.${DOMAIN}`,
  "Contact LI Profile URL": `https://www.linkedin.com/in/john-smith-${RUN}/`,
  "Email 1": `John@${DOMAIN}`,
  "Email 2": `john.smith@${DOMAIN}`,
  "Personal Email": `johnsmith.${RUN}@gmail.com`,
  "Contact Phone 1": "+1 (415) 555-1234",
  "Company Phone 1": "+1 415 555 0000",
  "Contact Phone 2": "+1 415 555 2222",
  "Contact Phone 3": "+1 415 555 3333",
  "Contact Location": "San Francisco, CA",
  "Company Description": `${COMPANY} provides enterprise software solutions. `.repeat(30).trim(),
};
const SARAH: Row = { "First Name": "Sarah", "Last Name": "Khan", Title: "Marketing Manager", "Company Name": COMPANY, "Email 1": `sarah@${DOMAIN}`, "Company Phone 1": "+1 415 555 0000" };
const ALI: Row = { "First Name": "Ali", "Last Name": "Ahmed", Title: "CTO", "Company Name": COMPANY, "Email 1": `ali@${DOMAIN}`, "Email 2": `ali.ahmed@${DOMAIN}` };
const MAYA: Row = { "First Name": "Maya", "Last Name": "Lopez", "Company Name": COMPANY, "Email 1": `maya@${DOMAIN}` };
const OMAR: Row = { "First Name": "Omar", "Last Name": "Farooq", "Company Name": COMPANY, "Email 1": `omar@${DOMAIN}` };
const NOEMAIL: Row = { "First Name": "Nadia", "Last Name": "Noemail", "Company Name": COMPANY, "Contact Phone 1": "0300 1234567" };

describe.runIf(local)("import and automation, against the local database", () => {
  beforeAll(async () => {
    settingsBefore = await getOutreachSettings();
    await saveOutreachSettings({
      fromName: "BITSOL Test",
      fromEmail: "outreach@bitsolmarketing.com",
      replyTo: "",
      companyAddress: "1 Test Road, Lahore",
      dailyLimit: 2000,
      batchLimit: 100,
    });

    const sequence = await prisma.emailSequence.create({ data: { name: `${RUN} sequence` } });
    sequenceId = sequence.id;
    const steps = [];
    for (const [i, delayDays] of [0, 2, 4, 7].entries()) {
      const template = await prisma.emailTemplate.create({
        data: { name: `${RUN} email ${i + 1}`, subject: `Step ${i + 1} for {{company_name}}`, body: "Hi {{first_name|there}},\n\n{{#title}}As {{title}}, {{/title}}a note about {{company_name}}." },
      });
      templateIds.push(template.id);
      steps.push(await prisma.emailSequenceStep.create({ data: { sequenceId, order: i + 1, name: `Email ${i + 1}`, delayDays, templateId: template.id } }));
    }
    const automation = await prisma.automation.create({
      data: { name: `${RUN} automation`, status: "ACTIVE", sequenceId, createTask: true, taskTitle: "Call {{first_name}}", createdBy: "Integration test" },
    });
    automationId = automation.id;
    await prisma.automationStep.createMany({ data: buildSteps(automationId, steps, true) });
  });

  afterAll(async () => {
    const leads = await prisma.lead.findMany({ where: { company: COMPANY }, select: { id: true } });
    const ids = leads.map((lead) => lead.id);
    const runs = await prisma.automationRun.findMany({ where: { leadId: { in: ids } }, select: { id: true } });
    await prisma.automationJob.deleteMany({ where: { OR: [{ refId: { in: runs.map((r) => r.id) } }, { refId: { in: imports } }] } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    await prisma.leadImport.deleteMany({ where: { id: { in: imports } } });
    await prisma.leadSource.deleteMany({ where: { key: { contains: RUN } } });
    await prisma.company.deleteMany({ where: { nameKey: { contains: RUN } } });
    await prisma.tag.deleteMany({ where: { name: { contains: RUN } } });
    await prisma.suppressionEntry.deleteMany({ where: { value: { contains: RUN } } });
    if (automationId) await prisma.automation.deleteMany({ where: { id: automationId } });
    if (sequenceId) await prisma.emailSequence.deleteMany({ where: { id: sequenceId } });
    await prisma.emailTemplate.deleteMany({ where: { id: { in: templateIds } } });
    await saveOutreachSettings(settingsBefore);
    await prisma.$disconnect();
  });

  it("imports a sheet: creates, de-duplicates, rejects and reports", async () => {
    const batch = await importCsv([
      JOHN,
      SARAH,
      ALI,
      // The same John, written differently: a duplicate, not a second lead.
      { "First Name": "JOHN", "Last Name": "smith", "Company Name": COMPANY, "Email 1": `  JOHN@${DOMAIN.toUpperCase()} ` },
      {},
      // Nothing to identify anyone by.
      { Title: "Manager", "Contact Location": "Dubai" },
      MAYA,
      OMAR,
      NOEMAIL,
      { "First Name": "Bad", "Last Name": "Email", "Company Name": COMPANY, "Email 1": "not-an-email" },
    ]);

    expect(batch.status).toBe("COMPLETED");
    expect(batch).toMatchObject({ totalRows: 9, createdCount: 7, updatedCount: 0, duplicateCount: 1, invalidCount: 1, failedCount: 0 });
    expect(batch.payload).toBeNull();
    expect(batch.rows.map((row) => row.outcome)).toEqual(["CREATED", "CREATED", "CREATED", "DUPLICATE", "INVALID", "CREATED", "CREATED", "CREATED", "CREATED"]);
    expect(batch.rows[3].matchLevel).toBe("PRIMARY_EMAIL");
    expect(batch.rows[3].rowNumber).toBe(5);

    const quality = batch.quality as Record<string, number>;
    expect(quality).toMatchObject({ totalRows: 9, validEmails: 6, invalidEmails: 1, missingEmails: 2, duplicateEmails: 1 });

    const leads = await leadsOfRun();
    expect(leads).toHaveLength(7);
    expect(new Set(leads.map((lead) => lead.companyId)).size).toBe(1);
    expect(await prisma.company.count({ where: { nameKey: { contains: RUN } } })).toBe(1);
  });

  it("stores every field separately and exactly as supplied", async () => {
    const john = await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "John" }, include: { emails: true, phones: true, tags: { include: { tag: true } }, companyRef: true, leadSource: true } });

    expect(john).toMatchObject({
      name: "John Smith",
      lastName: "Smith",
      jobTitle: "CEO",
      contactLocation: "San Francisco, CA",
      linkedinUrl: JOHN["Contact LI Profile URL"],
      source: "csv",
      sourceRow: 2,
      subject: "Outreach prospect",
      status: "READY_FOR_OUTREACH",
      outreachEmail: `John@${DOMAIN}`,
      outreachEmailReason: "PRIMARY_EMAIL",
    });
    expect(john.companyDescription).toBe(JOHN["Company Description"]);
    expect(john.companyDescription!.length).toBeGreaterThan(1000);
    expect(john.sourceImportId).toBe(imports[0]);
    expect(john.leadSource?.type).toBe("csv");
    expect(john.companyRef?.domain).toBe(DOMAIN);

    expect(Object.fromEntries(john.emails.map((e) => [e.type, e.email]))).toEqual({
      PRIMARY: `John@${DOMAIN}`,
      SECONDARY: `john.smith@${DOMAIN}`,
      PERSONAL: `johnsmith.${RUN}@gmail.com`,
    });
    expect(john.emails.filter((e) => e.isOutreach).map((e) => e.type)).toEqual(["PRIMARY"]);
    expect(Object.fromEntries(john.phones.map((p) => [p.type, p.phone]))).toEqual({
      PRIMARY: "+1 (415) 555-1234",
      SECONDARY: "+1 415 555 2222",
      TERTIARY: "+1 415 555 3333",
      COMPANY: "+1 415 555 0000",
    });
    expect(john.tags.map((t) => t.tag.name)).toEqual([`${RUN}-tag`]);

    const types = (await prisma.leadActivity.findMany({ where: { leadId: john.id }, orderBy: { createdAt: "asc" } })).map((a) => a.type);
    expect(types).toEqual(["IMPORTED", "LEAD_CREATED", "DUPLICATE_CHECKED", "OUTREACH_EMAIL_SELECTED", "TAGGED"]);

    const nadia = await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "Nadia" } });
    expect(nadia).toMatchObject({ status: "IMPORTED", outreachEmail: null, outreachEmailReason: "NO_EMAIL", email: "" });
    const bad = await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "Bad" }, include: { emails: true } });
    expect(bad).toMatchObject({ status: "IMPORTED", outreachEmail: null, outreachEmailReason: "NO_ELIGIBLE_EMAIL" });
    expect(bad.emails[0]).toMatchObject({ email: "not-an-email", validity: "INVALID", validityReason: "BAD_FORMAT" });
  });

  it("updates existing leads on re-import and never duplicates them", async () => {
    const batch = await importCsv([
      JOHN,
      { ...SARAH, Title: "Head of Marketing", "Contact Phone 1": "+1 415 555 9999" },
      // Matched by LinkedIn alone; an empty cell must not erase the title.
      { "Contact LI Profile URL": `linkedin.com/in/John-Smith-${RUN}`, "Contact Location": "New York, NY" },
    ]);
    expect(batch).toMatchObject({ totalRows: 3, createdCount: 0, updatedCount: 1, duplicateCount: 1, skippedCount: 1 });
    expect(batch.rows.map((row) => [row.outcome, row.matchLevel])).toEqual([
      ["UNCHANGED", "PRIMARY_EMAIL"],
      ["UPDATED", "PRIMARY_EMAIL"],
      ["DUPLICATE", "LINKEDIN"],
    ]);
    expect(await prisma.lead.count({ where: { company: COMPANY } })).toBe(7);

    const sarah = await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "Sarah" }, include: { phones: true } });
    expect(sarah.jobTitle).toBe("Head of Marketing");
    expect(sarah.phones.find((p) => p.type === "PRIMARY")?.phone).toBe("+1 415 555 9999");
    const john = await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "John" } });
    expect(john).toMatchObject({ jobTitle: "CEO", contactLocation: "San Francisco, CA" });
  });

  it("skips or holds duplicates when asked to", async () => {
    const skipped = await importCsv([{ ...ALI, Title: "Chief Technology Officer" }], { duplicateMode: "SKIP" });
    expect(skipped).toMatchObject({ createdCount: 0, updatedCount: 0, duplicateCount: 1 });
    expect((await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "Ali" } })).jobTitle).toBe("CTO");

    const held = await importCsv([{ ...ALI, Title: "Chief Technology Officer" }], { duplicateMode: "REVIEW" });
    expect(held.rows[0].outcome).toBe("REVIEW");
    expect((await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "Ali" } })).jobTitle).toBe("CTO");

    expect(await resolveReviewRow(held.rows[0].id, "UPDATE")).toBe("UPDATED");
    expect((await prisma.lead.findFirstOrThrow({ where: { company: COMPANY, firstName: "Ali" } })).jobTitle).toBe("Chief Technology Officer");
    expect(await prisma.leadImport.findUniqueOrThrow({ where: { id: held.id } })).toMatchObject({ duplicateCount: 0, updatedCount: 1 });
  });

  it("runs the sequence: email, wait, follow-up, and stops the moment the lead replies", async () => {
    const john = await leadByFirstName("John");
    const enrolled = await enrollLead({ leadId: john.id, automationId, actor: "Integration test" });
    expect(enrolled).toMatchObject({ ok: true, toEmail: `John@${DOMAIN}` });
    if (!enrolled.ok) return;
    expect((await leadByFirstName("John")).status).toBe("EMAIL_QUEUED");

    // A lead can only be in one automation at a time.
    expect(await enrollLead({ leadId: john.id, automationId, actor: "Integration test" })).toMatchObject({ ok: false, reason: "ALREADY_RUNNING" });

    await drain();
    let lead = await leadByFirstName("John");
    expect(lead.status).toBe("EMAIL_SENT");
    expect(lead.messages).toHaveLength(1);
    expect(lead.messages[0]).toMatchObject({ status: "SENT", provider: "test", toEmail: `john@${DOMAIN}`, subject: `Step 1 for ${COMPANY}`, stepOrder: 1 });
    expect(lead.messages[0].bodyText).toContain("Hi John,");
    expect(lead.messages[0].bodyText).toContain("As CEO, a note about");
    expect(lead.messages[0].bodyText).toContain("1 Test Road, Lahore");
    expect(lead.messages[0].bodyText).toMatch(/\/unsubscribe\?token=/);
    expect(lead.messages[0].bodyHtml).toContain("unsubscribe");
    expect(lead.lastContactedAt).not.toBeNull();
    expect(lead.followUps.filter((f) => f.status === "SCHEDULED")).toHaveLength(1);
    const days = (lead.nextFollowUpAt!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(1.9);
    expect(days).toBeLessThan(2.1);

    // Nothing is due, so another pass sends nothing.
    await drain();
    expect((await leadByFirstName("John")).messages).toHaveLength(1);

    await fastForward(enrolled.runId);
    lead = await leadByFirstName("John");
    expect(lead.status).toBe("FOLLOW_UP");
    expect(lead.messages.map((m) => m.subject)).toEqual([`Step 1 for ${COMPANY}`, `Step 2 for ${COMPANY}`]);
    expect(lead.followUps.map((f) => f.status).sort()).toEqual(["SCHEDULED", "SENT"]);

    expect(await markLeadReplied({ leadId: john.id, actor: "Integration test" })).toBe(true);
    lead = await leadByFirstName("John");
    expect(lead.status).toBe("REPLIED");
    expect(lead.runs[0]).toMatchObject({ status: "STOPPED", stopReason: "REPLIED", emailsSent: 2 });
    expect(lead.followUps.map((f) => f.status).sort()).toEqual(["CANCELLED", "SENT"]);
    expect(lead.nextFollowUpAt).toBeNull();
    expect(lead.tasks.map((t) => t.title)).toEqual(["Reply to John Smith"]);
    expect(lead.messages[1].status).toBe("REPLIED");
    expect(await prisma.automationJob.count({ where: { refId: enrolled.runId, status: "PENDING" } })).toBe(0);

    // Even a job that slipped through must not send after a reply.
    await prisma.automationJob.create({ data: { type: "RUN_STEP", refId: enrolled.runId, runAt: new Date(Date.now() - 1000) } });
    await drain();
    expect((await leadByFirstName("John")).messages).toHaveLength(2);
    expect(await enrollLead({ leadId: john.id, automationId, actor: "Integration test" })).toMatchObject({ ok: false });

    const types = (await prisma.leadActivity.findMany({ where: { leadId: john.id }, orderBy: { createdAt: "asc" } })).map((a) => a.type);
    expect(types.slice(5)).toEqual([
      "AUTOMATION_STARTED",
      "EMAIL_SENT",
      "FOLLOW_UP_SCHEDULED",
      "FOLLOW_UP_SENT",
      "FOLLOW_UP_SCHEDULED",
      "REPLIED",
      "AUTOMATION_STOPPED",
      "TASK_CREATED",
    ]);
  });

  it("finishes a silent lead with a human follow-up task", async () => {
    const sarah = await leadByFirstName("Sarah");
    const enrolled = await enrollLead({ leadId: sarah.id, automationId, actor: "Integration test" });
    expect(enrolled.ok).toBe(true);
    if (!enrolled.ok) return;
    await drain();
    for (let i = 0; i < 3; i++) await fastForward(enrolled.runId);

    const lead = await leadByFirstName("Sarah");
    expect(lead.messages.map((m) => m.stepOrder)).toEqual([1, 3, 5, 7]);
    expect(lead.messages.every((m) => m.status === "SENT")).toBe(true);
    expect(lead.runs[0]).toMatchObject({ status: "COMPLETED", emailsSent: 4 });
    expect(lead.status).toBe("FOLLOW_UP");
    expect(lead.tasks).toHaveLength(1);
    expect(lead.tasks[0]).toMatchObject({ title: "Call Sarah", source: "AUTOMATION", status: "OPEN" });
    expect(lead.followUpAt).not.toBeNull();
  });

  it("stops when the lead is won, and pauses and resumes by hand", async () => {
    const ali = await leadByFirstName("Ali");
    const enrolled = await enrollLead({ leadId: ali.id, automationId, actor: "Integration test" });
    if (!enrolled.ok) throw new Error(enrolled.message);
    await drain();

    await prisma.lead.update({ where: { id: ali.id }, data: { status: "PAUSED" } });
    await handleLeadStatusChange(ali.id, "PAUSED", "Integration test");
    expect((await leadByFirstName("Ali")).runs[0].status).toBe("PAUSED");
    await fastForward(enrolled.runId);
    expect((await leadByFirstName("Ali")).messages).toHaveLength(1);

    await prisma.lead.update({ where: { id: ali.id }, data: { status: "WON" } });
    await handleLeadStatusChange(ali.id, "WON", "Integration test");
    const lead = await leadByFirstName("Ali");
    expect(lead.runs[0]).toMatchObject({ status: "STOPPED", stopReason: "WON" });
    await fastForward(enrolled.runId);
    expect((await leadByFirstName("Ali")).messages).toHaveLength(1);
  });

  it("stops on a bounce and never uses that address again", async () => {
    const maya = await leadByFirstName("Maya");
    const enrolled = await enrollLead({ leadId: maya.id, automationId, actor: "Integration test" });
    if (!enrolled.ok) throw new Error(enrolled.message);
    await drain();
    const sent = (await leadByFirstName("Maya")).messages[0];

    const event = {
      type: "BOUNCED" as const,
      providerEventId: `${RUN}-bounce-1`,
      providerMessageId: sent.providerMessageId,
      occurredAt: new Date(),
      detail: "550 mailbox does not exist",
      permanent: true,
      payload: { test: true },
    };
    expect(await recordEmailEvent(event)).toBe("RECORDED");
    // The provider retries webhooks; the second delivery must change nothing.
    expect(await recordEmailEvent(event)).toBe("DUPLICATE");

    const lead = await leadByFirstName("Maya");
    expect(lead.status).toBe("BOUNCED");
    expect(lead.runs[0]).toMatchObject({ status: "STOPPED", stopReason: "BOUNCED" });
    expect(lead.emails[0]).toMatchObject({ validity: "INVALID", validityReason: "BOUNCED" });
    expect(lead.emails[0].bouncedAt).not.toBeNull();
    expect(lead.outreachEmail).toBeNull();
    expect(lead.messages[0].status).toBe("BOUNCED");
    expect(await prisma.emailEvent.count({ where: { messageId: sent.id, type: "BOUNCED" } })).toBe(1);

    await fastForward(enrolled.runId);
    expect((await leadByFirstName("Maya")).messages).toHaveLength(1);
  });

  it("honours an unsubscribe everywhere", async () => {
    const omar = await leadByFirstName("Omar");
    const enrolled = await enrollLead({ leadId: omar.id, automationId, actor: "Integration test" });
    if (!enrolled.ok) throw new Error(enrolled.message);
    await drain();

    await markUnsubscribed({ leadId: omar.id, email: `OMAR@${DOMAIN}`, source: "Unsubscribe link" });
    const lead = await leadByFirstName("Omar");
    expect(lead.status).toBe("UNSUBSCRIBED");
    expect(lead.runs[0]).toMatchObject({ status: "STOPPED", stopReason: "UNSUBSCRIBED" });
    expect(lead.outreachEmail).toBeNull();
    expect(await prisma.suppressionEntry.findUnique({ where: { value: `omar@${DOMAIN}` } })).toMatchObject({ reason: "UNSUBSCRIBED" });

    await fastForward(enrolled.runId);
    expect((await leadByFirstName("Omar")).messages).toHaveLength(1);

    // The person opted out, not one mailbox: their other addresses go too.
    const multi = await importCsv([{ "First Name": "Tara", "Last Name": "Twomail", "Company Name": COMPANY, "Email 1": `tara@${DOMAIN}`, "Personal Email": `tara.${RUN}@gmail.com` }]);
    expect(multi.createdCount).toBe(1);
    const tara = await leadByFirstName("Tara");
    await markUnsubscribed({ leadId: tara.id, email: `tara@${DOMAIN}`, source: "Unsubscribe link" });
    expect(await leadByFirstName("Tara")).toMatchObject({ status: "UNSUBSCRIBED", outreachEmail: null, outreachEmailReason: "NO_ELIGIBLE_EMAIL" });
    expect(await prisma.suppressionEntry.findUnique({ where: { value: `tara.${RUN}@gmail.com` } })).toMatchObject({ reason: "UNSUBSCRIBED" });
    await prisma.lead.update({ where: { id: tara.id }, data: { status: "READY_FOR_OUTREACH" } });
    expect(await enrollLead({ leadId: tara.id, automationId, actor: "Integration test" })).toMatchObject({ ok: false, reason: "NO_OUTREACH_EMAIL" });

    // Importing the address again must not make it emailable again.
    await prisma.lead.delete({ where: { id: omar.id } });
    await importCsv([OMAR], { autoStartAutomation: true, automationId });
    const again = await leadByFirstName("Omar");
    expect(again).toMatchObject({ status: "IMPORTED", outreachEmail: null, outreachEmailReason: "NO_ELIGIBLE_EMAIL" });
    expect(again.runs).toHaveLength(0);
    expect(again.messages).toHaveLength(0);
  });

  it("starts the automation for new leads of an import, and only for those", async () => {
    const batch = await importCsv(
      [
        { "First Name": "Zed", "Last Name": "Newlead", "Company Name": COMPANY, "Email 1": `zed@${DOMAIN}` },
        SARAH,
        NOEMAIL,
      ],
      { autoStartAutomation: true, automationId }
    );
    expect(batch).toMatchObject({ createdCount: 1, automationStarted: 1 });
    const zed = await leadByFirstName("Zed");
    expect(zed.runs).toHaveLength(1);
    expect(zed.messages).toHaveLength(1);
    expect(zed.status).toBe("EMAIL_SENT");
    expect((await leadByFirstName("Sarah")).runs).toHaveLength(1);
    expect((await leadByFirstName("Nadia")).runs).toHaveLength(0);
  });
});

describe.runIf(!local)("import and automation", () => {
  it("is skipped: DATABASE_URL does not point at localhost", () => {
    expect(local).toBe(false);
  });
});
