import { myCertificates } from "@/services/certification";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
import { Flash } from "@/components/Flash";
export const metadata = { title: "Certificates" };
export default async function Certificates({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const certs = await myCertificates(); const sp = await searchParams;
  return (<><PageHeader title="Certificates" /><Flash error={sp.error} />
    {certs.length === 0 ? <Empty title="No certificates yet" hint="Finish a course to earn one." href="/learner/my-learning" cta="My learning" /> :
    <Table head={["Course", "Serial", "Issued", "Status", ""]}>{certs.map((c) => (
      <tr key={c.id}><td className="table-td font-medium">{c.course_title}</td><td className="table-td font-mono text-xs">{c.serial}</td><td className="table-td">{fmtDate(c.issued_at)}</td><td className="table-td"><Badge status={c.status} /></td>
        <td className="table-td text-right"><a className="btn-outline" href={`/verify/${c.serial}`}>Public page</a> {c.pdf_path && c.status === "valid" && <a className="btn-primary" href={`/learner/certificates/${c.id}/pdf`}>Download PDF</a>}</td></tr>))}</Table>}</>);
}
