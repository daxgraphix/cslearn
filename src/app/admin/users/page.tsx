import Link from "next/link";
import { listUsers, roleCatalog, type Role } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { suspendAction, reinstateAction, roleAction, inviteUserAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
import { SubmitButton } from "@/components/SubmitButton";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { ChevronDown, KeyRound, ShieldCheck } from "lucide-react";
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
  const assignableRoles: Role[] = roleData?.roles.filter((role) => !role.is_privileged || canAssignPrivileged) ?? [];
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
    {users.length === 0 ? <Empty title={sp.q ? "No users match that search" : "No users found"} hint={sp.q ? "Try a different name or clear the search." : "Accounts will appear here after people sign up."} href={sp.q ? "/admin/users" : undefined} cta="Clear search" /> : <Table head={["Name", "Roles", "Status", "Joined", "Actions"]}>{(users as any[]).map((u) => <Fragment key={u.id}>
      <tr><td className="table-td font-medium">{u.full_name || "(no name)"}</td>
        <td className="table-td"><div className="flex flex-wrap gap-1">{u.user_roles.length ? u.user_roles.map((r: any) => <Badge key={r.roles.key} status={r.roles.key}>{r.roles.name}</Badge>) : <span className="text-sm text-ink-faint">{rolesAvailable ? "Learner" : "Role details unavailable"}</span>}</div></td><td className="table-td"><Badge status={u.status} /></td><td className="table-td">{fmtDate(u.created_at)}</td>
        <td className="table-td"><div className="flex flex-wrap gap-2">
          {u.status === "active" ? <details><summary className="btn-danger cursor-pointer list-none">Suspend</summary><form action={suspendAction} className="mt-2 flex min-w-56 flex-col gap-2"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><label className="text-xs text-ink-soft">Reason (recorded in the audit log)<input name="reason" className="input mt-1" placeholder="Explain why access is being suspended" required minLength={5} maxLength={500} /></label><SubmitButton className="btn-danger" pendingLabel="Suspending…">Confirm suspension</SubmitButton></form></details>
            : <form action={reinstateAction}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><SubmitButton className="btn-outline" pendingLabel="Restoring…">Reinstate account</SubmitButton></form>}
        </div></td></tr>
      {canAssign && roleData && <tr><td colSpan={5} className="border-t border-surface-line bg-surface-muted/30 p-3 sm:p-4">
        <details className="group/access">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-xl border border-surface-line bg-white p-3 transition-colors hover:border-brand/40 hover:bg-brand-soft/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:px-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><KeyRound size={17} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">Role access</span><span className="mt-0.5 block truncate text-xs text-ink-soft">For {u.full_name || "this account"} · review or change platform roles</span></span>
            <Badge status={u.user_roles.length ? "active" : "pending"}>{rolesAvailable ? `${u.user_roles.length} ${u.user_roles.length === 1 ? "role" : "roles"} assigned` : "Role details unavailable"}</Badge>
            <ChevronDown size={17} className="shrink-0 text-ink-faint transition-transform group-open/access:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3 rounded-xl border border-surface-line bg-surface-muted/50 p-3 sm:p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
              <div><h3 className="text-sm font-semibold text-ink">Available roles</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-ink-soft">Assign only the access this person needs. Roles can combine, so removing one role may not remove permissions granted elsewhere.</p></div>
              <Link href="/admin/roles" className="text-xs font-semibold text-brand hover:underline">Review role permissions</Link>
            </div>
            {assignableRoles.length === 0 ? <p className="rounded-lg border border-surface-line bg-white p-4 text-sm text-ink-soft">No roles are available for your account to assign.</p> :
              <ul className="grid gap-3 md:grid-cols-2">
                {[...assignableRoles].sort((a, b) => Number(u.user_roles.some((item: any) => item.roles.key === b.key)) - Number(u.user_roles.some((item: any) => item.roles.key === a.key))).map((role) => {
                  const assigned = u.user_roles.some((item: any) => item.roles.key === role.key);
                  return <li key={role.key} className="flex min-w-0 flex-col justify-between gap-4 rounded-xl border border-surface-line bg-white p-4 shadow-sm transition-shadow hover:shadow-card">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${assigned ? "bg-emerald-50 text-ok" : "bg-surface-muted text-ink-faint"}`}><ShieldCheck size={18} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-ink">{role.name}</h4><Badge status={assigned ? "active" : "pending"}>{assigned ? "Assigned" : "Available"}</Badge></div><p className="mt-1 break-words text-xs leading-5 text-ink-soft">{role.description || role.scope}</p>{role.is_privileged && <p className="mt-2 text-xs font-medium text-danger">Owner-managed privileged role</p>}</div>
                    </div>
                    {assigned ? <details className="border-t border-surface-line pt-3"><summary className="inline-flex min-h-9 cursor-pointer list-none items-center rounded-lg px-3 text-sm font-medium text-danger hover:bg-red-50">Remove role</summary><form action={roleAction} className="mt-3 rounded-lg border border-red-100 bg-red-50/60 p-3"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="role" value={role.key} /><input type="hidden" name="mode" value="revoke" /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><p className="mb-3 text-sm text-ink">Remove <strong>{role.name}</strong> from this account?</p><SubmitButton className="btn-danger w-full" pendingLabel="Removing…">Confirm removal</SubmitButton></form></details>
                      : <form action={roleAction} className="border-t border-surface-line pt-3"><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="role" value={role.key} /><input type="hidden" name="mode" value="grant" /><input type="hidden" name="q" value={sp.q ?? ""} /><input type="hidden" name="page" value={page} /><SubmitButton className="btn-primary w-full" pendingLabel="Assigning…">Assign this role</SubmitButton></form>}
                  </li>;
                })}
              </ul>}
          </div>
        </details>
      </td></tr>}
    </Fragment>)}</Table>}
    {pages > 1 && <nav className="mt-4 flex items-center justify-between gap-3" aria-label="User pages">
      <span className="text-sm text-ink-soft">Page {page} of {pages} · {total} accounts</span>
      <div className="flex gap-2">{page > 1 && <Link className="btn-outline" href={`/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`}>Previous</Link>}{page < pages && <Link className="btn-outline" href={`/admin/users?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`}>Next</Link>}</div>
    </nav>}
  </>);
}
