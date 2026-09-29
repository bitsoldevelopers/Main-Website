import type { Metadata } from "next";
import { Trash2, UserPlus, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { listUsers } from "@/lib/admin/queries";
import { formatDate, initials } from "@/lib/admin/format";
import { deleteUser, updateUserRole } from "@/app/admin/actions";
import { Callout, DbUnavailable, EmptyState, PageHeader, Panel, Pill, selectClass, tdClass, thClass, trClass } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/SubmitButton";
import { UserForm } from "@/components/admin/UserForm";

export const metadata: Metadata = { title: "Users" };

const roleTone = { ADMIN: "cyan", CLIENT: "purple", STUDENT: "slate", EDITOR: "green", MANAGER: "amber" } as const;

export default async function UsersPage() {
  await requireAdminPage("users.manage");
  const result = await listUsers();

  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Users"
        description="Accounts in the User table. Admin, Business Development Manager and Editor accounts can sign in to this panel with their email and password; each role unlocks its own modules."
      />

      <Callout tone="cyan" className="mb-6" title="Roles decide what an account can do here">
        Admin has everything. Business Development Manager gets leads, the pipeline board and campaigns — right for a BDM
        working inquiries. Editor gets blog, testimonials, FAQs, media and SEO. Student and Client accounts cannot open the
        admin; they are ready for the academy or a client portal when one is built.
      </Callout>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {!result.ok ? (
          <DbUnavailable error={result.error} />
        ) : (
          <Panel bodyClassName="p-0" title="Accounts" description={`${result.data.length} ${result.data.length === 1 ? "user" : "users"}`}>
            {result.data.length === 0 ? (
              <EmptyState icon={Users} title="No users yet" description="Create the first account with the form." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr>
                      <th className={thClass}>User</th>
                      <th className={thClass}>Role</th>
                      <th className={thClass}>Courses</th>
                      <th className={thClass}>Joined</th>
                      <th className={`${thClass} text-right`}>
                        <span className="sr-only">Delete</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((user) => (
                      <tr key={user.id} className={trClass}>
                        <td className={tdClass}>
                          <span className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cyan-100 text-xs font-bold text-cyan-700">
                              {initials(user.name || user.email)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-900">{user.name || "—"}</span>
                              <span className="block truncate text-xs text-slate-500">{user.email}</span>
                            </span>
                          </span>
                        </td>
                        <td className={tdClass}>
                          <form action={updateUserRole} className="flex items-center gap-2">
                            <input type="hidden" name="id" value={user.id} />
                            <Pill tone={roleTone[user.role]}>{user.role}</Pill>
                            <select name="role" defaultValue={user.role} className={`${selectClass} w-32 py-1.5 text-xs`} aria-label="Role">
                              <option value="STUDENT">Student</option>
                              <option value="CLIENT">Client</option>
                              <option value="EDITOR">Editor</option>
                              <option value="MANAGER">BD Manager</option>
                              <option value="ADMIN">Admin</option>
                            </select>
                            <SubmitButton variant="secondary" className="px-3 py-1.5 text-xs" pendingText="…">
                              Save
                            </SubmitButton>
                          </form>
                        </td>
                        <td className={`${tdClass} text-slate-500`}>{user._count.courses}</td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(user.createdAt)}</td>
                        <td className={`${tdClass} text-right`}>
                          <form action={deleteUser}>
                            <input type="hidden" name="id" value={user.id} />
                            <ConfirmButton
                              variant="icon"
                              title="Delete"
                              className="hover:bg-red-50 hover:text-red-600"
                              message={`Delete ${user.email}?`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </ConfirmButton>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        <Panel
          title={
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-cyan-700" /> Add user
            </span>
          }
          description="Passwords are hashed before they are stored."
        >
          <UserForm />
        </Panel>
      </div>
    </>
  );
}
