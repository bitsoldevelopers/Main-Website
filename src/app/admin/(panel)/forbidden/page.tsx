import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { ROLE_LABELS } from "@/lib/admin/rbac";
import { btn, EmptyState, Panel } from "@/components/admin/ui";

export const metadata: Metadata = { title: "403 — No access" };

export default async function ForbiddenPage() {
  const session = await requireAdminPage();
  return (
    <div className="mx-auto max-w-xl pt-10">
      <Panel bodyClassName="p-0">
        <EmptyState
          icon={ShieldX}
          title="You don't have access to that module"
          description={
            <>
              You are signed in as <span className="font-semibold text-slate-900">{session.name}</span> —{" "}
              {ROLE_LABELS[session.role]}. Ask an administrator to change your role if you need this area.
            </>
          }
          action={
            <Link href="/admin" className={btn.secondary}>
              Back to the dashboard
            </Link>
          }
        />
      </Panel>
    </div>
  );
}
