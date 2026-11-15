import { describe, expect, it } from "vitest";
import { addressOf, classifyMail, decodeWords, parseHeaders } from "../email/inbox-parse";
import { bareMessageId, buildMessageId, classifySmtpError, describeSmtpError } from "../email/smtp";
import { describeImapError } from "../email/inbox";

describe("error descriptions never come out blank", () => {
  it("reads the reasons out of Node's AggregateError (IPv4 + IPv6 both refused)", () => {
    const both = new AggregateError([new Error("connect ECONNREFUSED ::1:1"), new Error("connect ECONNREFUSED 127.0.0.1:1")], "");
    expect(describeSmtpError(both)).toBe("connect ECONNREFUSED ::1:1; connect ECONNREFUSED 127.0.0.1:1");
    expect(describeImapError(both)).toContain("ECONNREFUSED 127.0.0.1:1");
  });
  it("falls back to the error code", () => {
    expect(describeSmtpError({ code: "ESOCKET", message: "" })).toBe("Could not reach the mail server (ESOCKET)");
  });
});
import { dripRoom } from "../drip";

describe("dripRoom: how many new prospects may start", () => {
  const base = { perDay: 25, dailyLimit: 100, startedLastDay: 0, sentLastDay: 0, sendsDueSoon: 0 };
  it("starts the daily quota on a quiet day", () => expect(dripRoom(base)).toBe(25));
  it("never more than the quota left for the last 24 hours", () => expect(dripRoom({ ...base, startedLastDay: 20 })).toBe(5));
  it("leaves room for follow-ups already due", () => expect(dripRoom({ ...base, sentLastDay: 60, sendsDueSoon: 30 })).toBe(10));
  it("starts nobody when follow-ups fill the day", () => expect(dripRoom({ ...base, sentLastDay: 40, sendsDueSoon: 70 })).toBe(0));
  it("is off at 0", () => expect(dripRoom({ ...base, perDay: 0 })).toBe(0));
});

const OURS = "bitsol-outreach-cm1abc234def@bitsolmarketing.com";

function mail(headers: string[], body = "Hello"): string {
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

describe("parseHeaders", () => {
  it("unfolds continuation lines and keeps repeated headers", () => {
    const headers = parseHeaders(mail(["Subject: a long", "  subject line", "Received: one", "Received: two"]));
    expect(headers.get("subject")).toEqual(["a long subject line"]);
    expect(headers.get("received")).toEqual(["one", "two"]);
  });

  it("stops at the first blank line", () => {
    const headers = parseHeaders(mail(["From: a@b.com"], "Subject: not a header"));
    expect(headers.has("subject")).toBe(false);
  });
});

describe("addressOf / decodeWords", () => {
  it("reads named and bare addresses", () => {
    expect(addressOf('"Sara Khan" <Sara.Khan@Example.com>')).toBe("sara.khan@example.com");
    expect(addressOf("ali@example.pk")).toBe("ali@example.pk");
    expect(addressOf("nobody")).toBe("");
  });

  it("decodes encoded-word subjects", () => {
    expect(decodeWords("=?UTF-8?B?UmU6IHF1aWNrIHF1ZXN0aW9u?=")).toBe("Re: quick question");
    expect(decodeWords("=?utf-8?Q?Re:_caf=C3=A9?= =?utf-8?Q?_plan?=")).toBe("Re: café plan");
  });
});

describe("classifyMail: replies", () => {
  it("is a reply when a person answers our email", () => {
    const result = classifyMail(
      mail([
        "From: Sara Khan <sara@acme.pk>",
        "To: hello@bitsolmarketing.com",
        "Subject: Re: Quick question about Acme",
        "Message-ID: <CAF123@mail.gmail.com>",
        `In-Reply-To: <${OURS}>`,
        `References: <${OURS}>`,
      ])
    );
    expect(result.kind).toBe("REPLY");
    expect(result.from).toBe("sara@acme.pk");
    expect(result.outreachIds).toEqual([OURS]);
    expect(result.messageId).toBe("caf123@mail.gmail.com");
  });

  it("is still a reply without threading headers (matched later by address)", () => {
    const result = classifyMail(mail(["From: sara@acme.pk", "Subject: interested"]));
    expect(result.kind).toBe("REPLY");
    expect(result.outreachIds).toEqual([]);
  });

  it("does not take an id quoted in the body as threading", () => {
    const result = classifyMail(mail(["From: sara@acme.pk", "Subject: fwd"], `> Message-ID: <${OURS}>`));
    expect(result.outreachIds).toEqual([]);
  });
});

describe("classifyMail: automatic replies", () => {
  it.each([
    ["Auto-Submitted header", ["Auto-Submitted: auto-replied", "Subject: Re: hello"]],
    ["X-Autoreply header", ["X-Autoreply: yes", "Subject: Re: hello"]],
    ["Outlook OOF", ["X-Auto-Response-Suppress: All", "Subject: Re: hello"]],
    ["out-of-office subject", ["Subject: Out of Office: back on Monday"]],
    ["automatic reply subject", ["Subject: Automatic reply: Quick question"]],
    ["mailing list", ["List-Id: <news.example.com>", "Subject: Weekly digest"]],
  ])("%s", (_name, headers) => {
    const result = classifyMail(mail(["From: sara@acme.pk", ...headers, `In-Reply-To: <${OURS}>`]));
    expect(result.kind).toBe("AUTO_REPLY");
  });

  it("Auto-Submitted: no is a person", () => {
    expect(classifyMail(mail(["From: sara@acme.pk", "Auto-Submitted: no", "Subject: Re: hi"])).kind).toBe("REPLY");
  });
});

describe("classifyMail: bounces", () => {
  const dsn = (action: string, status: string) =>
    mail(
      [
        "From: Mail Delivery System <MAILER-DAEMON@mx1.hostinger.com>",
        "To: hello@bitsolmarketing.com",
        "Subject: Undelivered Mail Returned to Sender",
        "Message-ID: <20261113.ABC@mx1.hostinger.com>",
        'Content-Type: multipart/report; report-type=delivery-status; boundary="b1"',
      ],
      [
        "--b1",
        "Content-Type: text/plain",
        "",
        "I'm sorry to have to inform you that your message could not be delivered.",
        "--b1",
        "Content-Type: message/delivery-status",
        "",
        "Reporting-MTA: dns; mx1.hostinger.com",
        "",
        "Final-Recipient: rfc822; nobody@acme.pk",
        "Original-Recipient: rfc822;nobody@acme.pk",
        `Action: ${action}`,
        `Status: ${status}`,
        "Diagnostic-Code: smtp; 550 5.1.1 <nobody@acme.pk>: Recipient address rejected:",
        "    User unknown in virtual mailbox table",
        "--b1",
        "Content-Type: text/rfc822-headers",
        "",
        "From: BITSOL Marketing <hello@bitsolmarketing.com>",
        `Message-ID: <${OURS}>`,
        "Subject: Quick question about Acme",
        "--b1--",
      ].join("\r\n")
    );

  it("reads a standard delivery-status report", () => {
    const result = classifyMail(dsn("failed", "5.1.1"));
    expect(result.kind).toBe("BOUNCE");
    expect(result.outreachIds).toEqual([OURS]);
    expect(result.bounce?.recipients).toEqual(["nobody@acme.pk"]);
    expect(result.bounce?.permanent).toBe(true);
    expect(result.bounce?.detail).toContain("Status 5.1.1");
    expect(result.bounce?.detail).toContain("User unknown in virtual mailbox table");
  });

  it("treats a delay as temporary", () => {
    const result = classifyMail(dsn("delayed", "4.4.1"));
    expect(result.kind).toBe("BOUNCE");
    expect(result.bounce?.permanent).toBe(false);
  });

  it("reads a qmail-style failure notice without a report", () => {
    const result = classifyMail(
      mail(
        ["From: MAILER-DAEMON@mail.example.net", "Subject: failure notice"],
        ["Hi. This is the qmail-send program.", "", "<gone@example.net>:", "Sorry, no mailbox here by that name.", "", `Message-ID: <${OURS}>`].join("\n")
      )
    );
    expect(result.kind).toBe("BOUNCE");
    expect(result.bounce?.recipients).toEqual(["gone@example.net"]);
    expect(result.bounce?.permanent).toBe(true);
    expect(result.outreachIds).toEqual([OURS]);
  });

  it("does not treat other mail from postmaster as a bounce", () => {
    const result = classifyMail(mail(["From: postmaster@example.com", "Subject: Your mailbox is almost full"]));
    expect(result.kind).toBe("AUTO_REPLY");
  });
});

describe("SMTP helpers", () => {
  it("builds a Message-ID on the sender's domain", () => {
    expect(buildMessageId("bitsol-outreach-cm1abc", "BITSOL Marketing <hello@BitsolMarketing.com>")).toBe("<bitsol-outreach-cm1abc@bitsolmarketing.com>");
    expect(bareMessageId("<bitsol-outreach-cm1abc@bitsolmarketing.com>")).toBe("bitsol-outreach-cm1abc@bitsolmarketing.com");
  });

  it("round-trips: a bounce quoting our Message-ID finds it", () => {
    const id = bareMessageId(buildMessageId("bitsol-outreach-cm1abc234def", "hello@bitsolmarketing.com"));
    const result = classifyMail(mail(["From: sara@acme.pk", `In-Reply-To: <${id}>`]));
    expect(result.outreachIds).toEqual([id]);
  });

  it.each([
    [{ code: "EAUTH", responseCode: 535, command: "AUTH PLAIN" }, "SETUP"],
    [{ code: "ECONNECTION" }, "SETUP"],
    [{ code: "ETIMEDOUT" }, "SETUP"],
    [{ code: "EENVELOPE", responseCode: 550, command: "RCPT TO" }, "RECIPIENT"],
    [{ code: "EENVELOPE", responseCode: 553, command: "MAIL FROM" }, "SETUP"],
    [{ code: "EMESSAGE", responseCode: 554, command: "DATA" }, "SETUP"],
    [{ code: "EENVELOPE", responseCode: 451, command: "RCPT TO" }, "TEMPORARY"],
    [{ responseCode: 421 }, "TEMPORARY"],
    [{ code: "EENVELOPE", command: "API", message: 'Invalid recipient "x@"' }, "RECIPIENT"],
    [{ code: "EENVELOPE", command: "API", message: 'Invalid sender "x@"' }, "SETUP"],
    [new Error("something odd"), "TEMPORARY"],
  ])("classifies %o as %s", (err, expected) => {
    expect(classifySmtpError(err)).toBe(expected);
  });
});
