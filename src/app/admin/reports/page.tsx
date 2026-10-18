import { PageHeader, Table, Empty, Stat } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import Link from "next/link";
export const metadata = { title: "Reports" };

export default async function Reports() {
  await requirePageAccess("report.read");
  const { data } = await (await createSupabase()).from("enrollments").select("course_id, status, courses(slug)").limit(5000);
  const by = new Map<string, { id: string; slug: string; total: number; done: number }>();
  for (const enrollment of (data ?? []) as any[]) {
    const row = by.get(enrollment.course_id) ?? { id: enrollment.course_id, slug: enrollment.courses?.slug, total: 0, done: 0 };
    row.total++;
    if (enrollment.status === "completed") row.done++;
    by.set(enrollment.course_id, row);
  }
  const courses = [...by.values()].sort((a, b) => b.total - a.total);
  const total = courses.reduce((sum, row) => sum + row.total, 0);
  const completed = courses.reduce((sum, row) => sum + row.done, 0);
  const completion = total ? Math.round((completed / total) * 100) : 0;
  const chartCourses = courses.slice(0, 6);
  const largestCourse = Math.max(1, ...chartCourses.map((course) => course.total));

  return <>
    <PageHeader title="Learning reports" subtitle="Enrollment and course completion overview." actions={<a className="btn-outline" href="/admin/reports/export">Download CSV</a>} />
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Stat label="Courses with enrollments" value={courses.length} href="/admin/courses" />
      <Stat label="Enrollments in report" value={total} href="/admin/enrollments" />
      <Stat label="Overall completion" value={total ? `${completion}%` : "—"} href="/admin/enrollments" />
    </div>
    {courses.length === 0 ? <Empty title="No learning activity yet" hint="Course enrollment metrics will appear when learners join published courses." /> : <>
      <section className="card mb-6 p-5 sm:p-6" aria-labelledby="course-activity-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="course-activity-title" className="text-lg font-semibold">Course activity</h2><p className="mt-1 text-sm text-ink-soft">Courses with the most enrollments in this report.</p></div>
          <span className="chip bg-brand-soft text-brand">Top {chartCourses.length} courses</span>
        </div>
        <div className="space-y-5">{chartCourses.map((course) => {
          const rate = Math.round((course.done / course.total) * 100);
          const enrollWidth = Math.max(4, Math.round((course.total / largestCourse) * 100));
          return <div key={course.id} className="grid gap-2 sm:grid-cols-[minmax(9rem,0.8fr)_minmax(0,2fr)_auto] sm:items-center sm:gap-4">
            <Link href={`/courses/${course.slug}`} className="truncate text-sm font-medium text-ink hover:text-brand">{course.slug || "Course unavailable"}</Link>
            <div className="space-y-1.5" role="img" aria-label={`${course.total} enrollments, ${course.done} completed`}>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><div className="h-full rounded-full bg-brand" style={{ width: `${enrollWidth}%` }} /></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true"><div className="h-full rounded-full bg-ok" style={{ width: `${rate}%` }} /></div>
            </div>
            <p className="text-xs tabular-nums text-ink-soft sm:text-right"><span className="font-semibold text-ink">{course.total}</span> enrolled · {rate}% complete</p>
          </div>;
        })}</div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-surface-line pt-4 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-brand" />Enrollments</span>
          <span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-ok" />Completed share</span>
        </div>
      </section>
      <Table head={["Course", "Enrolled", "Completed", "Completion"]}>{courses.map((row) => <tr key={row.id}>
        <td className="table-td font-medium">{row.slug || "Course unavailable"}</td><td className="table-td tabular-nums">{row.total}</td><td className="table-td tabular-nums">{row.done}</td>
        <td className="table-td"><span className="inline-flex min-w-14 items-center justify-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold tabular-nums text-emerald-700">{Math.round((row.done / row.total) * 100)}%</span></td>
      </tr>)}</Table>
    </>}
  </>;
}
