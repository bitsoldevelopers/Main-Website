import { FlaskConical } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin/auth";
import { safe } from "@/lib/admin/queries";
import { hasPermission } from "@/lib/admin/rbac";
import { isTestMode } from "@/lib/automation/email/provider";
import { AutomationTabs, type SectionTab } from "@/components/admin/automation/AutomationTabs";
import { Callout } from "@/components/admin/ui";

/**
 * Shell of the automation area: the section tabs and, while it is on, the
 * test-mode banner. Each page below still checks its own permission.
 */
export default async function AutomationLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminPage();
  const outreach = hasPermission(session.role, "outreach.read");

  const counts = outreach
    ? await safe(async () => {
        const [tasks, failed] = await Promise.all([
          prisma.task.count({ where: { status: "OPEN" } }),
          prisma.automationJob.count({ where: { status: "FAILED" } }),
        ]);
        return { tasks, failed };
      })
    : null;
  const count = counts?.ok ? counts.data : { tasks: 0, failed: 0 };

  const tabs: SectionTab[] = [
    ...(outreach
      ? [
          { label: "Overview", href: "/admin/automation" },
          { label: "Sources", href: "/admin/automation/sources" },
          { label: "Imports", href: "/admin/automation/imports" },
          { label: "Automations", href: "/admin/automation/automations" },
          { label: "Sequences", href: "/admin/automation/sequences" },
          { label: "Templates", href: "/admin/automation/templates" },
          { label: "Follow-ups", href: "/admin/automation/followups", count: count.tasks },
          { label: "Logs", href: "/admin/automation/logs", count: count.failed },
          { label: "Settings", href: "/admin/automation/settings" },
        ]
      : []),
    ...(hasPermission(session.role, "automation.view") ? [{ label: "Content pipeline", href: "/admin/automation/content" }] : []),
  ];

  return (
    <>
      {tabs.length > 1 && <AutomationTabs tabs={tabs} />}
      {outreach && isTestMode() && (
        <Callout tone="amber" icon={FlaskConical} title="Test mode is on" className="mb-6">
          OUTREACH_EMAIL_MODE=test: automations run and every email is recorded, but nothing is delivered to anyone.
          Remove the variable on the server to send for real.
        </Callout>
      )}
      {children}
    </>
  );
}
