import { instructorAnalytics } from "@/services/reporting";
import { PageHeader, Table, Empty } from "@/components/ui";
export const metadata = { title: "Analytics" };
export default async function Analytics() {
  const rows = await instructorAnalytics();
  return (<><PageHeader title="Analytics" subtitle="Learner activity in your published courses" />
    {rows.length === 0 ? <Empty title="No data yet" /> : <Table head={["Course", "Enrolled", "Completed", "Completion", "Avg quiz score"]}>{rows.map((r) => <tr key={r.courseId}><td className="table-td font-medium">{r.title}</td><td className="table-td">{r.enrolled}</td><td className="table-td">{r.completed}</td><td className="table-td">{r.enrolled ? Math.round((r.completed / r.enrolled) * 100) : 0}%</td><td className="table-td">{r.avgScore ?? "-"}{r.avgScore !== null && "%"}</td></tr>)}</Table>}</>);
}
