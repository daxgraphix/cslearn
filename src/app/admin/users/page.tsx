import Link from "next/link";
import { listUsers, roleCatalog } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { suspendAction, reinstateAction, roleAction, inviteUserAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
import { SubmitButton } from "@/components/SubmitButton";
import { redirect } from "next/navigation";
export const metadata = { title: "Users" };
export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; error?: string; notice?: string }> }) {
  const sp = await searchParams; const me = await getSessionUser();
  const page = Math.max(1, Number(sp.page) || 1);
  const { users, total, rolesAvailable } = await listUsers(sp.q, page);
  const pages = Math.max(1, Math.ceil(total / 25));
  if (total > 0 && page > pages) {
    const query = new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(pages) });
    redirect(`/admin/users?${query}`);
  }
  const canAssign = me?.permissions.has("role.assign");
  let roleData: Awaited<ReturnType<typeof roleCatalog>> | null = null;
  if (canAssign) {
    try {
      roleData = await roleCatalog();
    } catch (error) {
      // Role controls are optional to viewing the user directory. Keep the
      // page useful if role metadata is temporarily unavailable.
      console.error("[admin:users-role-catalog]", error);
    }
  }
  const canAssignPrivileged = roleData?.canAssignPrivileged ?? false;
  const assignableRoles = roleData?.roles.filter((role) => !role.is_privileged || canAssignPrivileged) ?? [];
  return (<><PageHeader title="Users" subtitle="Manage account status and assign people the access they need." actions={canAssign ? <Link href="/admin/roles" className="btn-primary">Manage roles</Link> : undefined} /><Flash error={sp.error} notice={sp.notice} />
    <form className="mb-4 flex gap-2" role="search"><input name="q" defaultValue={sp.q} className="input max-w-xs" placeholder="Search by name" aria-label="Search users" /><button className="btn-outline">Search</button></form>
    {canAssign && roleData && <section className="card mb-5 border border-surface-line p-4 sm:p-5" aria-labelledby="invite-user-heading">
      <h2 id="invite-user-heading" className="font-semibold text-ink">Add a user</h2>
      <p className="mt-1 text-sm text-ink-soft">Send an invitation email and choose their starting role. They set their password from the invitation link.</p>
      {assignableRoles.length ? <form action={inviteUserAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="label">Full name<input name="fullName" className="input mt-1" required minLength={2} maxLength={120} autoComplete="name" /></label>
        <label className="label">Email<input name="email" type="email" className="input mt-1" required autoComplete="email" /></label>
        <label className="label">Starting role<select name="roleKey" className="input mt-1" required defaultValue={assignableRoles.find((role) => role.key === "learner")?.key ?? assignableRoles[0].key}>{assignableRoles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}</select></label>
        <SubmitButton className="btn-primary" pendingLabel="Sending invitation…">Invite user</SubmitButton>
      </form> : <p className="mt-3 text-sm text-ink-soft">Create an assignable role first, or ask an owner to grant role assignment access.</p>}
    </section>}
    {canAssign && roleData && <div className="mb-5 border-l-2 border-brand bg-brand-soft/50 px-4 py-3 text-sm text-ink-soft">
      <p><strong className="text-ink">Give each person only the access needed for their work.</strong> A role adds a set of permissions to that account.</p>
      <p className="mt-1 text-xs">Removing one role may not remove access granted by another role. Privileged access is owner-managed. Add organization managers from the organization members workflow.</p>
    </div>}
    {users.length === 0 ? <Empty title={sp.q ? "No users match that search" : "No users found"} hint={sp.q ? "Try a different name or clear the search." : "Accounts will appear here after people sign up."} href={sp.q ? "/admin/users" : undefined} cta="Clear search" /> : <Table head={["Name", "Roles", "Status", "Joined", "Actions"]}>{(users as any[]).map((u) => (
      <tr key={u.id}><td className="table-td font-medium">{u.full_name || "(no name)"}</td>
        <td className="table-td"><div className="flex flex-wrap gap-1">{u.user_roles.length ? u.user_roles.map((r: any) => <Badge key={r.roles.key} status={r.roles.key}>{r.roles.name}</Badge>) : <span className="text-sm text-ink-faint">{rolesAvailable ? "Learner" : "Role details unavailable"}</span>}</div></td><td className="table-td"><Badge status={u.status} /></td><td className="table-td">{fmtDate(u.created_at)}</td>
        <td className="table-td"><div className="flex flex-wrap gap-2">
          {u.status === "active" ? <details><summary className="btn-danger cursor-pointer list-none">Suspend</summary><form action={suspendAction} className="mt-2 flex min-w-56 flex-col gap-2"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><label className="text-xs text-ink-soft">Reason (recorded in the audit log)<input name="reason" className="input mt-1" placeholder="Explain why access is being suspended" required minLength={5} maxLength={500} /></label><SubmitButton className="btn-danger" pendingLabel="Suspending…">Confirm suspension</SubmitButton></form></details>
            : <form action={reinstateAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><SubmitButton className="btn-outline" pendingLabel="Restoring…">Reinstate account</SubmitButton></form>}
          {canAssign && roleData && <details className="basis-full">
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
