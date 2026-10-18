import { listEnrollments } from "@/services/admin";
import { PageHeader, Table, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { bulkEnrollAction } from "@/app/actions";
import { getSessionUser } from "@/lib/auth";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Enrollments" };
export default async function Enrollments({ searchParams }: { searchParams: Promise<{ error?: string; created?: string; dups?: string; errors?: string }> }) {
  const sp = await searchParams; const rows = await listEnrollments(); const me = await getSessionUser();
  return (<><PageHeader title="Enrollments" /><Flash error={sp.error} notice={sp.created ? `Import finished: ${sp.created} created, ${sp.dups} duplicates, ${sp.errors} errors.` : undefined} />
    {me?.permissions.has("enrollment.manage") && <form action={bulkEnrollAction} className="card mb-6 space-y-3 p-5"><h2 className="font-semibold">Bulk enrollment</h2><p className="text-sm text-ink-soft">Paste CSV rows as <code>email,course-slug</code>. Learners must already have an account. Maximum 2000 rows.</p>
      <textarea name="csv" rows={5} className="input font-mono text-xs" placeholder="email,course_slug" required aria-label="CSV" /><button className="btn-primary">Import</button></form>}
    <Table head={["Learner", "Course", "Status", "Source", "Enrolled"]}>{(rows as any[]).map((e) => <tr key={e.id}><td className="table-td">{e.profiles?.full_name}</td><td className="table-td">{e.courses?.slug}</td><td className="table-td"><Badge status={e.status} /></td><td className="table-td">{e.source}</td><td className="table-td">{fmtDate(e.enrolled_at)}</td></tr>)}</Table></>);
}
