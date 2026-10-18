import Link from "next/link";
import { adminCourses } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { publishAction, unpublishAction } from "@/app/actions";
export const metadata = { title: "Courses" };
export default async function Courses({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [sp, rows, me] = await Promise.all([searchParams, adminCourses(), getSessionUser()]);
  const canReview = me?.permissions.has("course.review.assigned") || me?.permissions.has("course.review.any");
  return (<><PageHeader title="Course publishing" subtitle="Review submissions, publish approved versions, and retire courses that should leave the catalog." actions={<Link href="/admin/reviews" className="btn-outline">Open review queue</Link>} /><Flash error={sp.error} />
    {(rows as any[]).length === 0 ? <Empty title="No courses yet" hint="Courses will appear here after an instructor creates one." /> : <Table head={["Course", "Versions", "Live", "Actions"]}>{(rows as any[]).map((c) => {
      const vs = [...c.course_versions].sort((a: any, b: any) => b.version_number - a.version_number); const approved = vs.find((v: any) => v.status === "approved");
      const inReview = vs.find((v: any) => v.status === "in_review");
      const submission = inReview?.course_submissions?.find((item: any) => item.status !== "closed");
      return (<tr key={c.id}><td className="table-td font-medium">{vs[0]?.title}<p className="text-xs text-ink-faint">/{c.slug}</p></td><td className="table-td"><div className="flex flex-wrap gap-1">{vs.slice(0, 3).map((v: any) => <Badge key={v.version_number} status={v.status}>v{v.version_number} {v.status.replace(/_/g, " ")}</Badge>)}</div></td>
        <td className="table-td">{c.published_version_id && !c.archived_at ? "Yes" : c.archived_at ? "Retired" : "No"}</td>
        <td className="table-td"><div className="flex flex-wrap gap-2">{canReview && submission && <Link href={`/reviewer/reviews/${submission.id}`} className="btn-outline">Review v{inReview.version_number}</Link>}{approved && <form action={publishAction}><input type="hidden" name="versionId" value={approved.id} /><button className="btn-primary">Publish v{approved.version_number}</button></form>}
          {c.published_version_id && !c.archived_at && <form action={unpublishAction}><input type="hidden" name="courseId" value={c.id} /><button className="btn-danger">Retire</button></form>}</div></td></tr>); })}</Table>}</>);
}
