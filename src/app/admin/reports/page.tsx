import { PageHeader, Table } from "@/components/ui";
import { requirePageAccess } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
export const metadata = { title: "Reports" };
export default async function Reports() {
  await requirePageAccess("report.read");
  const { data } = await (await createSupabase()).from("enrollments").select("course_id, status, courses(slug)").limit(5000);
  const by = new Map<string, { slug: string; total: number; done: number }>();
  for (const e of (data ?? []) as any[]) { const r = by.get(e.course_id) ?? { slug: e.courses?.slug, total: 0, done: 0 }; r.total++; if (e.status === "completed") r.done++; by.set(e.course_id, r); }
  return (<><PageHeader title="Reports" actions={<a className="btn-outline" href="/admin/reports/export">Download CSV</a>} />
    <Table head={["Course", "Enrolled", "Completed", "Completion"]}>{[...by.values()].map((r) => <tr key={r.slug}><td className="table-td">{r.slug}</td><td className="table-td">{r.total}</td><td className="table-td">{r.done}</td><td className="table-td">{Math.round((r.done / r.total) * 100)}%</td></tr>)}</Table></>);
}
