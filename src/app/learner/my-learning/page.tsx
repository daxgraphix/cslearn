import Link from "next/link";
import { myLearning } from "@/services/learning";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { claimCertificateAction } from "@/app/actions";
export const metadata = { title: "My learning" };
export default async function MyLearning({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [allItems, params] = await Promise.all([myLearning(), searchParams]);
  const completedOnly = params.status === "completed";
  const items = completedOnly ? allItems.filter((item) => item.status === "completed") : allItems;
  return (<><PageHeader title="My learning" />
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter learning courses">
      {[{ label: "All courses", href: "/learner/my-learning", selected: !completedOnly }, { label: "Completed", href: "/learner/my-learning?status=completed", selected: completedOnly }].map((filter) => <Link key={filter.href} href={filter.href} aria-current={filter.selected ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${filter.selected ? "border-brand bg-brand-soft text-brand" : "border-surface-line text-ink-soft hover:bg-surface-muted"}`}>{filter.label}<span className="ml-2 tabular-nums">{filter.label === "Completed" ? allItems.filter((item) => item.status === "completed").length : allItems.length}</span></Link>)}
    </nav>
    {items.length === 0 ? <Empty title={completedOnly ? "No completed courses yet" : "You have not enrolled in a course yet."} hint={completedOnly ? "Finish an active course to see it here." : undefined} href={completedOnly ? "/learner/my-learning" : "/courses"} cta={completedOnly ? "View all courses" : "Browse courses"} /> :
    <Table head={["Course", "Status", "Progress", "Enrolled", ""]}>{items.map((e) => (
      <tr key={e.id}><td className="table-td font-medium">{e.course_versions.title}</td><td className="table-td"><Badge status={e.status} /></td>
        <td className="table-td">{e.progress.pct}%</td><td className="table-td">{fmtDate(e.enrolled_at)}</td>
        <td className="table-td text-right">{e.status === "completed" ? <form action={claimCertificateAction} className="inline"><input type="hidden" name="enrollmentId" value={e.id} /><button className="btn-outline">Get certificate</button></form> : <Link className="btn-primary" href={`/learner/learn/${e.courses.id}`}>Continue</Link>}</td></tr>))}</Table>}</>);
}
