import Link from "next/link";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "My courses" };
export default async function Courses() {
  const u = await requireUser();
  const { data } = await (await createSupabase()).from("course_instructors").select("course_id, courses(id, slug, created_at, course_versions!course_versions_course_id_fkey(title, status, version_number, updated_at))").eq("user_id", u.id);
  const rows = ((data ?? []) as any[]).map((r) => { const vs = [...r.courses.course_versions].sort((a: any, b: any) => b.version_number - a.version_number); return { id: r.course_id, slug: r.courses.slug, latest: vs[0] }; });
  const canCreate = u.permissions.has("course.create") && (u.permissions.has("course.update.own") || u.permissions.has("course.update.any"));
  return (<><PageHeader title="My courses" subtitle="Draft, build, and track courses you own or support." actions={canCreate ? <Link href="/instructor/courses/new" className="btn-primary">New course</Link> : undefined} />
    {rows.length === 0 ? <Empty title="You have no courses yet" hint={canCreate ? "Create a draft, build modules and lessons, then submit it for review." : "Courses assigned to you will appear here."} href={canCreate ? "/instructor/courses/new" : undefined} cta="Create your first course" /> :
    <Table head={["Course", "Version", "Status", "Updated", ""]}>{rows.map((r) => <tr key={r.id}><td className="table-td font-medium">{r.latest.title}</td><td className="table-td">v{r.latest.version_number}</td><td className="table-td"><Badge status={r.latest.status} /></td><td className="table-td">{fmtDate(r.latest.updated_at)}</td><td className="table-td text-right"><Link className="btn-outline" href={`/instructor/courses/${r.id}/builder`}>Open studio</Link></td></tr>)}</Table>}</>);
}
