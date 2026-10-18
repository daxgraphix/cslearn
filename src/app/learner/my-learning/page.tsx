import Link from "next/link";
import { myLearning } from "@/services/learning";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { claimCertificateAction } from "@/app/actions";
export const metadata = { title: "My learning" };
export default async function MyLearning() {
  const items = await myLearning();
  return (<><PageHeader title="My learning" />
    {items.length === 0 ? <Empty title="You have not enrolled in a course yet." href="/courses" cta="Browse courses" /> :
    <Table head={["Course", "Status", "Progress", "Enrolled", ""]}>{items.map((e) => (
      <tr key={e.id}><td className="table-td font-medium">{e.course_versions.title}</td><td className="table-td"><Badge status={e.status} /></td>
        <td className="table-td">{e.progress.pct}%</td><td className="table-td">{fmtDate(e.enrolled_at)}</td>
        <td className="table-td text-right">{e.status === "completed" ? <form action={claimCertificateAction} className="inline"><input type="hidden" name="enrollmentId" value={e.id} /><button className="btn-outline">Get certificate</button></form> : <Link className="btn-primary" href={`/learner/learn/${e.courses.id}`}>Continue</Link>}</td></tr>))}</Table>}</>);
}
