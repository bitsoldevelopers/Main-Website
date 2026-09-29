import { describe, expect, it } from "vitest";
import { getBestOutreachEmail, type OutreachCandidate, type SuppressionReason } from "../outreach-email";

function email(type: string, address: string, extra: Partial<OutreachCandidate> = {}): OutreachCandidate {
  return { type, email: address, emailKey: address.toLowerCase(), validity: "VALID", bouncedAt: null, ...extra };
}

const all = [
  email("PERSONAL", "johnsmith@gmail.com"),
  email("PRIMARY", "john@company.com"),
  email("SECONDARY", "john.smith@company.com"),
];

describe("getBestOutreachEmail", () => {
  it("prefers Email 1, whatever order the addresses are stored in", () => {
    const result = getBestOutreachEmail({ emails: all });
    expect(result.selected_email).toBe("john@company.com");
    expect(result.selection_reason).toBe("PRIMARY_EMAIL");
    expect(result.skipped).toEqual([]);
  });

  it("falls back to Email 2 when Email 1 is invalid", () => {
    const result = getBestOutreachEmail({
      emails: [email("PRIMARY", "john@company", { validity: "INVALID" }), all[2], all[0]],
    });
    expect(result.selected_email).toBe("john.smith@company.com");
    expect(result.selection_reason).toBe("SECONDARY_EMAIL");
    expect(result.skipped).toEqual([{ email: "john@company", type: "PRIMARY", reason: "INVALID" }]);
  });

  it("falls back to the personal email when there is no work address", () => {
    const result = getBestOutreachEmail({ emails: [all[0]] });
    expect(result.selected_email).toBe("johnsmith@gmail.com");
    expect(result.selection_reason).toBe("PERSONAL_EMAIL");
  });

  it("skips bounced, unsubscribed and suppressed addresses", () => {
    const reasons: Record<string, SuppressionReason> = {
      "john.smith@company.com": "UNSUBSCRIBED",
      "johnsmith@gmail.com": "MANUAL",
    };
    const result = getBestOutreachEmail(
      { emails: [email("PRIMARY", "john@company.com", { bouncedAt: new Date() }), all[2], all[0]] },
      { suppression: (key) => reasons[key] ?? null }
    );
    expect(result.selected_email).toBeNull();
    expect(result.selection_reason).toBe("NO_ELIGIBLE_EMAIL");
    expect(result.skipped.map((s) => s.reason)).toEqual(["BOUNCED", "UNSUBSCRIBED", "SUPPRESSED"]);
  });

  it("uses a risky address only when nothing better exists", () => {
    const risky = email("PRIMARY", "info@company.com", { validity: "RISKY" });
    const better = getBestOutreachEmail({ emails: [risky, all[2]] });
    expect(better.selected_email).toBe("john.smith@company.com");
    expect(better.risky).toBe(false);

    const only = getBestOutreachEmail({ emails: [risky] });
    expect(only.selected_email).toBe("info@company.com");
    expect(only.selection_reason).toBe("PRIMARY_EMAIL");
    expect(only.risky).toBe(true);
  });

  it("honours a manual choice while it stays eligible", () => {
    const emails = [all[1], email("PERSONAL", "johnsmith@gmail.com", { isOutreach: true })];
    const manual = getBestOutreachEmail({ emails }, { locked: true });
    expect(manual.selected_email).toBe("johnsmith@gmail.com");
    expect(manual.selection_reason).toBe("MANUAL_SELECTION");

    const bounced = getBestOutreachEmail(
      { emails: [all[1], email("PERSONAL", "johnsmith@gmail.com", { isOutreach: true, bouncedAt: new Date() })] },
      { locked: true }
    );
    expect(bounced.selected_email).toBe("john@company.com");
    expect(bounced.selection_reason).toBe("PRIMARY_EMAIL");
  });

  it("never returns more than one address, and says so when there are none", () => {
    expect(typeof getBestOutreachEmail({ emails: all }).selected_email).toBe("string");
    expect(getBestOutreachEmail({ emails: [] })).toMatchObject({ selected_email: null, selection_reason: "NO_EMAIL" });
  });
});
