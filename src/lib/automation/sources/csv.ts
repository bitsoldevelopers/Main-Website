import type { SourceTable } from "./types";

/**
 * CSV reader (RFC 4180): quoted fields, doubled quotes, line breaks inside
 * quotes, a UTF-8 byte order mark, and comma, semicolon or tab separators.
 * Cell values are returned exactly as written; trimming and normalising is
 * the importer's job, not the reader's.
 */

export const CSV_MAX_BYTES = 8 * 1024 * 1024;
export const CSV_MAX_ROWS = 20_000;

function detectDelimiter(text: string): string {
  // Judge by the header line, outside quotes.
  let inQuotes = false;
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  for (const char of text) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (char === "\n" || char === "\r")) break;
    else if (!inQuotes && char in counts) counts[char]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCsvRows(input: string, delimiter?: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const separator = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field === "" && !quoted) {
      inQuotes = true;
      quoted = true;
    } else if (char === separator) {
      row.push(field);
      field = "";
      quoted = false;
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      quoted = false;
    } else {
      field += char;
    }
  }
  if (field !== "" || quoted || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function isBlank(row: string[]): boolean {
  return row.every((cell) => cell.trim() === "");
}

/** First non-empty line is the header; blank lines are kept out of the data. */
export function parseCsv(input: string): SourceTable {
  const rows = parseCsvRows(input);
  const headerIndex = rows.findIndex((row) => !isBlank(row));
  if (headerIndex === -1) return { headers: [], rows: [], firstRowNumber: 2 };

  const headers = rows[headerIndex].map((cell) => cell.trim());
  const width = headers.length;
  const data = rows.slice(headerIndex + 1).map((row) => {
    const cells = row.slice(0, Math.max(width, row.length));
    while (cells.length < width) cells.push("");
    return cells;
  });
  return { headers, rows: data, firstRowNumber: headerIndex + 2 };
}

// ─── Writing ────────────────────────────────────────────────────────────────

/** "+1 (415) 555-1234", "-42": a sign followed by nothing a formula could call. */
const SIGNED_NUMBER = /^[+-][\d\s().-]*$/;

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // A cell starting with = + - @ would run as a formula when the export is
  // opened in a spreadsheet; a leading apostrophe makes it plain text. Phone
  // numbers start with + too, and are left as they are.
  if (/^[=+\-@\t\r]/.test(text) && !SIGNED_NUMBER.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
