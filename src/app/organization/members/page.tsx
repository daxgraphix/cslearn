import { orgOverview } from "@/services/organization";
import { currentOrgId } from "@/lib/org-context";
import { PageHeader, Table } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { addMemberAction } from "@/app/actions";
export const metadata = { title: "Members" };
export default async function Members({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const orgId = await currentOrgId(); const d = await orgOverview(orgId);
  return (<><PageHeader title="Members" /><Flash error={sp.error} />
    <form action={addMemberAction} className="card mb-6 flex max-w-2xl flex-wrap gap-2 p-4"><input type="hidden" name="orgId" value={orgId} /><input name="email" type="email" required className="input flex-1" placeholder="Learner's account email" aria-label="Email" />
      <select name="cohortId" className="input w-48" aria-label="Cohort"><option value="">No cohort</option>{d.cohorts.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn-primary">Add member</button></form>
    <Table head={["Name", "Type", "Status"]}>{(d.members as any[]).map((m) => <tr key={m.user_id}><td className="table-td">{m.profiles?.full_name}</td><td className="table-td">{m.member_type}</td><td className="table-td">{m.status}</td></tr>)}</Table></>);
}
