import { orgOverview } from "@/services/organization";
import { currentOrgId } from "@/lib/org-context";
import { PageHeader, Table, Empty } from "@/components/ui";
export const metadata = { title: "Organization report" };
export default async function Reports() {
  const d = await orgOverview(await currentOrgId());
  return (<><PageHeader title="Completion report" subtitle="Only your organization's learners are included" />{d.report.length === 0 ? <Empty title="No assignments yet" /> :
    <Table head={["Cohort", "Course", "Learners", "Completed", "Rate"]}>{d.report.map((r, i) => <tr key={i}><td className="table-td">{r.cohort}</td><td className="table-td">{r.course_title}</td><td className="table-td">{String(r.learners)}</td><td className="table-td">{String(r.completed)}</td><td className="table-td">{Math.round((Number(r.completed) / Number(r.learners)) * 100)}%</td></tr>)}</Table>}</>);
}
