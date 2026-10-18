import Link from "next/link";
import { listUsers, roleCatalog } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { PageHeader, Table, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { suspendAction, reinstateAction, roleAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Users" };
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  const sp = await searchParams; const me = await getSessionUser();
  const { users, total } = await listUsers(sp.q);
  const canAssign = me?.permissions.has("role.assign");
  const roleData = canAssign ? await roleCatalog() : null;
  const assignableRoles = roleData?.roles.filter((role) => !role.is_privileged || roleData.canAssignPrivileged) ?? [];
  return (<><PageHeader title="Users" subtitle={`${total} accounts`} actions={canAssign ? <Link href="/admin/roles" className="btn-primary">Manage roles</Link> : undefined} /><Flash error={sp.error} />
    <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={sp.q} className="input max-w-xs" placeholder="Search by name" aria-label="Search users" /><button className="btn-outline">Search</button></form>
    {canAssign && <div className="mb-5 border-l-2 border-brand bg-brand-soft/50 px-4 py-3 text-sm text-ink-soft">
      <p><strong className="text-ink">Assign the smallest role needed.</strong> Roles grant permission bundles; changes are recorded in the audit log.</p>
      <p className="mt-1 text-xs">Platform administrators cannot assign privileged roles. Organization managers must be added from the organization members workflow.</p>
    </div>}
    <Table head={["Name", "Roles", "Status", "Joined", "Actions"]}>{(users as any[]).map((u) => (
      <tr key={u.id}><td className="table-td font-medium">{u.full_name || "(no name)"}</td>
        <td className="table-td"><div className="flex flex-wrap gap-1">{u.user_roles.length ? u.user_roles.map((r: any) => <Badge key={r.roles.key} status={r.roles.key}>{r.roles.name}</Badge>) : <span className="text-sm text-ink-faint">Learner</span>}</div></td><td className="table-td"><Badge status={u.status} /></td><td className="table-td">{fmtDate(u.created_at)}</td>
        <td className="table-td"><div className="flex flex-wrap gap-2">
          {u.status === "active" ? <details><summary className="btn-danger cursor-pointer list-none">Suspend</summary><form action={suspendAction} className="mt-2 flex gap-2"><input type="hidden" name="userId" value={u.id} /><input name="reason" className="input" placeholder="Reason (recorded)" required minLength={5} aria-label="Reason" /><button className="btn-primary">Confirm</button></form></details>
            : <form action={reinstateAction}><input type="hidden" name="userId" value={u.id} /><button className="btn-outline">Reinstate</button></form>}
          {canAssign && <details className="basis-full">
            <summary className="cursor-pointer text-sm font-medium text-brand hover:underline">Manage roles</summary>
            <div className="mt-3 max-w-xl rounded-lg border border-surface-line bg-surface-muted/60 p-4">
              <form action={roleAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <div className="min-w-56 flex-1"><label className="label" htmlFor={`role-${u.id}`}>Platform role</label>
                  <select id={`role-${u.id}`} name="role" className="input" defaultValue={assignableRoles[0]?.key}>
                    {assignableRoles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
                  </select>
                </div>
                <button name="mode" value="grant" className="btn-primary">Grant role</button>
                <button name="mode" value="revoke" className="btn-outline">Remove role</button>
              </form>
              <ul className="mt-3 grid gap-1 text-xs text-ink-soft sm:grid-cols-2">
                {assignableRoles.map((role) => <li key={role.key}><span className="font-medium text-ink">{role.name}</span> · {role.description || role.scope}{role.is_privileged && <span className="ml-1 text-danger">Privileged</span>}</li>)}
              </ul>
            </div>
          </details>}
        </div></td></tr>))}</Table></>);
}
