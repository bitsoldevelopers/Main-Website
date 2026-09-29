import { requireAdminPage } from "@/lib/admin/auth";
import { getShellStatus } from "@/lib/admin/queries";
import { AdminShell } from "@/components/admin/AdminShell";

// Every screen inside the shell reads live data and the session cookie, so
// nothing here is ever prerendered at build time.
export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();
  const status = await getShellStatus();
  return (
    <AdminShell status={status} identity={{ name: session.name, role: session.role }}>
      {children}
    </AdminShell>
  );
}
