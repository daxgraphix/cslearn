import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { PageHeader, Table, Empty, Badge } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { claimReviewAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { Flash } from "@/components/Flash";
export const metadata = { title: "Review queue" };
export default async function Queue({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const [q, me] = await Promise.all([reviewQueue(), getSessionUser()]);
  const canReviewAny = me?.permissions.has("course.review.any") ?? false;
  return (<><PageHeader title="Review queue" subtitle="Review your assigned submissions or claim an unassigned course to get started." /><Flash error={sp.error} />{q.length === 0 ? <Empty title="No reviews waiting" hint="New course submissions will appear here when they are ready for review." /> :
    <Table head={["Course", "Version", "Submitted", "Assignment", "Note", "Action"]}>{(q as any[]).map((s) => {
      const assignedToMe = s.assigned_reviewer_id === me?.id;
      const unassigned = !s.assigned_reviewer_id;
      const canOpen = canReviewAny || assignedToMe;
      return <tr key={s.id}><td className="table-td font-medium">{s.course_versions?.title ?? "Course submission"}</td><td className="table-td">v{s.course_versions?.version_number}</td><td className="table-td">{fmtDate(s.created_at)}</td><td className="table-td"><Badge status={unassigned ? "pending" : "in_review"}>{unassigned ? "Unassigned" : assignedToMe ? "Assigned to you" : "Assigned"}</Badge></td><td className="table-td text-ink-soft">{s.note ?? "-"}</td><td className="table-td text-right">{canOpen ? <Link className="btn-primary" href={`/reviewer/reviews/${s.id}`}>Review</Link> : unassigned ? <form action={claimReviewAction}><input type="hidden" name="submissionId" value={s.id} /><SubmitButton className="btn-primary" pendingLabel="Claiming…">Claim review</SubmitButton></form> : <span className="text-sm text-ink-faint">Assigned to another reviewer</span>}</td></tr>;
    })}</Table>}</>);
}
