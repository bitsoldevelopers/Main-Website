import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileSpreadsheet, Plus, RefreshCw, Settings2 } from "lucide-react";
import { getAdminSession, requireAdminPage } from "@/lib/admin/auth";
import { formatDate, timeAgo } from "@/lib/admin/format";
import { listAssignees } from "@/lib/admin/queries-crm";
import { hasPermission } from "@/lib/admin/rbac";
import { paramFrom } from "@/lib/admin/queries";
import { disconnectGoogle, setWorksheetInterval, syncWorksheetNow, unlinkWorksheet } from "@/app/admin/actions-import";
import { GOOGLE_CALLBACK_PATH } from "@/lib/automation/google/client";
import { relativeTime, syncBadge } from "@/lib/automation/labels";
import { getGoogleSheetsState, listActiveAutomations } from "@/lib/automation/queries";
import { SYNC_INTERVALS } from "@/lib/automation/sources/types";
import { ImportWizard } from "@/components/admin/automation/ImportWizard";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import { Callout, DbUnavailable, EmptyState, KeyValue, PageHeader, Panel, Pill, btn, selectClass, tdClass, thClass, trClass } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Google Sheets" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function GoogleSheetsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("outreach.read");
  const session = await getAdminSession();
  const canWrite = session ? hasPermission(session.role, "outreach.write") : false;
  const canManage = session ? hasPermission(session.role, "outreach.manage") : false;

  const sp = await searchParams;
  const error = paramFrom(sp.error);
  const connected = paramFrom(sp.connected);
  const wizard = paramFrom(sp.import);
  const edit = paramFrom(sp.worksheet);

  const [state, automations, assignees] = await Promise.all([getGoogleSheetsState(), listActiveAutomations(), listAssignees()]);

  if (!state.ok) {
    return (
      <>
        <PageHeader eyebrow="Sources" title="Google Sheets" />
        <DbUnavailable error={state.error} />
      </>
    );
  }
  const { configured, missingEnv, cryptoReady, connections, worksheets } = state.data;
  const editing = edit ? worksheets.find((w) => w.id === edit) : undefined;
  const showWizard = canWrite && (Boolean(wizard) || Boolean(editing) || (worksheets.length === 0 && connections.length > 0));

  return (
    <>
      <Link href="/admin/automation/sources" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> All sources
      </Link>

      <PageHeader
        eyebrow="Sources"
        title="Import leads from Google Sheets"
        description="Link a worksheet with the prospect columns. Rows become leads, duplicates are merged, and the sheet can be kept in sync on a schedule."
        actions={
          canWrite && connections.length > 0 && !showWizard ? (
            <Link href="/admin/automation/sources/google-sheets?import=1" className={btn.primary}>
              <Plus className="h-4 w-4" /> Link a worksheet
            </Link>
          ) : null
        }
      />

      {error && (
        <Callout tone="red" icon={AlertTriangle} title="That did not work" className="mb-6">
          {error}
        </Callout>
      )}
      {connected && (
        <Callout tone="green" icon={CheckCircle2} title={`Connected ${connected}`} className="mb-6">
          Choose the spreadsheet to import from below.
        </Callout>
      )}

      {!configured && (
        <Callout tone="amber" icon={AlertTriangle} title="Google is not configured on this server" className="mb-6">
          <p>
            Set <span className="font-mono text-xs">{missingEnv.join(", ")}</span> in the server&apos;s environment variables. They
            come from an OAuth client of type &quot;Web application&quot; in Google Cloud Console, with this authorised redirect
            URI:
          </p>
          <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs text-slate-800">
            {(process.env.NEXT_PUBLIC_SITE_URL || "https://bitsolmarketing.com").replace(/\/+$/, "")}
            {GOOGLE_CALLBACK_PATH}
          </p>
          <p className="mt-2">
            Nothing is connected until then. Leads can already be imported from a{" "}
            <Link href="/admin/automation/sources/csv" className="font-semibold text-cyan-700 underline">
              CSV export of the sheet
            </Link>
            .
          </p>
        </Callout>
      )}
      {configured && !cryptoReady && (
        <Callout tone="amber" icon={AlertTriangle} title="No encryption key" className="mb-6">
          Set AUTOMATION_SECRET (or ADMIN_SECRET) on the server. Google tokens are only ever stored encrypted.
        </Callout>
      )}

      {showWizard && (
        <Panel className="mb-6" title={editing ? `Settings: ${editing.spreadsheetName} › ${editing.worksheetTitle}` : "Link a worksheet"}>
          <ImportWizard
            source="google_sheets"
            connections={connections.map((c) => ({ id: c.id, googleEmail: c.googleEmail, status: c.status }))}
            googleReady={configured && cryptoReady}
            missingEnv={missingEnv}
            canConnect={canManage}
            automations={automations.ok ? automations.data : []}
            assignees={assignees.ok ? assignees.data.map((u) => ({ id: u.id, name: u.name || u.email })) : []}
            initial={
              editing
                ? {
                    connectionId: editing.connectionId,
                    spreadsheetId: editing.spreadsheetId,
                    spreadsheetName: editing.spreadsheetName,
                    worksheetId: editing.worksheetId,
                    worksheetTitle: editing.worksheetTitle,
                  }
                : undefined
            }
          />
        </Panel>
      )}

      {!showWizard && connections.length === 0 && configured && (
        <Panel className="mb-6">
          <EmptyState
            icon={FileSpreadsheet}
            title="No Google account connected"
            description="You sign in at Google and approve read-only access to your spreadsheets. This site never sees your Google password."
            action={
              canManage ? (
                <a href="/api/admin/google/connect?returnTo=/admin/automation/sources/google-sheets" className={btn.primary}>
                  <FileSpreadsheet className="h-4 w-4" /> Connect Google Sheets
                </a>
              ) : (
                <p className="text-sm text-slate-500">Ask an admin to connect the Google account.</p>
              )
            }
          />
        </Panel>
      )}

      <div className="space-y-6">
        <Panel bodyClassName="p-0" title="Linked worksheets" description="Each one remembers its mapping, its import settings and its schedule.">
          {worksheets.length === 0 ? (
            <EmptyState icon={FileSpreadsheet} title="No worksheet linked yet" description="Link one to import its rows and keep them in sync." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr>
                    <th className={thClass}>Worksheet</th>
                    <th className={thClass}>Sync status</th>
                    <th className={thClass}>Last sync</th>
                    <th className={thClass}>Next sync</th>
                    <th className={`${thClass} text-right`}>Rows</th>
                    <th className={thClass}>Schedule</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {worksheets.map((worksheet) => {
                    const badge = syncBadge(worksheet.syncStatus);
                    const latest = worksheet.imports[0];
                    return (
                      <tr key={worksheet.id} className={trClass}>
                        <td className={tdClass}>
                          <span className="block font-semibold text-slate-900">{worksheet.spreadsheetName}</span>
                          <span className="block text-xs text-slate-500">
                            {worksheet.worksheetTitle} · {worksheet.connection.googleEmail}
                          </span>
                          {worksheet.lastError && <span className="mt-1 block max-w-xs text-xs text-red-600">{worksheet.lastError}</span>}
                        </td>
                        <td className={tdClass}>
                          <Pill tone={badge.tone}>{badge.label}</Pill>
                          {worksheet.connection.status !== "ACTIVE" && <span className="mt-1 block text-xs text-red-600">Reconnect Google</span>}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>
                          {worksheet.lastSyncAt ? (
                            <span title={formatDate(worksheet.lastSyncAt, { time: true })}>{timeAgo(worksheet.lastSyncAt)}</span>
                          ) : (
                            "Never"
                          )}
                          {worksheet.lastSuccessfulSyncAt && worksheet.syncStatus === "ERROR" && (
                            <span className="block text-xs">Last good: {timeAgo(worksheet.lastSuccessfulSyncAt)}</span>
                          )}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>
                          {worksheet.nextSyncAt ? <span title={formatDate(worksheet.nextSyncAt, { time: true })}>{relativeTime(worksheet.nextSyncAt)}</span> : "Manual"}
                        </td>
                        <td className={`${tdClass} text-right text-xs tabular-nums text-slate-500`}>
                          <span className="block text-sm font-semibold text-slate-900">{worksheet.rowsProcessed.toLocaleString()}</span>
                          {worksheet.rowsCreated} new · {worksheet.rowsUpdated} updated
                          <span className="block">
                            {worksheet.rowsSkipped} skipped · {worksheet.rowsFailed} failed
                          </span>
                        </td>
                        <td className={tdClass}>
                          {canWrite ? (
                            <form action={setWorksheetInterval} className="flex items-center gap-1.5">
                              <input type="hidden" name="id" value={worksheet.id} />
                              <select name="minutes" defaultValue={worksheet.syncIntervalMinutes} className={`${selectClass} w-44 py-2`} aria-label="Sync interval">
                                {SYNC_INTERVALS.map((interval) => (
                                  <option key={interval.minutes} value={interval.minutes}>
                                    {interval.label}
                                  </option>
                                ))}
                              </select>
                              <SubmitButton variant="ghost" pendingText="…">
                                Save
                              </SubmitButton>
                            </form>
                          ) : (
                            (SYNC_INTERVALS.find((i) => i.minutes === worksheet.syncIntervalMinutes)?.label ?? "Manual only")
                          )}
                        </td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {canWrite && (
                              <form action={syncWorksheetNow}>
                                <input type="hidden" name="id" value={worksheet.id} />
                                <SubmitButton variant="secondary" pendingText="Queuing…">
                                  <RefreshCw className="h-4 w-4" /> Sync now
                                </SubmitButton>
                              </form>
                            )}
                            {latest && (
                              <Link href={`/admin/automation/imports/${latest.id}`} className={btn.ghost}>
                                Log
                              </Link>
                            )}
                            {canWrite && (
                              <Link href={`/admin/automation/sources/google-sheets?worksheet=${worksheet.id}`} className={btn.ghost} title="Mapping and import settings">
                                <Settings2 className="h-4 w-4" />
                                <span className="sr-only">Settings</span>
                              </Link>
                            )}
                            {canWrite && (
                              <form action={unlinkWorksheet}>
                                <input type="hidden" name="id" value={worksheet.id} />
                                <ConfirmButton variant="ghost" message="Stop syncing this worksheet? The leads it brought in stay in the CRM.">
                                  Unlink
                                </ConfirmButton>
                              </form>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Google accounts" description="Read-only access, granted at Google and stored encrypted.">
          {connections.length === 0 ? (
            <p className="text-sm text-slate-500">None connected.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {connections.map((connection) => (
                <li key={connection.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-slate-900">
                      {connection.googleEmail}
                      <Pill tone={connection.status === "ACTIVE" ? "green" : "red"}>{connection.status === "ACTIVE" ? "Connected" : "Needs reconnecting"}</Pill>
                    </p>
                    <p className="text-xs text-slate-500">
                      Connected by {connection.connectedBy} on {formatDate(connection.createdAt)} · {connection.worksheets} linked worksheet
                      {connection.worksheets === 1 ? "" : "s"}
                    </p>
                    {connection.lastError && <p className="mt-1 text-xs text-red-600">{connection.lastError}</p>}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <a href="/api/admin/google/connect?returnTo=/admin/automation/sources/google-sheets" className={btn.secondary}>
                        Reconnect
                      </a>
                      <form action={disconnectGoogle}>
                        <input type="hidden" name="id" value={connection.id} />
                        <ConfirmButton message={`Disconnect ${connection.googleEmail}? Its ${connection.worksheets} linked worksheet(s) stop syncing. Leads stay in the CRM.`}>
                          Disconnect
                        </ConfirmButton>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && configured && connections.length > 0 && (
            <a href="/api/admin/google/connect?returnTo=/admin/automation/sources/google-sheets" className={`${btn.ghost} mt-3`}>
              <Plus className="h-4 w-4" /> Connect another account
            </a>
          )}
        </Panel>

        <Panel title="What is stored for every row" description="So a lead can always be traced back to its source.">
          <KeyValue
            items={[
              { label: "Lead source", value: "Google Sheets (source_type = google_sheets)" },
              { label: "source_name", value: "The spreadsheet's name" },
              { label: "source_worksheet", value: "The worksheet's name" },
              { label: "source_row", value: "The row number at the time of the import" },
              { label: "source_import_id", value: "The import batch that created the lead" },
              { label: "Stable identifier", value: "A hash of the row's strongest identity (email, LinkedIn, phone, or name and company), so a row that moves is still the same row" },
              { label: "Change detection", value: "A hash of the mapped values; only rows that changed are written again" },
              { label: "Original values", value: "Every cell of the row, exactly as the sheet had it" },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
