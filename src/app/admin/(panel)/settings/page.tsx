import type { Metadata } from "next";
import { CheckCircle2, Database, KeyRound, Server, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { integrationFlags, pingDatabase } from "@/lib/admin/queries";
import { SESSION_MAX_AGE } from "@/lib/admin/session";
import { Callout, KeyValue, PageHeader, Panel, Pill } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Settings" };

/** Host and database name only; the URL also carries the password. */
function describeDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return "not set";
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "set (unparseable)";
  }
}

export default async function SettingsPage() {
  await requireAdminPage("settings.view");
  const [db, flags] = [await pingDatabase(), integrationFlags()];

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description="Runtime status of this deployment. Everything here is configured through environment variables on the server, not through this panel."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4 text-cyan-700" /> Database
            </span>
          }
          description="MySQL via Prisma"
        >
          <div className="mb-4">
            {db.ok ? (
              <Pill tone="green">
                <CheckCircle2 className="h-3 w-3" /> Connected · {db.data.latencyMs} ms
              </Pill>
            ) : (
              <Pill tone="amber">
                <XCircle className="h-3 w-3" /> Unreachable
              </Pill>
            )}
          </div>
          <KeyValue
            items={[
              { label: "Target", value: <span className="font-mono text-xs">{describeDatabaseUrl()}</span> },
              { label: "Pool", value: "connection_limit=1, 30 s connect and pool timeouts (src/lib/prisma.ts)" },
              { label: "Tables", value: "User, Course, Blog, Lead (prisma/schema.prisma)" },
              { label: "Migrations", value: "Applied automatically by npm start on the server" },
              ...(db.ok ? [] : [{ label: "Error", value: <span className="font-mono text-xs text-amber-200/90">{db.error}</span> }]),
            ]}
          />
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-cyan-700" /> Admin session
            </span>
          }
          description="How access to this panel works"
        >
          <KeyValue
            items={[
              { label: "Password", value: "The ADMIN_SECRET environment variable" },
              { label: "Cookie", value: "admin_token, HttpOnly, SameSite=Strict, Secure in production" },
              { label: "Token", value: "An HMAC derived from the secret; the secret itself never leaves the server" },
              { label: "Lifetime", value: `${SESSION_MAX_AGE / 86_400} days, then sign in again` },
              { label: "Rotate", value: "Change ADMIN_SECRET and redeploy; every existing session is signed out" },
              { label: "Checks", value: "Proxy on every /admin request, again in each page, and inside every Server Action" },
            ]}
          />
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-700" /> Environment
            </span>
          }
        >
          <KeyValue
            items={[
              { label: "Mode", value: process.env.NODE_ENV },
              { label: "Node", value: process.version },
              { label: "Site URL", value: process.env.NEXT_PUBLIC_SITE_URL ?? "not set" },
              { label: "Hosting", value: "Hostinger Node app, standalone Next.js build, deployed by GitHub Actions" },
              { label: "Server time", value: new Date().toISOString() },
            ]}
          />
        </Panel>

        <Panel title="Secrets present" description="Values are never shown">
          <ul className="divide-y divide-slate-100">
            {flags.map((flag) => (
              <li key={flag.key} className="flex items-center gap-3 py-2.5 text-sm">
                {flag.configured ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="font-mono text-xs text-slate-900">{flag.key}</span>
                  <span className="block truncate text-xs text-slate-500">{flag.label}</span>
                </span>
                <Pill tone={flag.configured ? "green" : "amber"}>{flag.configured ? "Set" : "Missing"}</Pill>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Callout tone="cyan" className="mt-6" title="Worth doing next">
        Login attempts are not rate limited and there is a single shared password. Before more people use this panel,
        add per-user admin accounts (the User table already has an ADMIN role) and a lockout after repeated failures.
      </Callout>
    </>
  );
}
