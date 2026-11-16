import { describe, expect, it } from "vitest";
import { normalisePhone, parseNumberList } from "../numbers";

describe("normalisePhone", () => {
  it("turns every way a Pakistani mobile is written into Meta's wa_id", () => {
    for (const written of ["03001234567", "0300-1234567", "+92 300 1234567", "92 300 1234567", "923001234567", "0092 300 1234567", "3001234567"]) {
      expect(normalisePhone(written)).toEqual({ waId: "923001234567", phone: "+923001234567" });
    }
  });

  it("never rewrites a number that already carries another country code", () => {
    expect(normalisePhone("+44 7700 900123")).toEqual({ waId: "447700900123", phone: "+447700900123" });
    expect(normalisePhone("+1 (415) 555-0132")).toEqual({ waId: "14155550132", phone: "+14155550132" });
  });

  it("uses the country code it is given for local numbers", () => {
    expect(normalisePhone("0501234567", "971")).toEqual({ waId: "971501234567", phone: "+971501234567" });
  });

  it("rejects what is not a phone number, with a reason", () => {
    expect(normalisePhone("")).toEqual({ error: "Empty" });
    expect(normalisePhone("Ali Raza")).toEqual({ error: "Not a phone number" });
    expect(normalisePhone("---")).toEqual({ error: "No digits" });
    expect(normalisePhone("12345")).toEqual({ error: "Too short" });
    expect(normalisePhone("+92 300 1234567 8901 234")).toEqual({ error: "Too long" });
  });
});

describe("parseNumberList", () => {
  it("reads a pasted column, skipping blanks and a heading row", () => {
    const outcome = parseNumberList("Phone\n03001234567\n\n+92 321 9876543\n");
    expect(outcome.valid.map((entry) => entry.waId)).toEqual(["923001234567", "923219876543"]);
    expect(outcome.invalid).toEqual([]);
    expect(outcome.duplicates).toBe(0);
  });

  it("reads a CSV with the number first and a name second, quoted or not", () => {
    const outcome = parseNumberList('﻿"Mobile","Name"\n03001234567,Ali Raza\n"0321-9876543","Khan, Sadia"\n03339998877;Bilal\t');
    expect(outcome.valid).toEqual([
      { waId: "923001234567", phone: "+923001234567", name: "Ali Raza", raw: "03001234567,Ali Raza" },
      { waId: "923219876543", phone: "+923219876543", name: "Khan, Sadia", raw: '"0321-9876543","Khan, Sadia"' },
      { waId: "923339998877", phone: "+923339998877", name: "Bilal", raw: "03339998877;Bilal" },
    ]);
  });

  it("counts the same number written twice once, and quotes back lines it could not read", () => {
    const outcome = parseNumberList("03001234567\n+92 300 1234567\nnot a number\n123");
    expect(outcome.valid).toHaveLength(1);
    expect(outcome.duplicates).toBe(1);
    expect(outcome.invalid).toEqual([
      { raw: "not a number", reason: "Not a phone number" },
      { raw: "123", reason: "Too short" },
    ]);
  });

  it("does not take a second phone column for a name", () => {
    const outcome = parseNumberList("03001234567,03009999999");
    expect(outcome.valid[0].name).toBeUndefined();
  });
});
