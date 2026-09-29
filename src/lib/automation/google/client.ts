import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "../crypto";
import { RetryableError } from "../queue";
import type { SourceTable } from "../sources/types";

/**
 * Google Sheets over plain HTTPS: OAuth 2.0 for consent, the Drive API to
 * list spreadsheets and the Sheets API to read them. Read-only scopes, no
 * SDK. Tokens are stored encrypted and refreshed here, so callers only ever
 * ask for "the rows of this worksheet".
 *
 * The site never sees a Google password: the owner signs in at Google and
 * Google hands back tokens for exactly these scopes.
 */

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

export const GOOGLE_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

export function missingGoogleEnv(): string[] {
  return GOOGLE_ENV.filter((key) => !process.env[key]);
}

export function isGoogleConfigured(): boolean {
  return missingGoogleEnv().length === 0;
}

export const GOOGLE_CALLBACK_PATH = "/api/admin/google/callback";

/** Must match an "Authorized redirect URI" of the OAuth client exactly. */
export function googleRedirectUri(origin: string): string {
  const base = process.env.GOOGLE_REDIRECT_URI;
  return base ? base : `${origin.replace(/\/+$/, "")}${GOOGLE_CALLBACK_PATH}`;
}

export function googleAuthUrl(state: string, redirectUri: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    // offline + consent: always returns a refresh token, which sync needs.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The connection itself is broken; the owner has to reconnect. */
    readonly needsReconnect = false
  ) {
    super(message);
  }
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: string | { message?: string; status?: string }; error_description?: string };
    if (typeof body.error === "string") return body.error_description ? `${body.error}: ${body.error_description}` : body.error;
    if (body.error?.message) return body.error.message;
  } catch {
    // not JSON
  }
  return text.slice(0, 300) || `HTTP ${res.status}`;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        ...params,
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new RetryableError(`Could not reach Google: ${err instanceof Error ? err.message : "network error"}`);
  }
  if (!res.ok) {
    const message = await readError(res);
    if (res.status >= 500) throw new RetryableError(`Google token endpoint: ${message}`);
    throw new GoogleError(`Google refused the request: ${message}`, res.status, /invalid_grant|invalid_client|unauthorized_client/.test(message));
  }
  return (await res.json()) as TokenResponse;
}

export interface GoogleIdentity {
  email: string;
  name: string | null;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ tokens: TokenResponse; identity: GoogleIdentity }> {
  const tokens = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new GoogleError(`Could not read the Google account: ${await readError(res)}`, res.status);
  const profile = (await res.json()) as { email?: string; name?: string };
  if (!profile.email) throw new GoogleError("Google did not return the account's email address", 400);
  return { tokens, identity: { email: profile.email.toLowerCase(), name: profile.name ?? null } };
}

/** Stores (or refreshes) a connection after consent. */
export async function saveConnection(input: { tokens: TokenResponse; identity: GoogleIdentity; actor: string }): Promise<string> {
  const { tokens, identity } = input;
  const existing = await prisma.googleSheetConnection.findUnique({ where: { googleEmail: identity.email } });
  // Google only sends a refresh token on first consent; keep the one we have.
  const refreshToken = tokens.refresh_token ? encryptSecret(tokens.refresh_token) : existing?.refreshToken;
  if (!refreshToken) {
    throw new GoogleError(
      "Google did not return a refresh token. Remove this site under myaccount.google.com/permissions and connect again.",
      400
    );
  }
  const data = {
    displayName: identity.name,
    accessToken: encryptSecret(tokens.access_token),
    refreshToken,
    tokenExpiresAt: new Date(Date.now() + Math.max(60, tokens.expires_in - 60) * 1000),
    scopes: tokens.scope ?? GOOGLE_SCOPES.join(" "),
    status: "ACTIVE",
    lastError: null,
    connectedBy: input.actor.slice(0, 191),
  };
  const row = await prisma.googleSheetConnection.upsert({
    where: { googleEmail: identity.email },
    update: data,
    create: { googleEmail: identity.email, ...data },
    select: { id: true },
  });
  return row.id;
}

/** A valid access token for a connection, refreshed when it is about to expire. */
export async function accessTokenFor(connectionId: string): Promise<string> {
  const connection = await prisma.googleSheetConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new GoogleError("This Google connection no longer exists.", 404, true);
  if (connection.tokenExpiresAt.getTime() > Date.now() + 30_000) {
    try {
      return decryptSecret(connection.accessToken);
    } catch {
      // Falls through to a refresh, which fails clearly if the key changed.
    }
  }

  let refreshToken: string;
  try {
    refreshToken = decryptSecret(connection.refreshToken);
  } catch {
    const message = "The stored Google token cannot be read (the server secret changed). Connect the account again.";
    await prisma.googleSheetConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastError: message } });
    throw new GoogleError(message, 401, true);
  }

  try {
    const tokens = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
    await prisma.googleSheetConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encryptSecret(tokens.access_token),
        tokenExpiresAt: new Date(Date.now() + Math.max(60, tokens.expires_in - 60) * 1000),
        status: "ACTIVE",
        lastError: null,
      },
    });
    return tokens.access_token;
  } catch (err) {
    if (err instanceof GoogleError && err.needsReconnect) {
      const message = "Google no longer accepts the stored authorisation (revoked or expired). Connect the account again.";
      await prisma.googleSheetConnection.update({ where: { id: connectionId }, data: { status: "ERROR", lastError: message } });
      throw new GoogleError(message, 401, true);
    }
    throw err;
  }
}

async function googleGet<T>(connectionId: string, url: string): Promise<T> {
  const token = await accessTokenFor(connectionId);
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  } catch (err) {
    throw new RetryableError(`Could not reach Google: ${err instanceof Error ? err.message : "network error"}`);
  }
  if (res.ok) return (await res.json()) as T;
  const message = await readError(res);
  if (res.status === 429 || res.status >= 500) throw new RetryableError(`Google API (${res.status}): ${message}`);
  if (res.status === 404) throw new GoogleError("Google cannot find that spreadsheet. Was it deleted, or is it shared with another account?", 404);
  if (res.status === 403) throw new GoogleError(`Google denied access: ${message}`, 403);
  throw new GoogleError(`Google API (${res.status}): ${message}`, res.status, res.status === 401);
}

// ─── Drive: which spreadsheets exist ────────────────────────────────────────

export interface SpreadsheetSummary {
  id: string;
  name: string;
  owner: string;
  modifiedTime: string;
}

export async function listSpreadsheets(connectionId: string, query = ""): Promise<SpreadsheetSummary[]> {
  const filters = ["mimeType='application/vnd.google-apps.spreadsheet'", "trashed=false"];
  const term = query.trim().replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  if (term) filters.push(`name contains '${term}'`);
  const params = new URLSearchParams({
    q: filters.join(" and "),
    fields: "files(id,name,modifiedTime,owners(displayName,emailAddress))",
    orderBy: "modifiedTime desc",
    pageSize: "50",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const body = await googleGet<{
    files?: { id: string; name: string; modifiedTime: string; owners?: { displayName?: string; emailAddress?: string }[] }[];
  }>(connectionId, `https://www.googleapis.com/drive/v3/files?${params}`);
  return (body.files ?? []).map((file) => ({
    id: file.id,
    name: file.name,
    owner: file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || "Shared drive",
    modifiedTime: file.modifiedTime,
  }));
}

/** Accepts a spreadsheet URL or a bare id. */
export function parseSpreadsheetId(value: string): string | null {
  const raw = value.trim();
  const fromUrl = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fromUrl) return fromUrl[1];
  return /^[a-zA-Z0-9_-]{20,}$/.test(raw) ? raw : null;
}

// ─── Sheets: tabs and rows ──────────────────────────────────────────────────

export interface WorksheetSummary {
  /** The tab's gid. */
  id: number;
  title: string;
  rowCount: number;
  columnCount: number;
  hidden: boolean;
}

export interface SpreadsheetMeta {
  id: string;
  name: string;
  worksheets: WorksheetSummary[];
}

export async function getSpreadsheet(connectionId: string, spreadsheetId: string): Promise<SpreadsheetMeta> {
  const params = new URLSearchParams({ fields: "spreadsheetId,properties.title,sheets.properties" });
  const body = await googleGet<{
    spreadsheetId: string;
    properties?: { title?: string };
    sheets?: {
      properties?: {
        sheetId?: number;
        title?: string;
        hidden?: boolean;
        sheetType?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }[];
  }>(connectionId, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params}`);

  return {
    id: body.spreadsheetId,
    name: body.properties?.title ?? "Untitled spreadsheet",
    worksheets: (body.sheets ?? [])
      .filter((sheet) => (sheet.properties?.sheetType ?? "GRID") === "GRID")
      .map((sheet) => ({
        id: sheet.properties?.sheetId ?? 0,
        title: sheet.properties?.title ?? "Sheet",
        rowCount: sheet.properties?.gridProperties?.rowCount ?? 0,
        columnCount: sheet.properties?.gridProperties?.columnCount ?? 0,
        hidden: Boolean(sheet.properties?.hidden),
      })),
  };
}

function a1Sheet(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

/** Turns the API's ragged rows into a table with a header row. */
export function tableFromValues(values: unknown[][]): SourceTable {
  const rows = values.map((row) => row.map((cell) => (cell === null || cell === undefined ? "" : String(cell))));
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim() !== ""));
  if (headerIndex === -1) return { headers: [], rows: [], firstRowNumber: 2 };
  const headers = rows[headerIndex].map((cell) => cell.trim());
  const width = headers.length;
  const data = rows.slice(headerIndex + 1).map((row) => {
    const cells = [...row];
    while (cells.length < width) cells.push("");
    return cells;
  });
  return { headers, rows: data, firstRowNumber: headerIndex + 2 };
}

/**
 * Reads a whole worksheet, or its first `limit` data rows. Values come back
 * as displayed in the sheet (FORMATTED_VALUE), so a phone number stays
 * "+92 300 1234567" instead of turning into 923001234567.
 */
export async function readWorksheet(
  connectionId: string,
  spreadsheetId: string,
  worksheetId: number,
  options: { limit?: number } = {}
): Promise<{ table: SourceTable; spreadsheetName: string; worksheetTitle: string; totalRows: number }> {
  const meta = await getSpreadsheet(connectionId, spreadsheetId);
  const worksheet = meta.worksheets.find((sheet) => sheet.id === worksheetId);
  if (!worksheet) throw new GoogleError("That worksheet no longer exists in the spreadsheet.", 404);

  const range = options.limit ? `${a1Sheet(worksheet.title)}!1:${options.limit + 1}` : a1Sheet(worksheet.title);
  const params = new URLSearchParams({ majorDimension: "ROWS", valueRenderOption: "FORMATTED_VALUE" });
  const body = await googleGet<{ values?: unknown[][] }>(
    connectionId,
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?${params}`
  );
  return {
    table: tableFromValues(body.values ?? []),
    spreadsheetName: meta.name,
    worksheetTitle: worksheet.title,
    totalRows: Math.max(0, worksheet.rowCount - 1),
  };
}

/** Tells Google to forget the grant. Best effort; the row is deleted regardless. */
export async function revokeConnection(connectionId: string): Promise<void> {
  const connection = await prisma.googleSheetConnection.findUnique({ where: { id: connectionId } });
  if (!connection) return;
  try {
    const token = decryptSecret(connection.refreshToken);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Already revoked, unreadable, or Google unreachable: nothing to undo here.
  }
}
