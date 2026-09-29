import { describe, expect, it } from "vitest";
import {
  clean,
  companyKey,
  identityKey,
  normalizeEmail,
  normalizeLinkedin,
  normalizePhone,
  normalizeWebsite,
  personKey,
} from "../normalize";

describe("normalizeEmail", () => {
  it("lower-cases and trims", () => {
    expect(normalizeEmail("  John.Smith@Company.COM ")).toBe("john.smith@company.com");
  });

  it("unwraps mailto links, angle brackets and markdown links", () => {
    expect(normalizeEmail("mailto:john@company.com")).toBe("john@company.com");
    expect(normalizeEmail("John Smith <John@Company.com>")).toBe("john@company.com");
    expect(normalizeEmail("[john@company.com](mailto:john@company.com)")).toBe("john@company.com");
  });

  it("returns an empty key for empty input", () => {
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("normalizePhone", () => {
  it("treats differently formatted copies of a number as the same", () => {
    const a = normalizePhone("+1 (415) 555-1234");
    expect(a).toBe("4155551234");
    expect(normalizePhone("415-555-1234")).toBe(a);
    expect(normalizePhone("001 415 555 1234")).toBe(a);
    expect(normalizePhone("415.555.1234 ext. 22")).toBe(a);
  });

  it("keeps short national numbers whole", () => {
    expect(normalizePhone("555-1234")).toBe("5551234");
  });

  it("rejects values that are not phone numbers", () => {
    expect(normalizePhone("n/a")).toBe("");
    expect(normalizePhone("12345")).toBe("");
    expect(normalizePhone("")).toBe("");
  });
});

describe("normalizeLinkedin", () => {
  it("ignores protocol, www, country subdomains, query strings and case", () => {
    const key = "linkedin.com/in/john-smith";
    expect(normalizeLinkedin("https://www.linkedin.com/in/John-Smith/?utm_source=x")).toBe(key);
    expect(normalizeLinkedin("pk.linkedin.com/in/john-smith")).toBe(key);
    expect(normalizeLinkedin("http://linkedin.com/in/john-smith#about")).toBe(key);
  });

  it("rejects other sites and bare domains", () => {
    expect(normalizeLinkedin("https://example.com/in/john")).toBe("");
    expect(normalizeLinkedin("https://notlinkedin.com/in/john")).toBe("");
    expect(normalizeLinkedin("linkedin.com")).toBe("");
    expect(normalizeLinkedin("")).toBe("");
  });
});

describe("normalizeWebsite", () => {
  it("adds a protocol and strips www for the domain", () => {
    expect(normalizeWebsite("www.ABCtech.com")).toEqual({ url: "https://www.abctech.com/", domain: "abctech.com", key: "abctech.com" });
  });

  it("treats http, https and a trailing slash as the same site", () => {
    expect(normalizeWebsite("http://abctech.com/")?.key).toBe(normalizeWebsite("https://www.abctech.com")?.key);
  });

  it("rejects values that are not URLs", () => {
    expect(normalizeWebsite("not a website")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("javascript:alert(1)")).toBeNull();
    expect(normalizeWebsite("")).toBeNull();
  });
});

describe("company and identity keys", () => {
  it("ignores legal suffixes, punctuation and case", () => {
    expect(companyKey("ABC Technologies (Pvt.) Ltd.")).toBe("abc technologies");
    expect(companyKey("abc technologies")).toBe("abc technologies");
    expect(companyKey("ABC Technologies, Inc.")).toBe("abc technologies");
  });

  it("never reduces a company to nothing", () => {
    expect(companyKey("Company")).toBe("company");
  });

  it("needs first name, last name and company for an identity", () => {
    expect(identityKey("John", "Smith", "ABC Technologies Ltd")).toBe("john|smith|abc technologies");
    expect(identityKey(" JOHN ", "smith", "abc technologies")).toBe("john|smith|abc technologies");
    expect(identityKey("John", "", "ABC")).toBe("");
    expect(identityKey("John", "Smith", "")).toBe("");
  });

  it("ignores accents when comparing names", () => {
    expect(personKey("José", "Núñez")).toBe(personKey("Jose", "Nunez"));
  });
});

describe("clean", () => {
  it("collapses whitespace and non-breaking spaces", () => {
    expect(clean("  ABC  Technologies \n")).toBe("ABC Technologies");
    expect(clean(42)).toBe("42");
    expect(clean(null)).toBe("");
  });
});
