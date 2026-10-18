import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabase } from "@/lib/supabase/server";
import type { Permission, RoleKey } from "@/lib/permissions";

export class ForbiddenError extends Error { constructor(msg = "Forbidden") { super(msg); } }

export type SessionUser = {
  id: string; email: string; fullName: string; locale: "en"; status: "active" | "suspended";
  roles: RoleKey[]; permissions: Set<string>; orgManagerOf: string[];
};

/** Resolves identity + roles + effective permissions (grants minus explicit denials). Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabase();
  const { data: { user } } = await supabase.auth.getUser(); // validates the JWT with Auth server
  if (!user) return null;
  const [{ data: profile }, { data: urs }, { data: denials }, { data: orgs }] = await Promise.all([
    supabase.from("profiles").select("full_name, locale, status").eq("id", user.id).single(),
    supabase.from("user_roles").select("organization_id, roles(key, role_permissions(permission_key))").eq("user_id", user.id),
    supabase.from("permission_denials").select("permission_key").eq("user_id", user.id),
    supabase.from("organization_memberships").select("organization_id").eq("user_id", user.id).eq("member_type", "manager").eq("status", "active"),
  ]);
  if (!profile) return null;
  const roles: RoleKey[] = []; const grants = new Set<string>();
  for (const ur of (urs ?? []) as any[]) {
    const role = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
    // A deleted or malformed role relation must not crash every authenticated
    // workspace while resolving the user's session.
    if (!role?.key) continue;
    roles.push(role.key);
    for (const rp of role.role_permissions ?? []) if (rp?.permission_key) grants.add(rp.permission_key);
  }
  for (const d of denials ?? []) grants.delete(d.permission_key);
  return {
    id: user.id, email: user.email ?? "", fullName: profile.full_name, locale: "en",
    status: profile.status as "active" | "suspended", roles, permissions: grants,
    orgManagerOf: (orgs ?? []).map((o) => o.organization_id),
  };
});

/** Step 1-2 of the authorization checklist: authenticated and active. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  if (u.status !== "active") redirect("/suspended");
  return u;
}

/** Step 3: required permission (any of). Throws for actions, use requirePageAccess for pages. */
export async function requirePermission(...perms: Permission[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!perms.some((p) => u.permissions.has(p))) throw new ForbiddenError(`Missing permission: ${perms.join(" | ")}`);
  return u;
}

export async function requirePageAccess(...perms: Permission[]): Promise<SessionUser> {
  const u = await requireUser();
  if (!perms.some((p) => u.permissions.has(p))) redirect("/forbidden");
  return u;
}

export async function requireOrgManager(orgId: string): Promise<SessionUser> {
  const u = await requireUser();
  if (!u.orgManagerOf.includes(orgId) && !u.permissions.has("org.read.any")) throw new ForbiddenError("Not a manager of this organization");
  return u;
}

/** Steps 4-6 helper: ownership + state of a course. Returns the course row or throws. */
export async function requireCourseTeam(courseId: string) {
  const u = await requireUser();
  const supabase = await createSupabase();
  const { data: course } = await supabase.from("courses").select("id, slug, owner_id, published_version_id, course_instructors(user_id)").eq("id", courseId).single();
  if (!course) throw new ForbiddenError("Course not found");
  const isTeam = course.owner_id === u.id || course.course_instructors.some((i: any) => i.user_id === u.id);
  if (!isTeam && !u.permissions.has("course.update.any") && !u.permissions.has("course.read.any")) throw new ForbiddenError();
  return { user: u, course, isTeam };
}
