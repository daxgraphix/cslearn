import { createPlatformRoleAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { PageHeader, Table } from "@/components/ui";
import { roleCatalog } from "@/services/admin";

export const metadata = { title: "Roles and permissions" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [params, catalog] = await Promise.all([searchParams, roleCatalog()]);
  return (
    <>
      <PageHeader title="Roles and permissions" subtitle="Create permission bundles and review access granted across the platform." />
      <Flash error={params.error} />

      <section className="card mb-8 border border-surface-line p-4 sm:p-6" aria-labelledby="create-role-heading">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Role builder</p>
          <h2 id="create-role-heading" className="mt-1 text-xl font-semibold">Create a platform role</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">Roles can include only permissions you already hold. {catalog.canAssignPrivileged ? "Roles you create are privileged and can only be assigned by a platform owner." : "Roles you create are non-privileged; platform owners alone manage privileged access."}</p>
        </div>
        <form action={createPlatformRoleAction} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="role-name">Display name</label>
              <input id="role-name" name="name" className="input" minLength={2} maxLength={100} required placeholder="Content coordinator" />
            </div>
            <div>
              <label className="label" htmlFor="role-key">Role key</label>
              <input id="role-key" name="key" className="input font-mono" minLength={3} maxLength={48} pattern="[a-z][a-z0-9_]*" required placeholder="content_coordinator" aria-describedby="role-key-help" />
              <p id="role-key-help" className="mt-1 text-xs text-ink-faint">Lowercase letters, numbers, and underscores. This cannot be changed later.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="role-description">Description</label>
              <input id="role-description" name="description" className="input" maxLength={300} placeholder="What this role is responsible for" />
            </div>
          </div>

          <fieldset>
            <legend className="label">Permissions</legend>
            {catalog.permissions.length === 0 ? <p className="text-sm text-ink-soft">You do not have assignable permissions to add to a new role.</p> :
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {catalog.permissions.map((permission) => (
                  <label key={permission.key} className="flex min-h-12 items-start gap-3 rounded-lg border border-surface-line bg-white p-3 text-sm hover:bg-surface-muted/60">
                    <input type="checkbox" name="permissions" value={permission.key} className="mt-0.5 h-4 w-4 accent-brand" />
                    <span className="min-w-0"><span className="block break-words font-medium text-ink">{permission.key}</span><span className="mt-0.5 block text-xs leading-5 text-ink-soft">{permission.description}</span></span>
                  </label>
                ))}
              </div>}
          </fieldset>
          <button className="btn-primary" disabled={catalog.permissions.length === 0}>Create role</button>
        </form>
      </section>

      <section aria-labelledby="existing-roles-heading">
        <div className="mb-3">
          <h2 id="existing-roles-heading" className="text-lg font-semibold">Existing roles</h2>
          <p className="mt-1 text-sm text-ink-soft">Assign roles to people from <a href="/admin/users" className="font-medium text-brand hover:underline">Users</a>.</p>
        </div>
        <Table head={["Role", "Scope", "Access bundle"]}>
          {catalog.roles.map((role) => (
            <tr key={role.id}>
              <td className="table-td"><span className="font-medium">{role.name}</span><span className="mt-0.5 block font-mono text-xs text-ink-faint">{role.key}</span></td>
              <td className="table-td">{role.is_privileged ? <span className="text-danger">Privileged</span> : role.scope}</td>
              <td className="table-td"><div className="flex max-w-2xl flex-wrap gap-1.5">{role.role_permissions.length ? role.role_permissions.map((permission) => <span key={permission.permission_key} className="chip bg-surface-muted text-ink-soft">{permission.permission_key}</span>) : <span className="text-ink-faint">No direct permissions</span>}</div></td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}