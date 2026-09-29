import { SHEET_COLUMNS, detectMapping, sanitizeMapping, type CrmField, type FieldMapping } from "./columns";
import { buildQualityReport, duplicateEmailRows, parseRow, rowIssues, type QualityIssue, type QualityReport } from "./import-parse";
import type { SourceTable } from "./sources/types";

/**
 * What the wizard shows before anything is written: the first rows exactly
 * as the source has them, the detected mapping with its warnings, and a
 * data-quality report over every row. Read-only and free of DNS lookups, so
 * it is fast; the import itself also checks each email domain.
 */

export const PREVIEW_ROWS = 50;

export interface PreviewRow {
  rowNumber: number;
  cells: string[];
  emails: { header: string; email: string; validity: string; reason: string }[];
  issues: QualityIssue[];
  invalidReason: string | null;
}

export interface ImportPreview {
  headers: string[];
  totalRows: number;
  /** Rows that cannot become a lead at all. */
  invalidRows: number;
  rows: PreviewRow[];
  mapping: FieldMapping;
  /** Canonical column titles the source does not have. */
  missing: string[];
  /** Source columns nothing maps to; they are still stored with each row. */
  unmapped: string[];
  guessed: CrmField[];
  quality: QualityReport;
}

export const PREVIEW_ISSUES = [
  "invalid_email",
  "risky_email",
  "missing_email",
  "duplicate_email",
  "missing_name",
  "missing_company",
  "missing_website",
  "missing_linkedin",
  "missing_phone",
  "invalid_row",
] as const;
export type PreviewIssue = (typeof PREVIEW_ISSUES)[number];

export function isPreviewIssue(value: unknown): value is PreviewIssue {
  return typeof value === "string" && (PREVIEW_ISSUES as readonly string[]).includes(value);
}

/**
 * `issue` narrows the preview rows to the ones with that problem (the first
 * fifty of them), which is how "view invalid", "view duplicates" and "view
 * missing data" work before anything is imported.
 */
export function buildPreview(table: SourceTable, chosenMapping?: unknown, issue?: PreviewIssue | null): ImportPreview {
  const detected = detectMapping(table.headers);
  const chosen = chosenMapping ? sanitizeMapping(chosenMapping, table.headers) : {};
  const mapping = Object.keys(chosen).length > 0 ? chosen : detected.mapping;

  const parsed = table.rows.map((cells, i) => parseRow(table.headers, cells, mapping, table.firstRowNumber + i));
  const duplicates = duplicateEmailRows(parsed);
  const emailHeader = { PRIMARY: mapping.email_primary, SECONDARY: mapping.email_secondary, PERSONAL: mapping.email_personal };

  const rows: PreviewRow[] = parsed
    .filter((row) => !row.blank)
    .filter((row) => {
      if (!issue) return true;
      if (issue === "invalid_row") return row.invalidReason !== null;
      return rowIssues(row, duplicates.has(row.rowNumber)).includes(issue);
    })
    .slice(0, PREVIEW_ROWS)
    .map((row) => ({
      rowNumber: row.rowNumber,
      cells: table.headers.map((header) => row.raw[header] ?? ""),
      emails: row.emails.map((email) => ({
        header: emailHeader[email.type] ?? email.type,
        email: email.email,
        validity: email.validity,
        reason: email.reason,
      })),
      issues: rowIssues(row, duplicates.has(row.rowNumber)),
      invalidReason: row.invalidReason,
    }));

  const used = new Set(Object.values(mapping));
  const quality = buildQualityReport(parsed);
  return {
    headers: table.headers,
    totalRows: quality.totalRows,
    invalidRows: parsed.filter((row) => !row.blank && row.invalidReason !== null).length,
    rows,
    mapping,
    missing: SHEET_COLUMNS.filter((column) => !mapping[column.field]).map((column) => column.header),
    unmapped: table.headers.filter((header) => header.trim() && !used.has(header)),
    guessed: Object.keys(chosen).length > 0 ? [] : detected.guessed,
    quality,
  };
}
