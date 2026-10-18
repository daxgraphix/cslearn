import "server-only";
import { requireUser, type SessionUser } from "@/lib/auth";
import { defaultWorkspacePath, portalsFor, type Portal, type Permission, type RoleKey } from "@/lib/permissions";
import { createSupabase } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const GATE: Record<Portal, Permission[] | null> = {
  learner: null,
  instructor: ["course.create", "course.update.own", "course.update.any"],
  reviewer: ["course.review.assigned", "course.review.any"],
  admin: ["user.read", "report.read", "audit.read", "ops.read", "role.assign", "certificate.read.any", "enrollment.read.any", "course.read.any"],
  organization: null,
  support: ["support.read"],
};

/** Layout-level gate: decides which workspace the user may open. Pages and actions still authorize every operation. */
export async function enterPortal(portal: Portal): Promise<{ user: SessionUser; portals: Portal[] }> {
  const user = await requireUser();
  const portals = portalsFor(user.roles, user.permissions, user.orgManagerOf.length > 0);
  if (!portals.includes(portal)) redirect("/forbidden");
  const need = GATE[portal];
  if (need && !need.some((p) => user.permissions.has(p))) redirect("/forbidden");
  return { user, portals };
}

/** Resolves the user's best permitted workspace after login using the newly established session. */
export async function workspacePathForUser(userId: string): Promise<string> {
  const supabase = await createSupabase();
  const [{ data: userRoles }, { data: denials }, { data: orgs }] = await Promise.all([
    supabase.from("user_roles").select("organization_id, roles(key, role_permissions(permission_key))").eq("user_id", userId),
    supabase.from("permission_denials").select("permission_key").eq("user_id", userId),
    supabase.from("organization_memberships").select("organization_id").eq("user_id", userId).eq("member_type", "manager").eq("status", "active"),
  ]);
  const roles: RoleKey[] = [];
  const permissions = new Set<string>();
  for (const row of (userRoles ?? []) as any[]) {
    if (row.roles?.key) roles.push(row.roles.key);
    for (const permission of row.roles?.role_permissions ?? []) permissions.add(permission.permission_key);
  }
  for (const denial of denials ?? []) permissions.delete(denial.permission_key);
  const portals = portalsFor(roles, permissions, Boolean(orgs?.length));
  return defaultWorkspacePath(portals);
}
