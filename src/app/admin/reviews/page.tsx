import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { createSupabase } from "@/lib/supabase/server";
import { PageHeader, Table, Empty, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { assignReviewerAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Review assignments" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const q = await reviewQueue();
  const supabase = await createSupabase();
  const { data: userRoles, error: reviewerError } = await supabase.from("user_roles")
    .select("user_id, roles!inner(key, role_permissions(permission_key)), profiles(full_name)");
  if (reviewerError) throw reviewerError;

  const reviewerMap = new Map<string, string>();
  for (const row of (userRoles ?? []) as any[]) {
    if (row.roles?.role_permissions?.some((permission: any) => permission.permission_key === "course.review.assigned")) {
      reviewerMap.set(row.user_id, row.profiles?.full_name || "Reviewer");
    }
  }
  const reviewers = [...reviewerMap.entries()];

  return <>
    <PageHeader title="Course review" subtitle="Assign open submissions, track ownership, and open the full course before deciding. Approved versions still need publishing." actions={<Link className="btn-outline" href="/admin/courses">Manage courses</Link>} />
    <Flash error={sp.error} notice={sp.notice} />
    {q.length === 0 ? <Empty title="Review queue is clear" hint="New course submissions will appear here." /> :
      <Table head={["Course", "Submitted", "Reviewer", "Workflow"]}>
        {(q as any[]).map((submission) => {
          const course = submission.course_versions?.courses;
          const courseTeam = new Set([course?.owner_id, ...(course?.course_instructors ?? []).map((item: any) => item.user_id)]);
          const eligible = reviewers.filter(([userId]) => userId !== submission.submitted_by && !courseTeam.has(userId));
          const assignedReviewerEligible = eligible.some(([userId]) => userId === submission.assigned_reviewer_id);
          return <tr key={submission.id}>
            <td className="table-td font-medium">{submission.course_versions?.title ?? "Course submission"} v{submission.course_versions?.version_number}<p className="mt-1 text-xs text-ink-faint">{submission.note || "No note from the author"}</p></td>
            <td className="table-td">{fmtDate(submission.created_at)}</td>
            <td className="table-td">
              {eligible.length === 0 ? <span className="text-sm text-ink-faint">No eligible reviewers for this course</span> :
                <form action={assignReviewerAction} className="flex min-w-64 gap-2">
                  <input type="hidden" name="submissionId" value={submission.id} />
                  <select name="reviewerId" defaultValue={assignedReviewerEligible ? submission.assigned_reviewer_id : ""} className="input py-1.5" aria-label="Assign or reassign reviewer">
                    <option value="" disabled>Select reviewer</option>
                    {submission.assigned_reviewer_id && !assignedReviewerEligible && <option value={submission.assigned_reviewer_id} disabled>Current assignment unavailable</option>}
                    {eligible.map(([userId, reviewerName]) => <option key={userId} value={userId}>{reviewerName}</option>)}
                  </select>
                  <SubmitButton className="btn-outline" pendingLabel="Saving…">{submission.assigned_reviewer_id ? "Reassign" : "Assign"}</SubmitButton>
                </form>}
            </td>
            <td className="table-td"><div className="flex items-center gap-2"><Badge status={submission.assigned_reviewer_id ? "in_review" : "pending"}>{submission.assigned_reviewer_id ? "Assigned" : "Unassigned"}</Badge><Link className="btn-primary" href={`/reviewer/reviews/${submission.id}`}>Review course</Link></div></td>
          </tr>;
        })}
      </Table>}
  </>;
}
