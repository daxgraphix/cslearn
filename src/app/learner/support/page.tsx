import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader, Table, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { openTicketAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Support" };
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await requireUser(); const sp = await searchParams;
  const { data } = await (await createSupabase()).from("support_tickets").select("id, subject, category, status, created_at").eq("requester_id", u.id).order("created_at", { ascending: false });
  return (<><PageHeader title="Support" /><Flash error={sp.error} />
    <form action={openTicketAction} className="card mb-6 max-w-xl space-y-4 p-6"><h2 className="font-semibold">Open a ticket</h2>
      <input name="subject" className="input" placeholder="Subject" required aria-label="Subject" />
      <select name="category" className="input" aria-label="Category"><option value="general">General</option><option value="access">Access problem</option><option value="academic">Academic</option><option value="privacy">Privacy</option></select>
      <textarea name="body" rows={4} className="input" placeholder="Describe what happened" required aria-label="Message" /><button className="btn-primary">Send</button></form>
    <Table head={["Subject", "Category", "Status", "Opened"]}>{(data ?? []).map((t) => <tr key={t.id}><td className="table-td">{t.subject}</td><td className="table-td">{t.category}</td><td className="table-td"><Badge status={t.status} /></td><td className="table-td">{fmtDate(t.created_at)}</td></tr>)}</Table></>);
}
