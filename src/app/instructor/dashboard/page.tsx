import Link from "next/link";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader, Stat, Empty, Badge } from "@/components/ui";
export const metadata = { title: "Instructor dashboard" };
export default async function Dashboard() {
  const u = await requireUser(); const supabase = await createSupabase();
  const { data } = await supabase.from("course_instructors").select("course_id, courses(id, slug, published_version_id, course_versions!course_versions_course_id_fkey(title, status, version_number))").eq("user_id", u.id);
  const courses = (data ?? []) as any[];
  const canCreate = u.permissions.has("course.create") && (u.permissions.has("course.update.own") || u.permissions.has("course.update.any"));
  const versions = courses.flatMap((c) => c.courses.course_versions);
  const { count: pending } = await supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", "submitted");
  return (<><PageHeader title="Instructor dashboard" subtitle="Track course readiness, learner activity, and grading work." actions={<div className="flex gap-2"><Link href="/instructor/courses" className="btn-outline">My courses</Link>{canCreate && <Link href="/instructor/courses/new" className="btn-primary">New course</Link>}</div>} />
    <div className="grid gap-4 sm:grid-cols-4"><Stat label="Courses" value={courses.length} href="/instructor/courses" /><Stat label="Drafts" value={versions.filter((v) => v.status === "draft").length} href="/instructor/courses" />
      <Stat label="In review" value={versions.filter((v) => v.status === "in_review").length} href="/instructor/courses" /><Stat label="Assignments to grade" value={pending ?? 0} href="/instructor/assignments" /></div>
    {courses.length === 0 ? <div className="mt-8"><Empty title={canCreate ? "Start with your first course" : "No courses assigned"} hint={canCreate ? "Create a course, add practical lessons, and submit it for an independent review." : "Courses assigned to you will appear here when they are available."} href={canCreate ? "/instructor/courses/new" : undefined} cta="Create a course" /></div> : <>
      <h2 className="mb-3 mt-8 font-semibold">Needs your attention</h2>
      {versions.filter((v) => v.status === "changes_requested").length === 0 ? <Empty title="No revision requests" hint="When a reviewer asks for changes, the course shows up here." /> :
        <ul className="card divide-y divide-surface-line">{courses.filter((c) => c.courses.course_versions.some((v: any) => v.status === "changes_requested")).map((c) => <li key={c.course_id}><Link href={`/instructor/courses/${c.course_id}/builder`} className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-brand-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand"><span className="font-medium">{c.courses.course_versions[0].title}</span><span className="flex shrink-0 items-center gap-3"><Badge status="changes_requested" /><span className="btn-outline">Open</span></span></Link></li>)}</ul>}
    </>}</>);
}
