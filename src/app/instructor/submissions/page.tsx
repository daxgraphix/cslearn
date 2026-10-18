import Link from "next/link";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Course submissions" };
export default async function Submissions() {
  const u = await requireUser();
  const { data } = await (await createSupabase()).from("course_submissions").select("id, status, created_at, course_versions(title, version_number, status, course_id)").eq("submitted_by", u.id).order("created_at", { ascending: false });
  return (<><PageHeader title="Review submissions" subtitle="Courses you sent for review and their outcome" />
    {(data ?? []).length === 0 ? <Empty title="Nothing submitted yet" /> : <Table head={["Course", "Version", "Review", "Sent", ""]}>{(data as any[]).map((s) => <tr key={s.id}><td className="table-td font-medium">{s.course_versions.title}</td><td className="table-td">v{s.course_versions.version_number}</td><td className="table-td"><Badge status={s.course_versions.status} /></td><td className="table-td">{fmtDate(s.created_at)}</td><td className="table-td text-right"><Link className="btn-outline" href={`/instructor/courses/${s.course_versions.course_id}/builder#feedback`}>Feedback</Link></td></tr>)}</Table>}</>);
}
