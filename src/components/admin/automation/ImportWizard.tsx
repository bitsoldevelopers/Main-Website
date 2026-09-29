"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SHEET_COLUMNS, type CrmField, type FieldMapping } from "@/lib/automation/columns";
import { validityBadge } from "@/lib/automation/labels";
import type { ImportPreview, PreviewIssue } from "@/lib/automation/preview";
import {
  ASSIGNMENT_MODES,
  ASSIGNMENT_TEAMS,
  DUPLICATE_MODES,
  SUGGESTED_TAGS,
  SYNC_INTERVALS,
  type AssignmentMode,
  type AssignmentTeam,
  type DuplicateMode,
} from "@/lib/automation/sources/types";
import { EMAIL_REASON_LABELS, type EmailReason } from "@/lib/automation/validate";
import { Callout, Field, Pill, btn, inputClass, selectClass } from "@/components/admin/ui";
import { Figure, StepBar } from "./parts";

interface Connection {
  id: string;
  googleEmail: string;
  status: string;
}

interface Option {
  id: string;
  name: string;
  hint?: string;
}

export interface ImportWizardProps {
  source: "google_sheets" | "csv";
  connections?: Connection[];
  /** Google credentials are set on the server. */
  googleReady?: boolean;
  missingEnv?: string[];
  canConnect?: boolean;
  automations: { id: string; name: string; status: string }[];
  assignees: Option[];
  /** Open directly on a worksheet that is already linked. */
  initial?: { connectionId: string; spreadsheetId: string; spreadsheetName: string; worksheetId: number; worksheetTitle: string };
}

interface Spreadsheet {
  id: string;
  name: string;
  owner: string;
  modifiedTime: string;
}

interface Worksheet {
  id: number;
  title: string;
  rowCount: number;
  columnCount: number;
  hidden: boolean;
  linkedId: string | null;
}

interface Settings {
  duplicateMode: DuplicateMode;
  autoStartAutomation: boolean;
  automationId: string;
  assignmentMode: AssignmentMode;
  assigneeId: string;
  assignmentTeam: AssignmentTeam | "";
  tags: string[];
  checkDomains: boolean;
  syncIntervalMinutes: number;
}

interface Progress {
  id: string;
  status: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  duplicateCount: number;
  invalidCount: number;
  skippedCount: number;
  failedCount: number;
  automationStarted: number;
  error: string | null;
}

const SHEET_STEPS = ["Connect", "Spreadsheet", "Worksheet", "Preview", "Mapping", "Settings", "Import"];
const CSV_STEPS = ["Upload", "Preview", "Mapping", "Settings", "Import"];

const ISSUE_FILTERS: { issue: PreviewIssue; label: string; group: "invalid" | "duplicates" | "missing" }[] = [
  { issue: "invalid_email", label: "Invalid emails", group: "invalid" },
  { issue: "invalid_row", label: "Rows that cannot be imported", group: "invalid" },
  { issue: "risky_email", label: "Risky emails", group: "invalid" },
  { issue: "duplicate_email", label: "Duplicate emails", group: "duplicates" },
  { issue: "missing_email", label: "Missing emails", group: "missing" },
  { issue: "missing_name", label: "Missing names", group: "missing" },
  { issue: "missing_company", label: "Missing companies", group: "missing" },
  { issue: "missing_website", label: "Missing websites", group: "missing" },
  { issue: "missing_linkedin", label: "Missing LinkedIn URLs", group: "missing" },
  { issue: "missing_phone", label: "Missing phone numbers", group: "missing" },
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, cache: "no-store" });
  } catch {
    throw new Error("Could not reach the server. Check the connection and try again.");
  }
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !body) throw new Error(body?.error ?? `The server answered with an error (${res.status}).`);
  return body;
}

function formatModified(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function ImportWizard({ source, connections = [], googleReady = true, missingEnv = [], canConnect = false, automations, assignees, initial }: ImportWizardProps) {
  const steps = source === "csv" ? CSV_STEPS : SHEET_STEPS;
  const usable = connections.filter((c) => c.status === "ACTIVE");
  const stepOf = (name: string) => steps.indexOf(name);

  const [step, setStep] = useState(initial ? stepOf("Preview") : source === "csv" || usable.length === 0 ? 0 : 1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [connectionId, setConnectionId] = useState(initial?.connectionId ?? usable[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [link, setLink] = useState("");
  const [spreadsheets, setSpreadsheets] = useState<Spreadsheet[] | null>(null);
  const [spreadsheet, setSpreadsheet] = useState<{ id: string; name: string } | null>(
    initial ? { id: initial.spreadsheetId, name: initial.spreadsheetName } : null
  );
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [worksheet, setWorksheet] = useState<{ id: number; title: string } | null>(
    initial ? { id: initial.worksheetId, title: initial.worksheetTitle } : null
  );

  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [sourceLabel, setSourceLabel] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [issue, setIssue] = useState<PreviewIssue | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [linkedId, setLinkedId] = useState<string | null>(null);

  const defaultAutomation = automations.find((a) => a.status === "ACTIVE")?.id ?? automations[0]?.id ?? "";
  const [settings, setSettings] = useState<Settings>({
    duplicateMode: "UPDATE",
    autoStartAutomation: false,
    automationId: defaultAutomation,
    assignmentMode: "UNASSIGNED",
    assigneeId: "",
    assignmentTeam: "",
    tags: [source === "csv" ? "CSV" : "Google Sheets"],
    checkDomains: true,
    syncIntervalMinutes: 0,
  });
  const [tagDraft, setTagDraft] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, []);

  // ── Step: spreadsheets ────────────────────────────────────────────────────

  const loadSpreadsheets = useCallback(
    (connection: string, search: string) =>
      run(async () => {
        const body = await api<{ spreadsheets: Spreadsheet[] }>(
          `/api/admin/automation/sheets?connection=${encodeURIComponent(connection)}&q=${encodeURIComponent(search)}`
        );
        setSpreadsheets(body.spreadsheets);
      }),
    [run]
  );

  const onSpreadsheetStep = source === "google_sheets" && step === stepOf("Spreadsheet");
  useEffect(() => {
    if (!onSpreadsheetStep || !connectionId) return;
    // Debounced: one request once the typing stops.
    const timer = setTimeout(() => void loadSpreadsheets(connectionId, query.trim()), query ? 350 : 0);
    return () => clearTimeout(timer);
  }, [onSpreadsheetStep, connectionId, query, loadSpreadsheets]);

  const openSpreadsheet = (idOrLink: string) =>
    run(async () => {
      const body = await api<{ spreadsheet: { id: string; name: string }; worksheets: Worksheet[] }>(
        `/api/admin/automation/sheets/worksheets?connection=${encodeURIComponent(connectionId)}&spreadsheet=${encodeURIComponent(idOrLink)}`
      );
      setSpreadsheet(body.spreadsheet);
      setWorksheets(body.worksheets);
      setWorksheet(null);
      setStep(stepOf("Worksheet"));
    });

  // ── Step: preview ─────────────────────────────────────────────────────────

  const loadPreview = useCallback(
    (options: { sheet?: { id: number; title: string }; csv?: { name: string; content: string }; mapping?: FieldMapping; issue?: PreviewIssue | null; advance?: boolean }) =>
      run(async () => {
        type Body = {
          source: { name: string; worksheet: string | null };
          preview: ImportPreview;
          linked: { id: string; settings: Partial<Settings> & { tags?: string[] }; syncIntervalMinutes: number } | null;
        };
        let body: Body;
        const useMapping = options.mapping && Object.keys(options.mapping).length > 0 ? options.mapping : undefined;
        if (source === "csv") {
          const csv = options.csv ?? file;
          if (!csv) throw new Error("Choose a file first.");
          body = await api<Body>("/api/admin/automation/csv/preview", {
            method: "POST",
            body: JSON.stringify({ filename: csv.name, content: csv.content, mapping: useMapping, issue: options.issue ?? undefined }),
          });
        } else {
          const sheet = options.sheet ?? worksheet;
          if (!spreadsheet || !sheet) throw new Error("Choose a worksheet first.");
          const params = new URLSearchParams({ connection: connectionId, spreadsheet: spreadsheet.id, gid: String(sheet.id) });
          if (useMapping) params.set("mapping", JSON.stringify(useMapping));
          if (options.issue) params.set("issue", options.issue);
          body = await api<Body>(`/api/admin/automation/sheets/preview?${params}`);
        }

        setPreview(body.preview);
        setIssue(options.issue ?? null);
        setSourceLabel([body.source.name, body.source.worksheet].filter(Boolean).join(" › "));
        if (options.advance) {
          setMapping(body.preview.mapping);
          setLinkedId(body.linked?.id ?? null);
          if (body.linked) {
            const saved = body.linked.settings;
            setSettings((current) => ({
              ...current,
              duplicateMode: saved.duplicateMode ?? current.duplicateMode,
              autoStartAutomation: saved.autoStartAutomation ?? current.autoStartAutomation,
              automationId: saved.automationId || current.automationId,
              assignmentMode: saved.assignmentMode ?? current.assignmentMode,
              assigneeId: saved.assigneeId ?? "",
              assignmentTeam: saved.assignmentTeam ?? "",
              tags: saved.tags?.length ? saved.tags : current.tags,
              syncIntervalMinutes: body.linked?.syncIntervalMinutes ?? 0,
            }));
          }
          setStep(stepOf("Preview"));
        }
      }),
    // stepOf only depends on `source`, which never changes for a mounted wizard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run, source, file, worksheet, spreadsheet, connectionId]
  );

  // A wizard opened on a linked worksheet starts with its preview.
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!initial || openedInitial.current) return;
    openedInitial.current = true;
    const timer = setTimeout(() => void loadPreview({ sheet: { id: initial.worksheetId, title: initial.worksheetTitle }, advance: true }), 0);
    return () => clearTimeout(timer);
  }, [initial, loadPreview]);

  async function chooseFile(picked: File | undefined) {
    if (!picked) return;
    setError("");
    if (picked.size > 8 * 1024 * 1024) {
      setError("The file is larger than 8 MB. Split it and upload the parts.");
      return;
    }
    const content = await picked.text();
    const next = { name: picked.name, content };
    setFile(next);
    await loadPreview({ csv: next, advance: true });
  }

  // ── Step: import ──────────────────────────────────────────────────────────

  const startImport = () =>
    run(async () => {
      const payload = {
        source,
        settings: {
          mapping,
          duplicateMode: settings.duplicateMode,
          autoStartAutomation: settings.autoStartAutomation,
          automationId: settings.autoStartAutomation ? settings.automationId : "",
          assignmentMode: settings.assignmentMode,
          assigneeId: settings.assignmentMode === "USER" ? settings.assigneeId : "",
          assignmentTeam: settings.assignmentMode === "TEAM" ? settings.assignmentTeam : "",
          tags: settings.tags,
          checkDomains: settings.checkDomains,
        },
        ...(source === "csv"
          ? { filename: file?.name, content: file?.content }
          : { connectionId, spreadsheetId: spreadsheet?.id, worksheetId: worksheet?.id, syncIntervalMinutes: settings.syncIntervalMinutes }),
      };
      const body = await api<{ importId: string }>("/api/admin/automation/imports", { method: "POST", body: JSON.stringify(payload) });
      setProgress({
        id: body.importId,
        status: "QUEUED",
        totalRows: 0,
        createdCount: 0,
        updatedCount: 0,
        duplicateCount: 0,
        invalidCount: 0,
        skippedCount: 0,
        failedCount: 0,
        automationStarted: 0,
        error: null,
      });
      setStep(stepOf("Import"));
    });

  const importId = progress?.id;
  const finished = progress?.status === "COMPLETED" || progress?.status === "FAILED";
  useEffect(() => {
    if (!importId || finished) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const body = await api<{ import: Progress }>(`/api/admin/automation/imports/${importId}`);
        if (!cancelled) setProgress(body.import);
      } catch {
        // A missed poll is not an error worth showing; the next one follows.
      }
    };
    const timer = setInterval(poll, 1500);
    void poll();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [importId, finished]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const mapped = Object.keys(mapping).length;
  const missing = SHEET_COLUMNS.filter((column) => !mapping[column.field]);
  const noEmailColumn = !mapping.email_primary && !mapping.email_secondary && !mapping.email_personal;

  function setField(field: CrmField, header: string) {
    setMapping((current) => {
      const next: FieldMapping = { ...current };
      // A source column feeds one CRM field.
      for (const key of Object.keys(next) as CrmField[]) if (next[key] === header) delete next[key];
      if (header) next[field] = header;
      else delete next[field];
      return next;
    });
  }

  function addTag(raw: string) {
    const tag = raw.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!tag) return;
    setSettings((s) => (s.tags.some((t) => t.toLowerCase() === tag.toLowerCase()) || s.tags.length >= 20 ? s : { ...s, tags: [...s.tags, tag] }));
    setTagDraft("");
  }

  const settingsProblem =
    settings.autoStartAutomation && !settings.automationId
      ? "Choose the automation to start."
      : settings.assignmentMode === "USER" && !settings.assigneeId
        ? "Choose who the new leads are assigned to."
        : settings.assignmentMode === "TEAM" && !settings.assignmentTeam
          ? "Choose the team."
          : "";
  const chosenAutomation = automations.find((a) => a.id === settings.automationId);

  const back = (to: string) => (
    <button type="button" onClick={() => { setError(""); setStep(stepOf(to)); }} className={btn.secondary} disabled={busy}>
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  const current = steps[step];

  return (
    <div>
      <StepBar steps={steps} current={step} />

      {error && (
        <p role="alert" className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {current === "Connect" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Connect Google Sheets</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              You sign in at Google and approve read-only access to your spreadsheets. This site never sees your Google
              password, cannot change your sheets, and stores the access it is given encrypted.
            </p>
          </div>
          {!googleReady ? (
            <Callout tone="amber" title="Google is not configured on this server">
              Set {missingEnv.join(" and ") || "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET"} in the environment variables, then
              reload this page. Until then, leads can be imported by uploading a CSV export of the sheet.{" "}
              <Link href="/admin/automation/sources/csv" className="font-semibold text-cyan-700 underline">
                Upload a CSV
              </Link>
            </Callout>
          ) : canConnect ? (
            <a href="/api/admin/google/connect?returnTo=/admin/automation/sources/google-sheets" className={btn.primary}>
              <FileSpreadsheet className="h-4 w-4" /> Connect Google Sheets
            </a>
          ) : (
            <Callout tone="amber" title="An admin has to connect the Google account">
              Your role can run imports but not connect accounts. Ask an admin to connect Google Sheets here.
            </Callout>
          )}
          {usable.length > 0 && (
            <button type="button" onClick={() => setStep(stepOf("Spreadsheet"))} className={btn.secondary}>
              Use {usable[0].googleEmail} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {current === "Spreadsheet" && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Select a spreadsheet</h2>
              <p className="mt-1 text-sm text-slate-500">Most recently edited first.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {usable.length > 1 && (
                <select
                  value={connectionId}
                  onChange={(e) => {
                    setConnectionId(e.target.value);
                    setSpreadsheets(null);
                  }}
                  className={cn(selectClass, "w-60")}
                  aria-label="Google account"
                >
                  {usable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.googleEmail}
                    </option>
                  ))}
                </select>
              )}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name"
                  className={cn(inputClass, "w-64 pl-9")}
                  aria-label="Search spreadsheets"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Spreadsheet</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Last modified</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {spreadsheets === null ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading spreadsheets…
                      </td>
                    </tr>
                  ) : spreadsheets.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                        {query ? "No spreadsheet matches that name." : "This Google account has no spreadsheets."}
                      </td>
                    </tr>
                  ) : (
                    spreadsheets.map((sheet) => (
                      <tr key={sheet.id} className={cn("border-t border-slate-100", busy && "opacity-60")}>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          <span className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600" /> {sheet.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{sheet.owner}</td>
                        <td className="px-4 py-3 text-slate-500">{formatModified(sheet.modifiedTime)}</td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" disabled={busy} onClick={() => void openSpreadsheet(sheet.id)} className={btn.secondary}>
                            Select
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <form
            className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              if (link.trim()) void openSpreadsheet(link.trim());
            }}
          >
            <Field label="Or paste the spreadsheet's link" htmlFor="sheet-link" className="flex-1">
              <input
                id="sheet-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className={cn(inputClass, "bg-white")}
              />
            </Field>
            <button type="submit" disabled={busy || !link.trim()} className={btn.secondary}>
              Open
            </button>
          </form>

          <div>{usable.length === 0 ? back("Connect") : null}</div>
        </div>
      )}

      {current === "Worksheet" && spreadsheet && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Select a worksheet</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tabs of <span className="font-semibold text-slate-700">{spreadsheet.name}</span>. The first row of the tab must hold
              the column titles.
            </p>
          </div>
          {worksheets.length === 0 ? (
            <Callout tone="amber" title="This spreadsheet has no worksheets that can be read" />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {worksheets.map((sheet) => (
                <li key={sheet.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      const picked = { id: sheet.id, title: sheet.title };
                      setWorksheet(picked);
                      void loadPreview({ sheet: picked, advance: true });
                    }}
                    className="flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-cyan-400 hover:shadow-sm disabled:opacity-60"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate font-semibold text-slate-900">{sheet.title}</span>
                      {sheet.linkedId && <Pill tone="cyan">Linked</Pill>}
                    </span>
                    <span className="text-xs text-slate-500">
                      Up to {Math.max(0, sheet.rowCount - 1).toLocaleString()} rows · {sheet.columnCount} columns
                      {sheet.hidden ? " · hidden tab" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {busy && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the worksheet…
            </p>
          )}
          {back("Spreadsheet")}
        </div>
      )}

      {current === "Upload" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Upload a CSV</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              In Google Sheets: File → Download → Comma-separated values. The first row must hold the column titles. Up
              to 20,000 rows and 8 MB per file.
            </p>
          </div>
          <input ref={fileInput} type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void chooseFile(e.target.files?.[0])} />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void chooseFile(e.dataTransfer.files?.[0]);
            }}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-14 text-center transition hover:border-cyan-400 hover:bg-cyan-50/40 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-7 w-7 animate-spin text-cyan-700" /> : <Upload className="h-7 w-7 text-slate-400" />}
            <span className="text-sm font-semibold text-slate-900">{busy ? "Reading the file…" : "Choose a CSV file, or drop it here"}</span>
            <span className="text-xs text-slate-500">Expected columns: {SHEET_COLUMNS.slice(0, 5).map((c) => c.header).join(", ")}, …</span>
          </button>
        </div>
      )}

      {current === "Preview" && preview && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">Preview</h2>
              <p className="mt-1 truncate text-sm text-slate-500">
                {sourceLabel} · {preview.totalRows.toLocaleString()} rows with data. Nothing has been imported yet.
              </p>
            </div>
            <button type="button" disabled={busy} onClick={() => void loadPreview({ mapping, issue })} className={btn.ghost}>
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /> Reload
            </button>
          </div>

          {preview.missing.length > 0 && (
            <Callout tone="amber" icon={AlertTriangle} title={`${preview.missing.length} expected column${preview.missing.length === 1 ? "" : "s"} not found`}>
              <ul className="mt-1 space-y-0.5">
                {preview.missing.map((header) => (
                  <li key={header}>⚠ {header} column not found.</li>
                ))}
              </ul>
              <p className="mt-2">Those fields stay empty unless you map them to another column in the next step.</p>
            </Callout>
          )}

          <section aria-labelledby="quality-heading">
            <h3 id="quality-heading" className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
              Data quality
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Figure label="Total rows" value={preview.quality.totalRows.toLocaleString()} hint={preview.quality.blankRows ? `${preview.quality.blankRows} empty rows ignored` : undefined} />
              <Figure label="Valid emails" value={preview.quality.validEmails.toLocaleString()} tone="green" hint={`${preview.quality.riskyEmails.toLocaleString()} more are risky`} />
              <Figure label="Missing emails" value={preview.quality.missingEmails.toLocaleString()} tone={preview.quality.missingEmails ? "amber" : "slate"} />
              <Figure label="Duplicate emails" value={preview.quality.duplicateEmails.toLocaleString()} tone={preview.quality.duplicateEmails ? "amber" : "slate"} />
              <Figure label="Invalid emails" value={preview.quality.invalidEmails.toLocaleString()} tone={preview.quality.invalidEmails ? "red" : "slate"} />
              <Figure label="Missing names" value={preview.quality.missingNames.toLocaleString()} />
              <Figure label="Missing companies" value={preview.quality.missingCompanies.toLocaleString()} />
              <Figure label="Missing websites" value={preview.quality.missingWebsites.toLocaleString()} hint={preview.quality.invalidWebsites ? `${preview.quality.invalidWebsites} not valid URLs` : undefined} />
              <Figure label="Missing LinkedIn URLs" value={preview.quality.missingLinkedin.toLocaleString()} hint={preview.quality.invalidLinkedin ? `${preview.quality.invalidLinkedin} not LinkedIn URLs` : undefined} />
              <Figure label="Missing phone numbers" value={preview.quality.missingPhones.toLocaleString()} />
            </div>
          </section>

          <section aria-labelledby="rows-heading">
            <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 id="rows-heading" className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                {issue ? `Rows: ${ISSUE_FILTERS.find((f) => f.issue === issue)?.label.toLowerCase()}` : `First ${Math.min(50, preview.rows.length)} rows`}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="issue-filter" className="text-xs font-semibold text-slate-500">
                  Show
                </label>
                <select
                  id="issue-filter"
                  value={issue ?? ""}
                  disabled={busy}
                  onChange={(e) => void loadPreview({ mapping, issue: (e.target.value || null) as PreviewIssue | null })}
                  className={cn(selectClass, "w-64")}
                >
                  <option value="">All rows</option>
                  <optgroup label="View invalid">
                    {ISSUE_FILTERS.filter((f) => f.group === "invalid").map((f) => (
                      <option key={f.issue} value={f.issue}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="View duplicates">
                    {ISSUE_FILTERS.filter((f) => f.group === "duplicates").map((f) => (
                      <option key={f.issue} value={f.issue}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="View missing data">
                    {ISSUE_FILTERS.filter((f) => f.group === "missing").map((f) => (
                      <option key={f.issue} value={f.issue}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            </div>

            <div className={cn("overflow-hidden rounded-2xl border border-slate-200 bg-white", busy && "opacity-60")}>
              {preview.rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">{issue ? "No rows have this problem." : "The source has a header row but no data rows."}</p>
              ) : (
                <div className="max-h-[480px] overflow-auto">
                  <table className="w-max min-w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                      <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="sticky left-0 z-20 bg-slate-50 px-3 py-2.5">Row</th>
                        {preview.headers.map((header, i) => (
                          <th key={`${header}-${i}`} className="whitespace-nowrap px-3 py-2.5">
                            {header || <span className="text-slate-400">(no title)</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber} className="border-t border-slate-100 align-top">
                          <td className="sticky left-0 bg-white px-3 py-2 text-xs tabular-nums text-slate-500" title={row.invalidReason ?? undefined}>
                            {row.rowNumber}
                            {row.invalidReason && <span className="ml-1 text-red-600">✕</span>}
                          </td>
                          {preview.headers.map((header, i) => {
                            const email = row.emails.find((e) => e.header === header);
                            const badge = email ? validityBadge(email.validity) : null;
                            const cell = row.cells[i] ?? "";
                            return (
                              <td key={`${row.rowNumber}-${i}`} className="max-w-[280px] px-3 py-2 text-slate-700">
                                <span className="block truncate" title={cell}>
                                  {cell}
                                </span>
                                {email && badge && (
                                  <span
                                    className={cn(
                                      "mt-0.5 block text-[11px] font-semibold",
                                      badge.tone === "green" && "text-emerald-700",
                                      badge.tone === "amber" && "text-amber-700",
                                      badge.tone === "red" && "text-red-600"
                                    )}
                                    title={EMAIL_REASON_LABELS[email.reason as EmailReason] ?? email.reason}
                                  >
                                    {badge.label}
                                    {email.validity !== "VALID" && ` · ${(EMAIL_REASON_LABELS[email.reason as EmailReason] ?? email.reason).toLowerCase()}`}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Scroll sideways for all {preview.headers.length} columns. Email checks here cover the format; the import also looks
              up each domain&apos;s mail server.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-2">
            {back(source === "csv" ? "Upload" : "Worksheet")}
            <button type="button" onClick={() => setStep(stepOf("Mapping"))} disabled={busy || preview.totalRows === 0} className={btn.primary}>
              Continue to mapping <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {current === "Mapping" && preview && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Field mapping</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Columns were matched by their titles. Change any of them, or choose &quot;Do not import&quot;. The original row is
              stored with every lead, including columns that are not mapped.
            </p>
          </div>

          {noEmailColumn && (
            <Callout tone="amber" icon={AlertTriangle} title="No email column is mapped">
              Leads will be imported, but none of them can be added to an email automation.
            </Callout>
          )}

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">{source === "csv" ? "File column" : "Google Sheet column"}</th>
                  <th className="w-10 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3">BITSOL CRM field</th>
                  <th className="hidden px-4 py-3 md:table-cell">Example</th>
                </tr>
              </thead>
              <tbody>
                {SHEET_COLUMNS.map((column) => {
                  const header = mapping[column.field] ?? "";
                  const index = header ? preview.headers.indexOf(header) : -1;
                  const example = index >= 0 ? preview.rows.map((row) => row.cells[index]).find((cell) => cell?.trim()) : "";
                  return (
                    <tr key={column.field} className="border-t border-slate-100">
                      <td className="px-4 py-2.5">
                        <select
                          value={header}
                          onChange={(e) => setField(column.field, e.target.value)}
                          aria-label={`Source column for ${column.label}`}
                          className={cn(selectClass, "py-2", !header && "border-amber-300 bg-amber-50")}
                        >
                          <option value="">Do not import</option>
                          {preview.headers
                            .filter((h) => h.trim())
                            .map((h, i) => (
                              <option key={`${h}-${i}`} value={h}>
                                {h}
                              </option>
                            ))}
                        </select>
                        {!header && <p className="mt-1 text-xs text-amber-700">⚠ {column.header} column not found.</p>}
                        {header && preview.guessed.includes(column.field) && header === preview.mapping[column.field] && (
                          <p className="mt-1 text-xs text-slate-500">Matched by a similar title; expected &quot;{column.header}&quot;.</p>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center text-slate-400">→</td>
                      <td className="px-4 py-2.5">
                        <span className="font-semibold text-slate-900">{column.label}</span>
                        <span className="block font-mono text-[11px] text-slate-500">{column.field}</span>
                      </td>
                      <td className="hidden max-w-[260px] truncate px-4 py-2.5 text-slate-500 md:table-cell" title={example || undefined}>
                        {example || <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            {mapped} of {SHEET_COLUMNS.length} fields mapped
            {missing.length > 0 && ` · not imported: ${missing.map((c) => c.header).join(", ")}`}.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            {back("Preview")}
            <button type="button" onClick={() => setStep(stepOf("Settings"))} disabled={mapped === 0} className={btn.primary}>
              Continue to settings <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {current === "Settings" && preview && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              {sourceLabel} · {preview.totalRows.toLocaleString()} rows
              {linkedId && " · this worksheet is already linked; saving updates its settings"}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
              <legend className="px-1 text-sm font-bold text-slate-900">Duplicate handling</legend>
              <p className="mb-3 text-xs text-slate-500">When a row is a lead the CRM already has.</p>
              <div className="space-y-2">
                {(Object.keys(DUPLICATE_MODES) as DuplicateMode[]).map((mode) => (
                  <label key={mode} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-50">
                    <input
                      type="radio"
                      name="duplicateMode"
                      value={mode}
                      checked={settings.duplicateMode === mode}
                      onChange={() => setSettings((s) => ({ ...s, duplicateMode: mode }))}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-semibold text-slate-900">
                        {DUPLICATE_MODES[mode]}
                        {mode === "UPDATE" && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-cyan-700">Default</span>}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {mode === "UPDATE" && "Fill in and refresh the existing lead. Empty cells never erase what the CRM has."}
                        {mode === "SKIP" && "Leave the existing lead exactly as it is."}
                        {mode === "REVIEW" && "Hold the row; you decide per row after the import."}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
              <legend className="px-1 text-sm font-bold text-slate-900">Automation</legend>
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={settings.autoStartAutomation}
                  onChange={(e) => setSettings((s) => ({ ...s, autoStartAutomation: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold text-slate-900">Automatically start automation for new leads</span>
                  <span className="block text-xs text-slate-500">
                    Only leads this import creates, and only those with an address that may be emailed. Existing leads are
                    never enrolled by an import.
                  </span>
                </span>
              </label>
              {settings.autoStartAutomation && (
                <div className="mt-4">
                  <Field label="Select automation" htmlFor="automation">
                    <select
                      id="automation"
                      value={settings.automationId}
                      onChange={(e) => setSettings((s) => ({ ...s, automationId: e.target.value }))}
                      className={selectClass}
                    >
                      {automations.length === 0 && <option value="">No automation exists yet</option>}
                      {automations.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {a.status !== "ACTIVE" ? ` (${a.status.toLowerCase()})` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {chosenAutomation && chosenAutomation.status !== "ACTIVE" && (
                    <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      &quot;{chosenAutomation.name}&quot; is {chosenAutomation.status.toLowerCase()}. The leads will be imported but no
                      email is sent until it is activated and started for them.{" "}
                      <Link href={`/admin/automation/automations/${chosenAutomation.id}`} className="font-semibold underline">
                        Open the automation
                      </Link>
                    </p>
                  )}
                </div>
              )}
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
              <legend className="px-1 text-sm font-bold text-slate-900">Assignment</legend>
              <p className="mb-3 text-xs text-slate-500">Who owns the new leads. Existing leads keep their owner.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Assign to" htmlFor="assignment">
                  <select
                    id="assignment"
                    value={settings.assignmentMode}
                    onChange={(e) => setSettings((s) => ({ ...s, assignmentMode: e.target.value as AssignmentMode }))}
                    className={selectClass}
                  >
                    {(Object.keys(ASSIGNMENT_MODES) as AssignmentMode[]).map((mode) => (
                      <option key={mode} value={mode}>
                        {ASSIGNMENT_MODES[mode]}
                      </option>
                    ))}
                  </select>
                </Field>
                {settings.assignmentMode === "USER" && (
                  <Field label="Team member" htmlFor="assignee">
                    <select id="assignee" value={settings.assigneeId} onChange={(e) => setSettings((s) => ({ ...s, assigneeId: e.target.value }))} className={selectClass}>
                      <option value="">Choose…</option>
                      {assignees.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {settings.assignmentMode === "TEAM" && (
                  <Field label="Team" htmlFor="team">
                    <select
                      id="team"
                      value={settings.assignmentTeam}
                      onChange={(e) => setSettings((s) => ({ ...s, assignmentTeam: e.target.value as AssignmentTeam | "" }))}
                      className={selectClass}
                    >
                      <option value="">Choose…</option>
                      {(Object.keys(ASSIGNMENT_TEAMS) as AssignmentTeam[]).map((team) => (
                        <option key={team} value={team}>
                          {ASSIGNMENT_TEAMS[team]}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {settings.assignmentMode === "ROUND_ROBIN" && "Leads are dealt out in turn to admins and business development managers."}
                {settings.assignmentMode === "TEAM" && "Leads are dealt out in turn to everyone with that role."}
                {settings.assignmentMode !== "UNASSIGNED" && assignees.length === 0 && " There are no team accounts yet; create them under Users."}
              </p>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
              <legend className="px-1 text-sm font-bold text-slate-900">Tags</legend>
              <div className="mb-3 flex min-h-8 flex-wrap gap-1.5">
                {settings.tags.length === 0 && <span className="text-xs text-slate-500">No tags.</span>}
                {settings.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-slate-900 py-1 pl-3 pr-1.5 text-xs font-semibold text-white">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      onClick={() => setSettings((s) => ({ ...s, tags: s.tags.filter((t) => t !== tag) }))}
                      className="grid h-4 w-4 place-items-center rounded-full hover:bg-white/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagDraft);
                    }
                  }}
                  placeholder="Add a tag and press Enter"
                  className={inputClass}
                  aria-label="New tag"
                />
                <button type="button" onClick={() => addTag(tagDraft)} className={btn.secondary}>
                  Add
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {SUGGESTED_TAGS.filter((tag) => !settings.tags.includes(tag)).map((tag) => (
                  <button key={tag} type="button" onClick={() => addTag(tag)} className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 transition hover:border-slate-400 hover:bg-slate-100">
                    + {tag}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <legend className="px-1 text-sm font-bold text-slate-900">Checks{source === "google_sheets" ? " and sync" : ""}</legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={settings.checkDomains} onChange={(e) => setSettings((s) => ({ ...s, checkDomains: e.target.checked }))} className="mt-1" />
                  <span>
                    <span className="font-semibold text-slate-900">Check that each email domain accepts mail</span>
                    <span className="block text-xs text-slate-500">A DNS lookup per domain. Adds up to a minute on a large sheet and catches dead domains before they bounce.</span>
                  </span>
                </label>
                {source === "google_sheets" && (
                  <Field label="Keep in sync" htmlFor="interval" hint="New and edited rows are picked up; rows removed from the sheet never delete a lead.">
                    <select
                      id="interval"
                      value={settings.syncIntervalMinutes}
                      onChange={(e) => setSettings((s) => ({ ...s, syncIntervalMinutes: Number(e.target.value) }))}
                      className={selectClass}
                    >
                      {SYNC_INTERVALS.map((interval) => (
                        <option key={interval.minutes} value={interval.minutes}>
                          {interval.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            </fieldset>
          </div>

          {settingsProblem && <p className="text-sm text-amber-700">{settingsProblem}</p>}

          <div className="flex flex-wrap items-center gap-2">
            {back("Mapping")}
            <button type="button" onClick={() => void startImport()} disabled={busy || Boolean(settingsProblem)} className={btn.primary}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import {preview.totalRows.toLocaleString()} rows
            </button>
          </div>
        </div>
      )}

      {current === "Import" && progress && (
        <div className="space-y-6">
          <div className="flex items-start gap-3">
            {progress.status === "COMPLETED" ? (
              <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600" />
            ) : progress.status === "FAILED" ? (
              <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-red-600" />
            ) : (
              <Loader2 className="mt-0.5 h-7 w-7 shrink-0 animate-spin text-cyan-700" />
            )}
            <div>
              <h2 className="text-lg font-bold text-slate-900" aria-live="polite">
                {progress.status === "COMPLETED" && "Import finished"}
                {progress.status === "FAILED" && "The import failed"}
                {progress.status === "RUNNING" && `Importing… ${progress.totalRows.toLocaleString()} of ${preview?.totalRows.toLocaleString() ?? "?"} rows`}
                {progress.status === "QUEUED" && "Queued…"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {finished ? sourceLabel : "You can leave this page; the import continues in the background and appears under Imports."}
              </p>
              {progress.error && <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{progress.error}</p>}
            </div>
          </div>

          {!finished && preview && preview.totalRows > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-cyan-100" role="progressbar" aria-valuemin={0} aria-valuemax={preview.totalRows} aria-valuenow={progress.totalRows}>
              <div className="h-full rounded-full bg-cyan-600 transition-[width] duration-700" style={{ width: `${Math.min(100, (progress.totalRows / preview.totalRows) * 100)}%` }} />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Total rows" value={progress.totalRows.toLocaleString()} />
            <Figure label="New leads" value={progress.createdCount.toLocaleString()} tone="green" />
            <Figure label="Updated" value={progress.updatedCount.toLocaleString()} tone="cyan" />
            <Figure label="Duplicates" value={progress.duplicateCount.toLocaleString()} tone={progress.duplicateCount ? "amber" : "slate"} />
            <Figure label="Invalid" value={progress.invalidCount.toLocaleString()} tone={progress.invalidCount ? "red" : "slate"} />
            <Figure label="Skipped" value={progress.skippedCount.toLocaleString()} hint="Already up to date" />
            <Figure label="Failed" value={progress.failedCount.toLocaleString()} tone={progress.failedCount ? "red" : "slate"} />
            <Figure label="Automation started" value={progress.automationStarted.toLocaleString()} tone="purple" />
          </div>

          {finished && (
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/admin/leads?importId=${progress.id}`} className={btn.primary}>
                View leads
              </Link>
              <Link href={`/admin/automation/imports/${progress.id}?outcome=problems`} className={btn.secondary}>
                View errors
              </Link>
              <Link href={`/admin/automation/imports/${progress.id}`} className={btn.secondary}>
                View import log
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
