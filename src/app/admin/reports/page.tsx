import { PageHeader, Table, Empty, Stat } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
export const metadata = { title: "Reports" };
export default async function Reports() {
  await requirePageAccess("report.read");
  const { data } = await (await createSupabase()).from("enrollments").select("course_id, status, courses(slug)").limit(5000);
  const by = new Map<string, { slug: string; total: number; done: number }>();
  for (const e of (data ?? []) as any[]) { const r = by.get(e.course_id) ?? { slug: e.courses?.slug, total: 0, done: 0 }; r.total++; if (e.status === "completed") r.done++; by.set(e.course_id, r); }
  const courses = [...by.values()]; const total = courses.reduce((sum, r) => sum + r.total, 0); const completed = courses.reduce((sum, r) => sum + r.done, 0);
  return (<><PageHeader title="Learning reports" subtitle="Enrollment and course completion overview." actions={<a className="btn-outline" href="/admin/reports/export">Download CSV</a>} />
    <div className="mb-6 grid gap-3 sm:grid-cols-3"><Stat label="Courses with enrollments" value={courses.length} href="/admin/courses" /><Stat label="Enrollments in report" value={total} href="/admin/enrollments" /><Stat label="Overall completion" value={total ? `${Math.round((completed / total) * 100)}%` : "—"} href="/admin/enrollments" /></div>
    {courses.length === 0 ? <Empty title="No learning activity yet" hint="Course enrollment metrics will appear when learners join published courses." /> : <Table head={["Course", "Enrolled", "Completed", "Completion"]}>{courses.map((r) => <tr key={r.slug}><td className="table-td">{r.slug || "Course unavailable"}</td><td className="table-td">{r.total}</td><td className="table-td">{r.done}</td><td className="table-td">{Math.round((r.done / r.total) * 100)}%</td></tr>)}</Table>}</>);
}
