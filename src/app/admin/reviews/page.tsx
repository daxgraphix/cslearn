import { reviewQueue } from "@/services/governance";
import { createAdminSupabase } from "@/lib/supabase/server";
import Link from "next/link";
import { PageHeader, Table, Empty, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { assignReviewerAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
import { SubmitButton } from "@/components/SubmitButton";
export const metadata = { title: "Review assignments" };
export default async function Reviews({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const q = await reviewQueue();
  const admin = createAdminSupabase();
  const { data: ur } = await admin.from("user_roles").select("user_id, roles!inner(key), profiles(full_name)").eq("roles.key", "reviewer");
  return (<><PageHeader title="Course review" subtitle="Open a submission to assess it, or assign it to a reviewer. Approved versions can then be published from Courses." actions={<Link className="btn-outline" href="/admin/courses">Manage courses</Link>} /><Flash error={sp.error} />
    {q.length === 0 ? <Empty title="Review queue is clear" hint="New course submissions will appear here." /> : <Table head={["Course", "Submitted", "Reviewer", "Workflow"]}>{(q as any[]).map((s) => (
      <tr key={s.id}><td className="table-td font-medium">{s.course_versions.title} v{s.course_versions.version_number}<p className="mt-1 text-xs text-ink-faint">{s.note || "No note from the author"}</p></td><td className="table-td">{fmtDate(s.created_at)}</td>
        <td className="table-td"><form action={assignReviewerAction} className="flex min-w-64 gap-2"><input type="hidden" name="submissionId" value={s.id} /><select name="reviewerId" defaultValue={s.assigned_reviewer_id ?? ""} className="input py-1.5" aria-label="Reviewer"><option value="" disabled>Choose reviewer</option>{(ur as any[] ?? []).map((r) => <option key={r.user_id} value={r.user_id}>{r.profiles?.full_name || "Reviewer"}</option>)}</select><SubmitButton className="btn-outline" pendingLabel="Assigning…">Assign</SubmitButton></form></td>
        <td className="table-td"><div className="flex items-center gap-2"><Badge status={s.assigned_reviewer_id ? "in_review" : "pending"}>{s.assigned_reviewer_id ? "Assigned" : "Unassigned"}</Badge><Link className="btn-primary" href={`/reviewer/reviews/${s.id}`}>Review</Link></div></td></tr>))}</Table>}</>);
}
