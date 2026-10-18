import { createPlatformRoleAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { PageHeader, Table } from "@/components/ui";
import { roleCatalog } from "@/services/admin";
import { RoleIdentityFields } from "@/components/RoleIdentityFields";
import { SubmitButton } from "@/components/SubmitButton";
import Link from "next/link";

export const metadata = { title: "Roles and access" };

export default async function RolesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const [params, catalog] = await Promise.all([searchParams, roleCatalog()]);
  const groups: Record<string, typeof catalog.permissions> = {};
  for (const permission of catalog.permissions) {
    const group = permission.key.startsWith("course.") ? "Courses" : permission.key.startsWith("grade.") ? "Assessments" :
      permission.key.startsWith("user.") || permission.key.startsWith("role.") || permission.key.startsWith("owner.") ? "People and access" :
      permission.key.startsWith("enrollment.") || permission.key.startsWith("certificate.") || permission.key.startsWith("finance.") ? "Learner records" :
      permission.key.startsWith("org.") || permission.key.startsWith("support.") ? "Organizations and support" : "Platform operations";
    (groups[group] ??= []).push(permission);
  }
  const descriptionByKey = catalog.permissionDescriptions as Record<string, string>;
  return (
    <>
      <PageHeader title="Roles and access" subtitle="Decide what different people can see and do. Then assign a role to a person from Users." />
      <Flash error={params.error} notice={params.notice} />

      <section className="card mb-8 border border-surface-line p-4 sm:p-6" aria-labelledby="create-role-heading">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Create an access role</p>
          <h2 id="create-role-heading" className="mt-1 text-xl font-semibold">Choose what this role can do</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">A role is a reusable set of access. Choose only the tasks this person needs. You can assign the role to people after creating it. {catalog.canAssignPrivileged ? "Your account can create and assign owner-managed roles." : "You can create standard roles; platform owners manage privileged roles."}</p>
        </div>
        <form action={createPlatformRoleAction} className="space-y-5">
          <RoleIdentityFields />

          <fieldset>
            <legend className="label">Choose access</legend>
            <p className="mb-3 text-sm text-ink-soft">Select at least one option. Each grants a specific action, and you can only pass on access you already have.</p>
            {catalog.permissions.length === 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your account has no permissions available to add to a new role.</p> :
              <div className="space-y-5">{Object.entries(groups).map(([group, permissions]) => <fieldset key={group} className="rounded-xl border border-surface-line p-4">
                <legend className="px-1 text-sm font-semibold text-ink">{group}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {permissions.map((permission) => <label key={permission.key} className="flex min-h-16 items-start gap-3 rounded-lg border border-surface-line bg-white p-3 text-sm transition-colors hover:border-brand/40 hover:bg-brand-soft/20">
                    <input type="checkbox" name="permissions" value={permission.key} className="mt-0.5 h-4 w-4 accent-brand" />
                    <span className="min-w-0"><span className="block font-medium text-ink">{permission.description}</span><span className="mt-1 block break-all font-mono text-[11px] text-ink-faint">{permission.key}</span></span>
                  </label>)}
                </div>
              </fieldset>)}</div>}
          </fieldset>
          <SubmitButton className="btn-primary" pendingLabel="Creating role…" disabled={catalog.permissions.length === 0}>Create access role</SubmitButton>
        </form>
      </section>

      <section aria-labelledby="existing-roles-heading">
        <div className="mb-3">
          <h2 id="existing-roles-heading" className="text-lg font-semibold">Roles already set up</h2>
          <p className="mt-1 text-sm text-ink-soft">Access shown here comes from each role. <Link href="/admin/users" className="font-medium text-brand hover:underline">Go to Users to assign roles.</Link></p>
        </div>
        <Table head={["Role", "Where it applies", "What people can do"]}>
          {catalog.roles.map((role) => (
            <tr key={role.id}>
              <td className="table-td"><span className="font-medium">{role.name}</span><span className="mt-0.5 block font-mono text-xs text-ink-faint">{role.key}</span></td>
              <td className="table-td"><span>{role.scope === "organization" ? "One organization" : "Platform-wide"}</span>{role.is_privileged && <span className="mt-1 block text-xs font-medium text-danger">Owner-managed access</span>}</td>
              <td className="table-td"><div className="flex max-w-2xl flex-wrap gap-1.5">{role.role_permissions.length ? role.role_permissions.map((permission) => <span key={permission.permission_key} title={permission.permission_key} className="chip bg-surface-muted text-ink-soft">{descriptionByKey[permission.permission_key] || permission.permission_key}</span>) : <span className="text-ink-faint">No direct permissions</span>}</div></td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
