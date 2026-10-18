import Link from "next/link";
import { createPlatformRoleAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { PageHeader } from "@/components/ui";
import { roleCatalog } from "@/services/admin";
import { RoleIdentityFields } from "@/components/RoleIdentityFields";
import { SubmitButton } from "@/components/SubmitButton";

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
  return <>
    <PageHeader title="Roles and access" subtitle="Create reusable access roles and review what each role can do." actions={<Link href="/admin/users" className="btn-outline">Assign roles to people</Link>} />
    <Flash error={params.error} notice={params.notice} />

    <section className="card mb-8 border border-surface-line p-4 sm:p-6" aria-labelledby="create-role-heading">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">New role</p>
        <h2 id="create-role-heading" className="mt-1 text-xl font-semibold">Create an access role</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-ink-soft">Choose only the access this role needs. You can grant permissions already assigned to your account.</p>
      </div>
      <form action={createPlatformRoleAction} className="space-y-5">
        <RoleIdentityFields />
        <fieldset>
          <legend className="label">Choose access</legend>
          <p className="mb-3 text-sm text-ink-soft">Open a group to choose specific actions. Select at least one.</p>
          {catalog.permissions.length === 0 ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Your account has no permissions available to add to a new role.</p> :
            <div className="space-y-2">{Object.entries(groups).map(([group, permissions]) => <details key={group} open={group === "Courses"} className="overflow-hidden rounded-xl border border-surface-line">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-muted">
                <span>{group}</span><span className="text-xs font-normal text-ink-faint">{permissions.length} {permissions.length === 1 ? "option" : "options"}</span>
              </summary>
              <div className="grid gap-2 border-t border-surface-line bg-surface-muted/30 p-3 sm:grid-cols-2">
                {permissions.map((permission) => <label key={permission.key} className="flex min-h-14 items-start gap-3 rounded-lg border border-surface-line bg-white p-3 text-sm transition-colors hover:border-brand/40 hover:bg-brand-soft/20">
                  <input type="checkbox" name="permissions" value={permission.key} className="mt-0.5 h-4 w-4 shrink-0 accent-brand" />
                  <span className="min-w-0 font-medium leading-5 text-ink">{permission.description}</span>
                </label>)}
              </div>
            </details>)}</div>}
        </fieldset>
        <SubmitButton className="btn-primary" pendingLabel="Creating role…" disabled={catalog.permissions.length === 0}>Create access role</SubmitButton>
      </form>
    </section>

    <section aria-labelledby="existing-roles-heading">
      <div className="mb-3">
        <h2 id="existing-roles-heading" className="text-lg font-semibold">Existing roles</h2>
        <p className="mt-1 text-sm text-ink-soft">Open a role to review its access before assigning it.</p>
      </div>
      {catalog.roles.length === 0 ? <div className="card border border-surface-line p-5 text-sm text-ink-soft">No roles are available yet.</div> :
        <ul className="grid gap-3 lg:grid-cols-2">{catalog.roles.map((role) => <li key={role.id}>
          <article className="card h-full border border-surface-line p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="font-semibold text-ink">{role.name}</h3>{role.description && <p className="mt-1 text-sm leading-5 text-ink-soft">{role.description}</p>}</div>
              <span className="chip shrink-0 bg-surface-muted text-ink-soft">{role.scope === "organization" ? "Organization" : "Platform"}</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
              <span>{role.role_permissions.length} {role.role_permissions.length === 1 ? "permission" : "permissions"}</span>
              {role.is_privileged && <span className="chip bg-amber-50 text-amber-800">Owner-managed</span>}
            </div>
            <details className="mt-4 border-t border-surface-line pt-3">
              <summary className="cursor-pointer text-sm font-medium text-brand">Review access</summary>
              <div className="mt-3 flex flex-wrap gap-1.5">{role.role_permissions.length ? role.role_permissions.map((permission) => <span key={permission.permission_key} className="chip bg-surface-muted text-ink-soft">{descriptionByKey[permission.permission_key] || permission.permission_key}</span>) : <span className="text-sm text-ink-faint">No direct permissions</span>}</div>
            </details>
          </article>
        </li>)}</ul>}
    </section>
  </>;
}
