import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { templatePayload } from "../client";
import { countPlaceholders, flattenComponents, humanTemplateName, mergeVariableNames, readVariables, renderTemplate, toTemplateStatus } from "../templates";

describe("template text", () => {
  it("counts placeholders by their highest index, whatever order they appear in", () => {
    expect(countPlaceholders("Hello")).toBe(0);
    expect(countPlaceholders("Hi {{1}}, {{2}} is ready")).toBe(2);
    expect(countPlaceholders("{{ 2 }} پہلے {{1}}")).toBe(2);
  });

  it("renders a body, leaving a placeholder alone when its value is blank", () => {
    expect(renderTemplate("Hi {{1}}, {{2}}!", ["Ali", ""])).toBe("Hi Ali, {{2}}!");
  });

  it("flattens Meta's components into the fields the panel shows", () => {
    expect(
      flattenComponents([
        { type: "HEADER", format: "IMAGE", example: { header_handle: ["h"] } },
        { type: "BODY", text: "Hi {{1}}, see {{2}}." },
        { type: "FOOTER", text: "Reply STOP to opt out" },
        { type: "BUTTONS", buttons: [{ type: "URL", text: "Open", url: "https://bitsolmarketing.com" }] },
      ])
    ).toEqual({
      body: "Hi {{1}}, see {{2}}.",
      headerText: null,
      headerFormat: "IMAGE",
      footerText: "Reply STOP to opt out",
      buttons: [{ type: "URL", text: "Open", url: "https://bitsolmarketing.com" }],
      variableCount: 2,
    });
    expect(flattenComponents(undefined)).toMatchObject({ body: "", headerFormat: null, variableCount: 0 });
    expect(flattenComponents([{ type: "header", text: "Welcome" }, { type: "body", text: "x" }])).toMatchObject({ headerText: "Welcome", headerFormat: "TEXT" });
  });

  it("maps Meta's review states onto the local ones", () => {
    expect(toTemplateStatus("APPROVED")).toBe("APPROVED");
    expect(toTemplateStatus("in_appeal")).toBe("PENDING");
    expect(toTemplateStatus("REJECTED")).toBe("REJECTED");
    expect(toTemplateStatus("DELETED")).toBe("DISABLED");
    expect(toTemplateStatus("PAUSED")).toBe("PAUSED");
    expect(toTemplateStatus(undefined)).toBe("PAUSED");
  });

  it("keeps hand-written variable labels and fills the rest positionally", () => {
    expect(mergeVariableNames(["name", " "], 3)).toEqual(["name", "Variable 2", "Variable 3"]);
    expect(mergeVariableNames(["name", "service"], 1)).toEqual(["name"]);
    expect(readVariables(["a", 1, "b"])).toEqual(["a", "b"]);
    expect(readVariables(null)).toEqual([]);
  });

  it("makes a readable default name from Meta's", () => {
    expect(humanTemplateName("consultation_reminder")).toBe("Consultation reminder");
  });
});

describe("the template message payload", () => {
  it("sends body values by position only", () => {
    expect(templatePayload("offer", "en", ["Ali", "20%"])).toEqual({
      name: "offer",
      language: { code: "en" },
      components: [{ type: "body", parameters: [{ type: "text", text: "Ali" }, { type: "text", text: "20%" }] }],
    });
    expect(templatePayload("hello", "en_US", [])).toEqual({ name: "hello", language: { code: "en_US" } });
  });

  it("carries a media header as a link, or as an id when it is all digits", () => {
    expect(templatePayload("promo", "en", [], { media: { format: "IMAGE", link: "https://example.com/a.png" } }).components).toEqual([
      { type: "header", parameters: [{ type: "image", image: { link: "https://example.com/a.png" } }] },
    ]);
    expect(templatePayload("promo", "en", [], { media: { format: "DOCUMENT", link: "123456", filename: "offer.pdf" } }).components).toEqual([
      { type: "header", parameters: [{ type: "document", document: { id: "123456", filename: "offer.pdf" } }] },
    ]);
  });

  it("puts text header values before the body", () => {
    expect(templatePayload("t", "en", ["x"], { text: ["Welcome"] }).components).toEqual([
      { type: "header", parameters: [{ type: "text", text: "Welcome" }] },
      { type: "body", parameters: [{ type: "text", text: "x" }] },
    ]);
  });
});
