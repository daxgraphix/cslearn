import { adminCourses } from "@/services/admin";
import { PageHeader, Table, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { publishAction, unpublishAction } from "@/app/actions";
export const metadata = { title: "Courses" };
export default async function Courses({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const rows = await adminCourses();
  return (<><PageHeader title="Courses" subtitle="Approved versions wait here for an authorized publisher" /><Flash error={sp.error} />
    <Table head={["Course", "Versions", "Live", "Actions"]}>{(rows as any[]).map((c) => {
      const vs = [...c.course_versions].sort((a: any, b: any) => b.version_number - a.version_number); const approved = vs.find((v: any) => v.status === "approved");
      return (<tr key={c.id}><td className="table-td font-medium">{vs[0]?.title}<p className="text-xs text-ink-faint">/{c.slug}</p></td><td className="table-td"><div className="flex flex-wrap gap-1">{vs.slice(0, 3).map((v: any) => <Badge key={v.version_number} status={v.status}>v{v.version_number} {v.status.replace(/_/g, " ")}</Badge>)}</div></td>
        <td className="table-td">{c.published_version_id && !c.archived_at ? "Yes" : c.archived_at ? "Retired" : "No"}</td>
        <td className="table-td"><div className="flex gap-2">{approved && <form action={publishAction}><input type="hidden" name="versionId" value={vs.find((v: any) => v.status === "approved") && approved.id} /><button className="btn-primary">Publish v{approved.version_number}</button></form>}
          {c.published_version_id && !c.archived_at && <form action={unpublishAction}><input type="hidden" name="courseId" value={c.id} /><button className="btn-danger">Retire</button></form>}</div></td></tr>); })}</Table></>);
}
