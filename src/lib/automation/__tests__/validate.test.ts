import { describe, expect, it } from "vitest";
import { lookupDomains } from "../domain-check";
import { checkEmail, checkEmailSyntax, isSharedMailbox, type DomainStatus } from "../validate";

describe("checkEmailSyntax", () => {
  it("accepts ordinary addresses", () => {
    expect(checkEmailSyntax("john@company.com")).toEqual({ validity: "VALID", reason: "OK" });
    expect(checkEmailSyntax("John.Smith+crm@Mail.Company.co.uk").validity).toBe("VALID");
  });

  it("rejects malformed addresses", () => {
    for (const bad of ["john", "john@", "@company.com", "john@company", "john smith@company.com", "john@@company.com", "john..smith@company.com", "john@-company.com"]) {
      expect(checkEmailSyntax(bad), bad).toEqual({ validity: "INVALID", reason: "BAD_FORMAT" });
    }
  });

  it("reports an empty value as empty, not as malformed", () => {
    expect(checkEmailSyntax("").reason).toBe("EMPTY");
    expect(checkEmailSyntax("   ").reason).toBe("EMPTY");
  });

  it("rejects placeholder and mistyped domains", () => {
    expect(checkEmailSyntax("john@example.com").reason).toBe("RESERVED_DOMAIN");
    expect(checkEmailSyntax("john@gmial.com").reason).toBe("TYPO_DOMAIN");
  });

  it("rejects mailboxes nobody reads", () => {
    expect(checkEmailSyntax("noreply@company.com")).toEqual({ validity: "INVALID", reason: "NO_REPLY_ADDRESS" });
  });

  it("marks shared and disposable mailboxes as risky, not invalid", () => {
    expect(checkEmailSyntax("info@company.com")).toEqual({ validity: "RISKY", reason: "ROLE_ADDRESS" });
    expect(checkEmailSyntax("john@mailinator.com")).toEqual({ validity: "RISKY", reason: "DISPOSABLE_DOMAIN" });
  });
});

describe("checkEmail with domain knowledge", () => {
  const domains = new Map<string, DomainStatus>([
    ["dead-domain.com", "NO_MAIL_SERVER"],
    ["company.com", "ACCEPTS_MAIL"],
    ["slow-dns.com", "UNKNOWN"],
  ]);

  it("rejects an address on a domain without a mail server", () => {
    expect(checkEmail("john@dead-domain.com", domains)).toEqual({ validity: "INVALID", reason: "NO_MAIL_SERVER" });
  });

  it("does not punish an address when the lookup was inconclusive", () => {
    expect(checkEmail("john@slow-dns.com", domains).validity).toBe("VALID");
    expect(checkEmail("john@never-looked-up.com", domains).validity).toBe("VALID");
  });

  it("keeps the risky verdict on a live domain", () => {
    expect(checkEmail("sales@company.com", domains)).toEqual({ validity: "RISKY", reason: "ROLE_ADDRESS" });
  });
});

describe("isSharedMailbox", () => {
  it("recognises role addresses regardless of case", () => {
    expect(isSharedMailbox("Info@Company.com")).toBe(true);
    expect(isSharedMailbox("john@company.com")).toBe(false);
  });
});

describe("lookupDomains", () => {
  it("looks each domain up once and survives a failing lookup", async () => {
    const calls: string[] = [];
    const result = await lookupDomains(["a.com", "b.com", "a.com", "boom.com", ""], {
      concurrency: 2,
      lookup: async (domain) => {
        calls.push(domain);
        if (domain === "boom.com") throw new Error("resolver exploded");
        return domain === "a.com" ? "ACCEPTS_MAIL" : "NO_MAIL_SERVER";
      },
    });
    expect(calls.sort()).toEqual(["a.com", "b.com", "boom.com"]);
    expect(result.get("a.com")).toBe("ACCEPTS_MAIL");
    expect(result.get("b.com")).toBe("NO_MAIL_SERVER");
    expect(result.get("boom.com")).toBe("UNKNOWN");
  });
});
