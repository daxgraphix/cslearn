import { reviewQueue } from "@/services/governance";
import { createAdminSupabase } from "@/lib/supabase/server";
import { PageHeader, Table, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { assignReviewerAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Review assignments" };
export default async function Reviews({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const q = await reviewQueue();
  const admin = createAdminSupabase();
  const { data: ur } = await admin.from("user_roles").select("user_id, roles!inner(key), profiles(full_name)").eq("roles.key", "reviewer");
  return (<><PageHeader title="Review assignments" /><Flash error={sp.error} />
    {q.length === 0 ? <Empty title="No open submissions" /> : <Table head={["Course", "Submitted", "Reviewer"]}>{(q as any[]).map((s) => (
      <tr key={s.id}><td className="table-td font-medium">{s.course_versions.title} v{s.course_versions.version_number}</td><td className="table-td">{fmtDate(s.created_at)}</td>
        <td className="table-td"><form action={assignReviewerAction} className="flex gap-2"><input type="hidden" name="submissionId" value={s.id} /><select name="reviewerId" defaultValue={s.assigned_reviewer_id ?? ""} className="input w-56 py-1.5" aria-label="Reviewer"><option value="" disabled>Choose reviewer</option>{(ur as any[] ?? []).map((r) => <option key={r.user_id} value={r.user_id}>{r.profiles?.full_name}</option>)}</select><button className="btn-outline">Assign</button></form></td></tr>))}</Table>}</>);
}
