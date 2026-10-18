import Link from "next/link";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader, Stat, Empty, Badge } from "@/components/ui";
export const metadata = { title: "Instructor dashboard" };
export default async function Dashboard() {
  const u = await requireUser(); const supabase = await createSupabase();
  const { data } = await supabase.from("course_instructors").select("course_id, courses(id, slug, published_version_id, course_versions!course_versions_course_id_fkey(title, status, version_number))").eq("user_id", u.id);
  const courses = (data ?? []) as any[];
  const versions = courses.flatMap((c) => c.courses.course_versions);
  const { count: pending } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return (<><PageHeader title="Instructor dashboard" actions={<Link href="/instructor/courses/new" className="btn-primary">New course</Link>} />
    <div className="grid gap-4 sm:grid-cols-4"><Stat label="Courses" value={courses.length} /><Stat label="Drafts" value={versions.filter((v) => v.status === "draft").length} />
      <Stat label="In review" value={versions.filter((v) => v.status === "in_review").length} /><Stat label="Assignments to grade" value={pending ?? 0} /></div>
    <h2 className="mb-3 mt-8 font-semibold">Needs your attention</h2>
    {versions.filter((v) => v.status === "changes_requested").length === 0 ? <Empty title="No revision requests" hint="When a reviewer asks for changes, the course shows up here." /> :
      <ul className="card divide-y divide-surface-line">{courses.filter((c) => c.courses.course_versions.some((v: any) => v.status === "changes_requested")).map((c) => <li key={c.course_id} className="flex items-center justify-between p-4"><span>{c.courses.course_versions[0].title}</span><span className="flex items-center gap-3"><Badge status="changes_requested" /><Link className="btn-outline" href={`/instructor/courses/${c.course_id}/builder`}>Open</Link></span></li>)}</ul>}</>);
}
