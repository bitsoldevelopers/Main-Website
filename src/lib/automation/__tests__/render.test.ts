import { describe, expect, it } from "vitest";
import { evaluateCondition, firstFailedCondition, stopReasonForStatus, type ConditionSubject } from "../conditions";
import { readUnsubscribeToken, decryptSecret, encryptSecret, unsubscribeToken } from "../crypto";
import { buildSteps, positionAfter } from "../defaults";
import { SAMPLE_VALUES, composeEmail, renderTemplate, templateValues, textToHtml, variablesIn, type TemplateValues } from "../email/render";
import { backoffMs } from "../queue";
import { stopsAutomation } from "@/lib/admin/leads";

const values: TemplateValues = { ...SAMPLE_VALUES };
const bare: TemplateValues = { ...SAMPLE_VALUES, first_name: "", title: "", company_name: "", personalization: "" };

describe("renderTemplate", () => {
  it("fills every supported variable", () => {
    const template =
      "{{first_name}} {{last_name}} | {{title}} | {{company_name}} | {{website}} | {{linkedin_url}} | {{contact_location}} | {{company_description}} | {{outreach_email}}";
    expect(renderTemplate(template, values).text).toBe(
      "John Smith | Marketing Director | ABC Technologies | https://abctechnologies.com | https://www.linkedin.com/in/john-smith | Dubai, UAE | ABC Technologies provides enterprise software solutions. | john@abctechnologies.com"
    );
  });

  it("uses the fallback when the lead has no value", () => {
    expect(renderTemplate("Hi {{first_name|there}},", bare).text).toBe("Hi there,");
    expect(renderTemplate("Hi {{ first_name | there }},", values).text).toBe("Hi John,");
  });

  it("leaves no stray punctuation behind an empty variable", () => {
    const result = renderTemplate("Hi {{first_name}}, welcome.", bare);
    expect(result.text).toBe("Hi, welcome.");
    expect(result.empty).toEqual(["first_name"]);
  });

  it("renders a section only when its variable has a value", () => {
    const template = "I came across {{company_name|your company}}{{#title}} and noticed that you are working as {{title}}{{/title}}.";
    expect(renderTemplate(template, values).text).toBe(
      "I came across ABC Technologies and noticed that you are working as Marketing Director."
    );
    expect(renderTemplate(template, bare).text).toBe("I came across your company.");
    expect(renderTemplate("{{^title}}No title on file.{{/title}}", bare).text).toBe("No title on file.");
  });

  it("reports unknown variables instead of printing them", () => {
    const result = renderTemplate("Hi {{first_name}}, your {{salary}} is {{#secret}}x{{/secret}}", values);
    expect(result.text).toBe("Hi John, your is");
    expect(result.unknown.sort()).toEqual(["salary", "secret"]);
  });

  it("never invents a value that is not in the CRM", () => {
    const fromLead = templateValues(
      { firstName: null, lastName: null, name: "Sarah Khan", company: null, companyDescription: null },
      { outreachEmail: "sarah@abc.com", senderName: "BITSOL", senderCompany: "BITSOL Marketing" }
    );
    expect(fromLead.first_name).toBe("Sarah");
    expect(fromLead.company_name).toBe("");
    expect(fromLead.company_description).toBe("");
    expect(fromLead.personalization).toBe("");
  });

  it("lists the variables a template uses", () => {
    expect(variablesIn("{{first_name|x}} {{#title}}{{title}}{{/title}} {{company_name}}").sort()).toEqual([
      "company_name",
      "first_name",
      "title",
    ]);
  });
});

describe("composeEmail", () => {
  const footer = {
    companyName: "BITSOL Marketing",
    companyAddress: "1 Example Road, Lahore",
    signature: "",
    unsubscribeUrl: "https://bitsolmarketing.com/unsubscribe?token=abc",
  };

  it("always carries the address and the unsubscribe link, in text and HTML", () => {
    const email = composeEmail({ subject: "A growth idea for {{company_name}}", body: "Hi {{first_name}},\n\nHello.", values, footer });
    expect(email.subject).toBe("A growth idea for ABC Technologies");
    for (const part of [email.text, email.html]) {
      expect(part).toContain("1 Example Road, Lahore");
      expect(part).toContain("https://bitsolmarketing.com/unsubscribe?token=abc");
    }
  });

  it("escapes CRM values so they cannot inject markup", () => {
    const hostile = { ...values, company_name: '<script>alert("x")</script>' };
    const email = composeEmail({ subject: "Hi", body: "About {{company_name}}", values: hostile, footer });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("keeps a subject on one line", () => {
    const hostile = { ...values, company_name: "ABC\r\nBcc: victim@example.com" };
    expect(composeEmail({ subject: "For {{company_name}}", body: "x", values: hostile, footer }).subject).not.toMatch(/[\r\n]/);
  });

  it("adds the call to action only when it has a safe link", () => {
    const withCta = composeEmail({ subject: "s", body: "b", ctaLabel: "See our services", ctaUrl: "bitsolmarketing.com/services", values, footer });
    expect(withCta.html).toContain('href="https://bitsolmarketing.com/services"');
    expect(withCta.text).toContain("See our services: https://bitsolmarketing.com/services");
    const unsafe = composeEmail({ subject: "s", body: "b", ctaLabel: "Click", ctaUrl: "javascript:alert(1)", values, footer });
    expect(unsafe.html).not.toContain("javascript:");
  });

  it("turns paragraphs and links into simple HTML", () => {
    expect(textToHtml("One\ntwo\n\nSee https://bitsolmarketing.com.")).toBe(
      '<p style="margin:0 0 16px">One<br>two</p>\n<p style="margin:0 0 16px">See <a href="https://bitsolmarketing.com/" style="color:#0891b2">https://bitsolmarketing.com</a>.</p>'
    );
  });
});

describe("automation rules", () => {
  const lead: ConditionSubject = {
    status: "READY_FOR_OUTREACH",
    source: "google_sheets",
    jobTitle: "Marketing Director",
    company: "ABC Technologies",
    contactLocation: "Dubai, UAE",
    website: null,
    linkedinUrl: "https://linkedin.com/in/john",
    phone: null,
    tags: ["Cold Lead", "UAE"],
  };

  it("evaluates entry conditions case-insensitively", () => {
    expect(evaluateCondition({ field: "location", operator: "contains", value: "uae" }, lead)).toBe(true);
    expect(evaluateCondition({ field: "tag", operator: "equals", value: "cold lead" }, lead)).toBe(true);
    expect(evaluateCondition({ field: "tag", operator: "not_equals", value: "SEO" }, lead)).toBe(true);
    expect(evaluateCondition({ field: "website", operator: "is_empty" }, lead)).toBe(true);
    expect(evaluateCondition({ field: "linkedin", operator: "is_set" }, lead)).toBe(true);
    expect(evaluateCondition({ field: "title", operator: "not_contains", value: "director" }, lead)).toBe(false);
  });

  it("blocks on a rule it does not understand", () => {
    expect(evaluateCondition({ field: "shoe_size", operator: "equals", value: "42" }, lead)).toBe(false);
    expect(firstFailedCondition([{ field: "status", operator: "bogus", value: "x" }], lead)).not.toBeNull();
  });

  it("stops on every status the specification lists, and pauses rather than stops on PAUSED", () => {
    for (const status of ["REPLIED", "WON", "LOST", "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED"]) {
      expect(stopReasonForStatus(status), status).toBe(status);
      expect(stopsAutomation(status), status).toBe(true);
    }
    expect(stopsAutomation("PAUSED")).toBe(true);
    expect(stopReasonForStatus("PAUSED")).toBeNull();
    expect(stopReasonForStatus("QUALIFIED")).toBe("HUMAN_TOOK_OVER");
    for (const status of ["NEW", "IMPORTED", "READY_FOR_OUTREACH", "EMAIL_QUEUED", "EMAIL_SENT", "FOLLOW_UP"]) {
      expect(stopReasonForStatus(status), status).toBeNull();
    }
  });

  it("builds the workflow from a sequence: wait, send, …, hand over", () => {
    const steps = buildSteps(
      "a1",
      [
        { id: "s1", name: "Email 1", delayDays: 0, order: 1 },
        { id: "s2", name: "Email 2", delayDays: 2, order: 2 },
        { id: "s3", name: "Email 3", delayDays: 4, order: 3 },
        { id: "s4", name: "Email 4", delayDays: 7, order: 4 },
      ],
      true
    );
    expect(steps.map((s) => (s.type === "WAIT" ? `WAIT ${s.waitDays}` : s.type))).toEqual([
      "SEND_EMAIL",
      "WAIT 2",
      "SEND_EMAIL",
      "WAIT 4",
      "SEND_EMAIL",
      "WAIT 7",
      "SEND_EMAIL",
      "CREATE_TASK",
    ]);
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // A run that has sent two emails is waiting to send the third.
    expect(steps[positionAfter(steps, 0)].label).toBe("Email 1");
    expect(steps[positionAfter(steps, 2)].label).toBe("Email 3");
    expect(steps[positionAfter(steps, 4)].type).toBe("CREATE_TASK");
    // The sequence was cut to one email after three were sent: only the hand-over is left.
    const shorter = buildSteps("a1", [{ id: "s1", name: "Email 1", delayDays: 0, order: 1 }], true);
    expect(shorter[positionAfter(shorter, 3)].type).toBe("CREATE_TASK");
  });

  it("backs off between retries and caps the wait", () => {
    expect([1, 2, 3, 4, 5, 9].map(backoffMs)).toEqual([60_000, 300_000, 900_000, 3_600_000, 10_800_000, 10_800_000]);
  });
});

describe("crypto", () => {
  process.env.ADMIN_SECRET ||= "test-secret-for-vitest";

  it("round-trips an encrypted token and rejects a tampered one", () => {
    const stored = encryptSecret("ya29.refresh-token");
    expect(stored).not.toContain("refresh-token");
    expect(decryptSecret(stored)).toBe("ya29.refresh-token");
    const [prefix, iv, tag, data] = stored.split(".");
    const tampered = [prefix, iv, tag, data.slice(0, -2) + (data.endsWith("AA") ? "BB" : "AA")].join(".");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("signs unsubscribe links so they cannot be edited", () => {
    const token = unsubscribeToken("lead_1", "John@Company.com");
    expect(readUnsubscribeToken(token)).toEqual({ leadId: "lead_1", email: "john@company.com" });

    const [body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ l: "lead_2", e: "victim@company.com" })).toString("base64url");
    expect(readUnsubscribeToken(`${forged}.${signature}`)).toBeNull();
    expect(readUnsubscribeToken(`${body}.`)).toBeNull();
    expect(readUnsubscribeToken("garbage")).toBeNull();
    expect(readUnsubscribeToken(null)).toBeNull();
  });
});
