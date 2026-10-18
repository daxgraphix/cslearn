import { certificates } from "@/services/admin";
import { PageHeader, Table, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { revokeCertAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Certificates" };
export default async function Certs({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const rows = await certificates();
  return (<><PageHeader title="Certificates" subtitle="Revoking keeps the original record and adds an auditable event" /><Flash error={sp.error} />
    <Table head={["Serial", "Learner", "Course", "Issued", "Status", ""]}>{rows.map((c) => (
      <tr key={c.id}><td className="table-td font-mono text-xs">{c.serial}</td><td className="table-td">{c.learner_name}</td><td className="table-td">{c.course_title}</td><td className="table-td">{fmtDate(c.issued_at)}</td><td className="table-td"><Badge status={c.status} /></td>
        <td className="table-td">{c.status === "valid" && <form action={revokeCertAction} className="flex gap-2"><input type="hidden" name="certificateId" value={c.id} /><input name="reason" required minLength={5} className="input py-1.5" placeholder="Reason" aria-label="Reason" /><button className="btn-danger">Revoke</button></form>}</td></tr>))}</Table></>);
}
