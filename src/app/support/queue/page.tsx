import { agentQueue } from "@/services/support";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { replyTicketAction, escalateAction } from "@/app/actions";
export const metadata = { title: "Support queue" };
export default async function Queue({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const rows = await agentQueue();
  return (<><PageHeader title="Support queue" subtitle="You see the minimum learner information needed. You cannot change grades, issue certificates or grant course access." /><Flash error={sp.error} />
    {rows.length === 0 ? <Empty title="Queue is clear" /> : <Table head={["Subject", "Category", "Status", "Reply", "Escalate"]}>{rows.map((t) => (
      <tr key={t.id}><td className="table-td font-medium">{t.subject}</td><td className="table-td">{t.category}</td><td className="table-td"><Badge status={t.status} /></td>
        <td className="table-td"><form action={replyTicketAction} className="flex gap-2"><input type="hidden" name="ticketId" value={t.id} /><input name="body" className="input py-1.5" required aria-label="Reply" /><label className="flex items-center gap-1 text-xs"><input type="checkbox" name="internal" />Internal</label><button className="btn-outline">Send</button></form></td>
        <td className="table-td"><form action={escalateAction} className="flex gap-2"><input type="hidden" name="ticketId" value={t.id} /><select name="category" className="input w-32 py-1.5" aria-label="Escalate to"><option value="security">Security</option><option value="academic">Academic</option><option value="privacy">Privacy</option></select><button className="btn-ghost">Escalate</button></form></td></tr>))}</Table>}</>);
}
