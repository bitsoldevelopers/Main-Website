import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, GraduationCap, Pencil, Trash2, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { getCourse, listCourses, paramFrom } from "@/lib/admin/queries";
import { formatDate, truncate } from "@/lib/admin/format";
import { deleteCourse } from "@/app/admin/actions";
import { Callout, DbUnavailable, EmptyState, PageHeader, Panel, btn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/CourseForm";
import { ConfirmButton } from "@/components/admin/SubmitButton";

export const metadata: Metadata = { title: "Courses" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPage("content.write");
  const editId = paramFrom((await searchParams).edit);
  const [list, editing] = await Promise.all([listCourses(), editId ? getCourse(editId) : Promise.resolve(null)]);
  const editingCourse = editing && editing.ok ? editing.data : null;

  return (
    <>
      <PageHeader
        eyebrow="Content"
        title="Courses"
        description="The BITSOL Academy catalogue stored in the Course table, with student enrolments from the User table."
      />

      <Callout tone="amber" icon={AlertTriangle} className="mb-6" title="The public Academy page is not wired to this table yet">
        /courses currently renders three courses hardcoded in app/(site)/courses/CoursesClient.tsx (Digital Marketing
        Mastery, Complete AI Mastery, PSX Trading Course). Rows saved here are stored and ready, but they only show on the
        site once that page reads from the database.
      </Callout>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {!list.ok ? (
          <DbUnavailable error={list.error} />
        ) : (
          <Panel bodyClassName="p-0" title="Catalogue" description={`${list.data.length} ${list.data.length === 1 ? "course" : "courses"}`}>
            {list.data.length === 0 ? (
              <EmptyState icon={GraduationCap} title="No courses in the database" description="Add the first one with the form." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Course</th>
                      <th className={thClass}>Price</th>
                      <th className={thClass}>Students</th>
                      <th className={thClass}>Added</th>
                      <th className={`${thClass} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.map((course) => (
                      <tr key={course.id} className={trClass}>
                        <td className={`${tdClass} max-w-sm`}>
                          <span className="block font-semibold text-slate-900">{course.title}</span>
                          <span className="block text-xs text-slate-500">{truncate(course.description, 110)}</span>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap font-semibold text-slate-900`}>${course.price.toLocaleString()}</td>
                        <td className={`${tdClass} text-slate-500`}>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" /> {course._count.students}
                          </span>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>{formatDate(course.createdAt)}</td>
                        <td className={`${tdClass} text-right`}>
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/admin/courses?edit=${course.id}`} title="Edit" className={btn.icon}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                            <form action={deleteCourse}>
                              <input type="hidden" name="id" value={course.id} />
                              <ConfirmButton
                                variant="icon"
                                title="Delete"
                                className="hover:bg-red-50 hover:text-red-600"
                                message={`Delete "${course.title}"? Enrolments for it will be removed too.`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </ConfirmButton>
                            </form>
                          </div>
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
          title={editingCourse ? "Edit course" : "Add course"}
          description={editingCourse ? editingCourse.title : "Creates a row in the Course table."}
        >
          <CourseForm
            key={editingCourse?.id ?? "new"}
            initial={
              editingCourse
                ? {
                    id: editingCourse.id,
                    title: editingCourse.title,
                    description: editingCourse.description,
                    price: editingCourse.price,
                    image: editingCourse.image,
                  }
                : undefined
            }
          />
        </Panel>
      </div>
    </>
  );
}
