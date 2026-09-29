import { describe, expect, it } from "vitest";
import { SHEET_COLUMNS, detectMapping, missingColumnWarnings, sanitizeMapping } from "../columns";
import { DuplicateIndex, buildQualityReport, dedupeKeys, parseRow } from "../import-parse";
import { parseCsv, parseCsvRows, toCsv } from "../sources/csv";

const HEADERS = SHEET_COLUMNS.map((column) => column.header);
const { mapping } = detectMapping(HEADERS);

function row(values: Partial<Record<string, string>>, rowNumber = 2) {
  return parseRow(
    HEADERS,
    HEADERS.map((header) => values[header] ?? ""),
    mapping,
    rowNumber
  );
}

const JOHN = {
  "First Name": "John",
  "Last Name": "Smith",
  Title: "CEO",
  "Company Name": "ABC Technologies",
  Website: "abctechnologies.com",
  "Contact LI Profile URL": "https://www.linkedin.com/in/john-smith/",
  "Email 1": "John@ABCTechnologies.com",
  "Email 2": "john.smith@abctechnologies.com",
  "Personal Email": "johnsmith@gmail.com",
  "Contact Phone 1": "+1 (415) 555-1234",
  "Company Phone 1": "+1 415 555 0000",
  "Contact Location": "San Francisco, CA",
  "Company Description": "ABC Technologies provides enterprise software solutions.",
};

describe("column mapping", () => {
  it("maps all fifteen canonical columns exactly", () => {
    const result = detectMapping(HEADERS);
    expect(Object.keys(result.mapping)).toHaveLength(15);
    expect(result.missing).toEqual([]);
    expect(result.guessed).toEqual([]);
    expect(result.mapping.linkedin_url).toBe("Contact LI Profile URL");
    expect(result.mapping.email_primary).toBe("Email 1");
    expect(result.mapping.company_phone).toBe("Company Phone 1");
  });

  it("finds columns whatever their case, spacing or order", () => {
    const result = detectMapping(["  email 1", "LAST NAME", "first_name", "Company-Name"]);
    expect(result.mapping).toMatchObject({
      email_primary: "  email 1",
      last_name: "LAST NAME",
      first_name: "first_name",
      company_name: "Company-Name",
    });
  });

  it("warns about every column the sheet does not have", () => {
    const result = detectMapping(HEADERS.filter((header) => header !== "Email 1" && header !== "Website"));
    expect(result.missing.map((column) => column.header)).toEqual(["Website", "Email 1"]);
    expect(missingColumnWarnings(result.mapping)).toContain("Email 1 column not found.");
  });

  it("falls back to aliases and keeps extra columns out of the mapping", () => {
    const result = detectMapping(["First Name", "Email", "Phone", "Favourite colour"]);
    expect(result.mapping.email_primary).toBe("Email");
    expect(result.mapping.phone_primary).toBe("Phone");
    expect(result.guessed).toEqual(["email_primary", "phone_primary"]);
    expect(result.unmapped).toEqual(["Favourite colour"]);
  });

  it("drops mapping entries that point at unknown fields or headers", () => {
    expect(sanitizeMapping({ first_name: "First Name", hacker: "First Name", last_name: "Nope" }, HEADERS)).toEqual({
      first_name: "First Name",
    });
  });
});

describe("parseRow", () => {
  it("keeps the source values and adds comparison keys", () => {
    const parsed = row(JOHN);
    expect(parsed.values.email_primary).toBe("John@ABCTechnologies.com");
    expect(parsed.raw["Company Description"]).toBe(JOHN["Company Description"]);
    expect(parsed.emails.map((e) => [e.type, e.emailKey])).toEqual([
      ["PRIMARY", "john@abctechnologies.com"],
      ["SECONDARY", "john.smith@abctechnologies.com"],
      ["PERSONAL", "johnsmith@gmail.com"],
    ]);
    expect(parsed.phones.map((p) => [p.type, p.phoneKey])).toEqual([
      ["PRIMARY", "4155551234"],
      ["COMPANY", "4155550000"],
    ]);
    expect(parsed.linkedinKey).toBe("linkedin.com/in/john-smith");
    expect(parsed.website?.domain).toBe("abctechnologies.com");
    expect(parsed.identityKey).toBe("john|smith|abc technologies");
    expect(parsed.invalidReason).toBeNull();
  });

  it("does not truncate a long company description", () => {
    const description = "Enterprise software. ".repeat(400);
    expect(row({ ...JOHN, "Company Description": description }).values.company_description).toBe(description.trim());
  });

  it("gives formatting variants of one contact the same source key", () => {
    const a = row(JOHN);
    const b = row({ ...JOHN, "Email 1": "  JOHN@abctechnologies.COM  ", "First Name": "john" });
    expect(b.sourceKey).toBe(a.sourceKey);
    expect(b.sourceHash).not.toBe(a.sourceHash);
  });

  it("flags rows with nothing to identify the contact by", () => {
    expect(row({ "First Name": "John", Title: "CEO" }).invalidReason).toMatch(/nothing to identify/);
    expect(row({}).blank).toBe(true);
  });

  it("accepts a row that only has a name and company, or only a phone", () => {
    expect(row({ "First Name": "John", "Last Name": "Smith", "Company Name": "ABC" }).invalidReason).toBeNull();
    expect(row({ "Contact Phone 1": "0300 1234567" }).invalidReason).toBeNull();
  });

  it("warns about unusable websites and LinkedIn URLs without rejecting the row", () => {
    const parsed = row({ ...JOHN, Website: "coming soon", "Contact LI Profile URL": "facebook.com/john" });
    expect(parsed.invalidReason).toBeNull();
    expect(parsed.website).toBeNull();
    expect(parsed.linkedinKey).toBe("");
    expect(parsed.warnings).toHaveLength(2);
  });
});

describe("duplicate hierarchy", () => {
  it("orders keys from primary email down to name and company", () => {
    expect(dedupeKeys(row(JOHN)).map((k) => k.level)).toEqual([
      "PRIMARY_EMAIL",
      "SECONDARY_EMAIL",
      "PERSONAL_EMAIL",
      "PRIMARY_PHONE",
      "LINKEDIN",
      "NAME_COMPANY",
    ]);
  });

  it("matches on capitalisation and formatting differences", () => {
    const index = new DuplicateIndex<string>();
    const first = row(JOHN);
    index.add(dedupeKeys(first), "lead-1", first.personKey);

    const sameEmail = row({ "Email 1": "JOHN@ABCTECHNOLOGIES.COM" });
    expect(index.find(dedupeKeys(sameEmail), sameEmail.personKey)).toEqual({ level: "PRIMARY_EMAIL", value: "lead-1" });

    const samePhone = row({ "Contact Phone 1": "415.555.1234", "First Name": "John", "Last Name": "Smith" });
    expect(index.find(dedupeKeys(samePhone), samePhone.personKey)?.level).toBe("PRIMARY_PHONE");

    const sameLinkedin = row({ "Contact LI Profile URL": "linkedin.com/in/John-Smith" });
    expect(index.find(dedupeKeys(sameLinkedin), sameLinkedin.personKey)?.level).toBe("LINKEDIN");

    const sameName = row({ "First Name": "JOHN", "Last Name": "smith", "Company Name": "ABC Technologies Ltd." });
    expect(index.find(dedupeKeys(sameName), sameName.personKey)?.level).toBe("NAME_COMPANY");
  });

  it("matches a row's second email against another row's first", () => {
    const index = new DuplicateIndex<string>();
    const first = row(JOHN);
    index.add(dedupeKeys(first), "lead-1", first.personKey);
    const other = row({ "Email 1": "new@other.com", "Email 2": "john@abctechnologies.com" });
    expect(index.find(dedupeKeys(other), other.personKey)).toEqual({ level: "SECONDARY_EMAIL", value: "lead-1" });
  });

  it("does not merge two people who share a switchboard number", () => {
    const index = new DuplicateIndex<string>();
    const first = row(JOHN);
    index.add(dedupeKeys(first), "lead-1", first.personKey);
    const colleague = row({ "First Name": "Sarah", "Last Name": "Khan", "Contact Phone 1": "+1 415 555 1234" });
    expect(index.find(dedupeKeys(colleague), colleague.personKey)).toBeNull();
  });

  it("does not merge two people through a shared info@ mailbox or the company phone", () => {
    const a = row({ "First Name": "John", "Last Name": "Smith", "Email 1": "info@abc.com", "Company Phone 1": "+1 415 555 0000" });
    const b = row({ "First Name": "Sarah", "Last Name": "Khan", "Email 1": "info@abc.com", "Company Phone 1": "+1 415 555 0000" });
    const index = new DuplicateIndex<string>();
    index.add(dedupeKeys(a), "lead-1", a.personKey);
    expect(dedupeKeys(a)).toEqual([]);
    expect(index.find(dedupeKeys(b), b.personKey)).toBeNull();
  });
});

describe("quality report", () => {
  it("counts every row once for email quality", () => {
    const rows = [
      row(JOHN, 2),
      row({ "First Name": "Sarah", "Last Name": "Khan", "Company Name": "ABC Technologies", "Email 1": "info@abc-tech.com" }, 3),
      row({ "First Name": "Ali", "Last Name": "Ahmed", "Company Name": "ABC Technologies", "Email 1": "ali@abc" }, 4),
      row({ "First Name": "No", "Last Name": "Email", "Company Name": "ABC Technologies" }, 5),
      row({ "Email 1": "john@abctechnologies.com" }, 6),
      row({}, 7),
    ];
    const report = buildQualityReport(rows);
    expect(report).toMatchObject({
      totalRows: 5,
      blankRows: 1,
      validEmails: 2,
      riskyEmails: 1,
      invalidEmails: 1,
      missingEmails: 1,
      duplicateEmails: 1,
      missingNames: 1,
      missingCompanies: 1,
      missingWebsites: 4,
      missingLinkedin: 4,
      missingPhones: 4,
    });
    expect(report.validEmails + report.riskyEmails + report.invalidEmails + report.missingEmails).toBe(report.totalRows);
  });
});

describe("CSV", () => {
  it("reads quoted fields, embedded commas, quotes and line breaks", () => {
    const csv = '﻿First Name,Company Description\r\nJohn,"Software, ""enterprise"" grade\nand more"\r\n';
    expect(parseCsvRows(csv)).toEqual([
      ["First Name", "Company Description"],
      ["John", 'Software, "enterprise" grade\nand more'],
    ]);
  });

  it("detects semicolon and tab separators", () => {
    expect(parseCsvRows("a;b\n1;2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsvRows("a\tb\n1\t2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("pads short rows and numbers rows as the spreadsheet does", () => {
    const table = parseCsv("First Name,Last Name,Email 1\nJohn\nSarah,Khan,sarah@abc.com\n");
    expect(table.headers).toEqual(["First Name", "Last Name", "Email 1"]);
    expect(table.rows).toEqual([
      ["John", "", ""],
      ["Sarah", "Khan", "sarah@abc.com"],
    ]);
    expect(table.firstRowNumber).toBe(2);
  });

  it("round-trips values and neutralises spreadsheet formulas on export", () => {
    const csv = toCsv(["Name", "Note"], [["John, Jr.", '=HYPERLINK("http://evil")']]);
    expect(parseCsvRows(csv)).toEqual([
      ["Name", "Note"],
      ["John, Jr.", "'=HYPERLINK(\"http://evil\")"],
    ]);
    expect(parseCsvRows(toCsv(["a"], [["+cmd|' /C calc'!A0"], ["@SUM(1+1)"], ["-2+3+cmd"]])).slice(1)).toEqual([
      ["'+cmd|' /C calc'!A0"],
      ["'@SUM(1+1)"],
      ["'-2+3+cmd"],
    ]);
  });

  it("exports phone numbers exactly as stored", () => {
    const phones = ["+1 (415) 555-1234", "+92 300 1234567", "-42", "0300-1234567"];
    expect(parseCsvRows(toCsv(["Phone"], phones.map((phone) => [phone]))).slice(1)).toEqual(phones.map((phone) => [phone]));
  });
});
