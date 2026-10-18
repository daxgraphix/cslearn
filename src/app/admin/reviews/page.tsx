import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { createAdminSupabase } from "@/lib/supabase/server";
import { PageHeader, Table, Empty, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { assignReviewerAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Review assignments" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  const q = await reviewQueue();
  const reviewerMap = new Map<string, string>();
  if (q.length) {
    try {
      // The queue is already permission-checked by reviewQueue(). Build the
      // optional assignment list from flat reads so a PostgREST embed/RLS
      // relationship failure cannot take down the review page.
      const supabase = createAdminSupabase();
      const { data: roles, error: rolesError } = await supabase.from("roles")
        .select("id, role_permissions!inner(permission_key)")
        .eq("role_permissions.permission_key", "course.review.assigned");
      if (rolesError) throw rolesError;
      const roleIds = (roles ?? []).map((role: { id: string }) => role.id);
      if (roleIds.length) {
        const { data: assignments, error: assignmentsError } = await supabase.from("user_roles")
          .select("user_id").in("role_id", roleIds);
        if (assignmentsError) throw assignmentsError;
        const userIds = [...new Set((assignments ?? []).map((assignment: { user_id: string }) => assignment.user_id))];
        if (userIds.length) {
          const { data: profiles, error: profilesError } = await supabase.from("profiles")
            .select("id, full_name").in("id", userIds);
          if (profilesError) throw profilesError;
          for (const profile of profiles ?? []) reviewerMap.set(profile.id, profile.full_name || "Reviewer");
        }
      }
    } catch (error) {
      console.error("[admin:reviewer-directory]", error);
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
