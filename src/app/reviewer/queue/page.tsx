import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { PageHeader, Table, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Review queue" };
export default async function Queue() {
  const q = await reviewQueue();
  return (<><PageHeader title="Review queue" />{q.length === 0 ? <Empty title="No reviews waiting" /> :
    <Table head={["Course", "Version", "Submitted", "Note", ""]}>{(q as any[]).map((s) => <tr key={s.id}><td className="table-td font-medium">{s.course_versions.title}</td><td className="table-td">v{s.course_versions.version_number}</td><td className="table-td">{fmtDate(s.created_at)}</td><td className="table-td text-ink-soft">{s.note ?? "-"}</td><td className="table-td text-right"><Link className="btn-primary" href={`/reviewer/reviews/${s.id}`}>Review</Link></td></tr>)}</Table>}</>);
}
