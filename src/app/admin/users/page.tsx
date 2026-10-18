import Link from "next/link";
import { listUsers, roleCatalog } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { suspendAction, reinstateAction, roleAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
import { SubmitButton } from "@/components/SubmitButton";
export const metadata = { title: "Users" };
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; error?: string; notice?: string }> }) {
  const sp = await searchParams; const me = await getSessionUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const { users, total } = await listUsers(sp.q, page);
  const pages = Math.max(1, Math.ceil(total / 25));
  const canAssign = me?.permissions.has("role.assign");
  const roleData = canAssign ? await roleCatalog() : null;
  const assignableRoles = roleData?.roles.filter((role) => !role.is_privileged || roleData.canAssignPrivileged) ?? [];
  return (<><PageHeader title="Users" subtitle="Manage account status and assign people the access they need." actions={canAssign ? <Link href="/admin/roles" className="btn-primary">Manage roles</Link> : undefined} /><Flash error={sp.error} notice={sp.notice} />
    <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={sp.q} className="input max-w-xs" placeholder="Search by name" aria-label="Search users" /><button className="btn-outline">Search</button></form>
    {canAssign && <div className="mb-5 border-l-2 border-brand bg-brand-soft/50 px-4 py-3 text-sm text-ink-soft">
      <p><strong className="text-ink">Give each person only the access needed for their work.</strong> A role adds a set of permissions to that account.</p>
      <p className="mt-1 text-xs">Removing one role may not remove access granted by another role. Privileged access is owner-managed. Add organization managers from the organization members workflow.</p>
    </div>}
    {users.length === 0 ? <Empty title={sp.q ? "No users match that search" : "No users found"} hint={sp.q ? "Try a different name or clear the search." : "Accounts will appear here after people sign up."} href={sp.q ? "/admin/users" : undefined} cta="Clear search" /> : <Table head={["Name", "Roles", "Status", "Joined", "Actions"]}>{(users as any[]).map((u) => (
      <tr key={u.id}><td className="table-td font-medium">{u.full_name || "(no name)"}</td>
        <td className="table-td"><div className="flex flex-wrap gap-1">{u.user_roles.length ? u.user_roles.map((r: any) => <Badge key={r.roles.key} status={r.roles.key}>{r.roles.name}</Badge>) : <span className="text-sm text-ink-faint">Learner</span>}</div></td><td className="table-td"><Badge status={u.status} /></td><td className="table-td">{fmtDate(u.created_at)}</td>
        <td className="table-td"><div className="flex flex-wrap gap-2">
          {u.status === "active" ? <details><summary className="btn-danger cursor-pointer list-none">Suspend</summary><form action={suspendAction} className="mt-2 flex gap-2"><input type="hidden" name="userId" value={u.id} /><input name="reason" className="input" placeholder="Reason (recorded)" required minLength={5} aria-label="Reason" /><SubmitButton className="btn-primary" pendingLabel="Suspending…">Confirm</SubmitButton></form></details>
            : <form action={reinstateAction}><input type="hidden" name="userId" value={u.id} /><SubmitButton className="btn-outline" pendingLabel="Restoring…">Reinstate</SubmitButton></form>}
          {canAssign && <details className="basis-full">
            <summary className="cursor-pointer text-sm font-medium text-brand hover:underline">Adjust access · {u.user_roles.length} {u.user_roles.length === 1 ? "role" : "roles"}</summary>
            <div className="mt-3 max-w-xl rounded-lg border border-surface-line bg-surface-muted/60 p-4">
              <p className="mb-2 text-xs text-ink-soft">Grant or remove one role at a time. Current access can come from multiple roles.</p>
              {assignableRoles.length === 0 && <p className="rounded-lg bg-white p-3 text-sm text-ink-soft">There are no roles available for your account to assign.</p>}
              <ul className="divide-y divide-surface-line">
                {assignableRoles.map((role) => {
                  const assigned = u.user_roles.some((item: any) => item.roles.key === role.key);
                  return <li key={role.key} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-medium text-ink">{role.name}</span><Badge status={assigned ? "active" : "pending"}>{assigned ? "Assigned" : "Not assigned"}</Badge>{role.is_privileged && <span className="text-xs font-medium text-danger">Privileged</span>}</div><p className="mt-1 text-xs leading-5 text-ink-soft">{role.description || role.scope}</p></div>
                    {assigned ? <details className="shrink-0"><summary className="btn-outline cursor-pointer list-none">Remove role</summary><form action={roleAction} className="mt-2 min-w-48 rounded-lg border border-surface-line bg-white p-3"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="role" value={role.key} /><input type="hidden" name="mode" value="revoke" /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><p className="mb-2 text-xs text-ink-soft">Remove {role.name} from this account?</p><SubmitButton className="btn-danger w-full" pendingLabel="Removing…">Confirm removal</SubmitButton></form></details>
                      : <form action={roleAction} className="shrink-0"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="role" value={role.key} /><input type="hidden" name="mode" value="grant" /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><SubmitButton className="btn-primary" pendingLabel="Granting…">Grant role</SubmitButton></form>}
                  </li>;
                })}
              </ul>
            </div>
          </details>}
        </div></td></tr>))}</Table>}
    {pages > 1 && <nav className="mt-4 flex items-center justify-between gap-3" aria-label="User pages">
      <span className="text-sm text-ink-soft">Page {page} of {pages} · {total} accounts</span>
      <div className="flex gap-2">{page > 1 && <Link className="btn-outline" href={`/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`}>Previous</Link>}{page < pages && <Link className="btn-outline" href={`/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`}>Next</Link>}</div>
    </nav>}
  </>);
}
