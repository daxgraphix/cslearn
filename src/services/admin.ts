import "server-only";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { ForbiddenError, requirePageAccess, requirePermission } from "@/lib/auth";
import { createPlatformRoleSchema, updatePlatformRoleSchema, inviteUserSchema } from "@/lib/validation";
import { suspendSchema } from "@/lib/validation";
import { getSiteUrl } from "@/lib/site-url";
import type { z } from "zod";

export type Role = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_privileged: boolean;
  scope: string;
  role_permissions: { permission_key: string }[];
};

export type Permission = {
  key: string;
  description: string;
};

function staffReadClient() {
  try { return createAdminSupabase(); }
  catch { return null; }
}

export async function listUsers(search?: string, page = 1) {
  await requirePageAccess("user.read");
  // Load profiles independently of the optional role relation. A relationship
  // or RLS failure should not make the whole directory unavailable.
  let supabase: any = staffReadClient() ?? await createSupabase();
  let q = supabase.from("profiles").select("id, full_name, status, created_at", { count: "exact" });
  const term = search?.trim().replace(/[%_]/g, "");
  if (term) q = q.ilike("full_name", `%${term}%`);
  const safePage = Math.max(1, Math.floor(page) || 1);
  let { data, count, error } = await q.order("created_at", { ascending: false }).range((safePage - 1) * 25, safePage * 25 - 1);
  if (error && staffReadClient()) {
    supabase = await createSupabase();
    q = supabase.from("profiles").select("id, full_name, status, created_at", { count: "exact" });
    if (term) q = q.ilike("full_name", `%${term}%`);
    ({ data, count, error } = await q.order("created_at", { ascending: false }).range((safePage - 1) * 25, safePage * 25 - 1));
  }
  if (error) {
    console.error("[admin:list-users]", { code: error.code, message: error.message });
    throw new Error("Could not load the user list. Refresh the page and try again.");
  }
  const users = (data ?? []).map((user: any) => ({ ...user, user_roles: [] as any[] }));
  let rolesAvailable = true;
  if (users.length) {
    try {
      const roleClient: any = staffReadClient() ?? supabase;
      const { data: assignments, error: assignmentError } = await roleClient
        .from("user_roles")
        .select("user_id, roles(key, name)")
        .in("user_id", users.map((user: any) => user.id));
      if (assignmentError) throw assignmentError;
      const byUser = new Map(users.map((user: any) => [user.id, user]));
      for (const assignment of assignments ?? []) {
        const role = Array.isArray(assignment.roles) ? assignment.roles[0] : assignment.roles;
        const user: any = byUser.get(assignment.user_id);
        if (user && role?.key) user.user_roles.push({ roles: role });
      }
    } catch (roleError) {
      rolesAvailable = false;
      console.error("[admin:list-user-roles]", roleError);
    }
  }
  return { users, total: count ?? 0, rolesAvailable };
}

export async function suspend(input: z.input<typeof suspendSchema>) {
  await requirePermission("user.suspend");
  const v = suspendSchema.parse(input);
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("suspend_user", { p_user: v.userId, p_reason: v.reason });
  if (error) throw error;
  // Revoke active sessions (service role): suspended users can no longer refresh tokens.
  try {
    const { error: sessionError } = await createAdminSupabase().auth.admin.signOut(v.userId, "global");
    if (sessionError) {
      console.error("[admin:suspend-session-revoke]", { code: sessionError.status, message: sessionError.message });
      return { sessionsRevoked: false };
    }
    return { sessionsRevoked: true };
  } catch (error) {
    console.error("[admin:suspend-session-revoke]", error);
    return { sessionsRevoked: false };
  }
}
export async function reinstate(userId: string) {
  await requirePermission("user.suspend");
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("reinstate_user", { p_user: userId });
  if (error) throw error;
}
export async function setRole(userId: string, roleKey: string, grant: boolean, orgId?: string) {
  await requirePermission("role.assign", "role.assign.privileged"); // DB function re-checks privileged roles
  const supabase = await createSupabase();
  const { error } = grant
    ? await supabase.rpc("assign_role", { p_user: userId, p_role_key: roleKey, p_org: orgId ?? null })
    : await supabase.rpc("remove_role", { p_user: userId, p_role_key: roleKey, p_org: orgId ?? null });
  if (error) throw error;
}
export async function roleCatalog() {
  const user = await requirePermission("role.assign");
  // Permission data is read after the signed-in user's permission check, then
  // filtered below to only the permissions this actor may grant.
  let supabase: any = staffReadClient() ?? await createSupabase();
  let [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_privileged, scope, role_permissions(permission_key)").order("name"),
    supabase.from("permissions").select("key, description").order("key"),
  ]);
  if ((rolesError || permissionsError) && staffReadClient()) {
    supabase = await createSupabase();
    [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
      supabase.from("roles").select("id, key, name, description, is_privileged, scope, role_permissions(permission_key)").order("name"),
      supabase.from("permissions").select("key, description").order("key"),
    ]);
  }
  if (rolesError) throw rolesError;
  if (permissionsError) throw permissionsError;
  return {
    roles: (roles ?? []) as Role[],
    permissions: ((permissions ?? []) as Permission[]).filter((permission) => user.permissions.has(permission.key)),
    permissionDescriptions: Object.fromEntries(((permissions ?? []) as Permission[]).map((permission) => [permission.key, permission.description])),
    canAssignPrivileged: user.permissions.has("role.assign.privileged"),
  };
}
export async function createPlatformRole(input: unknown) {
  const user = await requirePermission("role.assign");
  const role = createPlatformRoleSchema.parse(input);
  const permissions = [...new Set(role.permissions)];
  if (permissions.some((permission) => !user.permissions.has(permission))) throw new ForbiddenError();
  const { error } = await (await createSupabase()).rpc("create_platform_role", {
    p_key: role.key,
    p_name: role.name,
    p_description: role.description || null,
    p_permissions: permissions,
  });
  if (error?.code === "23505") throw Object.assign(new Error("That system ID is already in use. Choose a different one."), { code: "P0001" });
  if (error) throw error;
}
export async function updatePlatformRole(input: unknown) {
  const user = await requirePermission("role.assign");
  const role = updatePlatformRoleSchema.parse(input);
  const permissions = [...new Set(role.permissions)];
  if (permissions.some((permission) => !user.permissions.has(permission))) throw new ForbiddenError();
  const { error } = await (await createSupabase()).rpc("update_platform_role", {
    p_key: role.key, p_name: role.name, p_description: role.description || null, p_permissions: permissions,
  });
  if (error) throw error;
}
export async function inviteUser(input: unknown) {
  await requirePermission("user.read");
  await requirePermission("role.assign");
  const invite = inviteUserSchema.parse(input);
  const catalog = await roleCatalog();
  const role = catalog.roles.find((item: any) => item.key === invite.roleKey);
  if (!role || (role.is_privileged && !catalog.canAssignPrivileged)) throw new ForbiddenError();
  if (role.role_permissions.some((item: any) => !catalog.permissions.some((permission) => permission.key === item.permission_key))) throw new ForbiddenError("You cannot assign this role's full permission set.");
  const admin = createAdminSupabase();
  const redirectTo = new URL("/auth/callback?next=%2Freset-password", getSiteUrl()).toString();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(invite.email, { data: { full_name: invite.fullName }, redirectTo });
  if (error) throw new Error("Could not send the invitation. Check the email address and Supabase email delivery settings.");
  if (!data.user) throw new Error("The invitation was sent, but the account was not returned. Refresh the user list before inviting again.");
  await setRole(data.user.id, invite.roleKey, true);
}
export async function overview() {
  await requirePermission("report.read");
  const supabase = await createSupabase();
  const { data } = await supabase.rpc("platform_overview");
  return (data as any[])?.[0] ?? null;
}
export async function auditLog(page = 1) {
  await requirePermission("audit.read");
  const supabase = await createSupabase();
  const { data } = await supabase.from("audit_logs").select("id, actor_id, action, entity_type, entity_id, metadata, created_at").order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1);
  return data ?? [];
}
export async function adminCourses() {
  await requirePermission("course.read.any");
  const supabase = await createSupabase();
  const { data } = await supabase.from("courses").select("id, slug, archived_at, published_version_id, course_versions!course_versions_course_id_fkey(id, title, status, version_number, course_submissions(id, status, assigned_reviewer_id))").order("created_at", { ascending: false }).limit(100);
  return data ?? [];
}
export async function jobHealth() {
  await requirePermission("ops.read");
  const supabase = await createSupabase();
  const { data } = await supabase.from("jobs").select("id, kind, status, attempts, max_attempts, last_error, run_at, created_at").in("status", ["failed", "dead", "queued"]).order("run_at").limit(100);
  return data ?? [];
}
export async function retryDeadJob(jobId: string) {
  await requirePermission("ops.retry");
  const { error } = await (await createSupabase()).rpc("retry_dead_job", { p_job: jobId });
  if (error) throw error;
}
export async function certificates() {
  await requirePermission("certificate.read.any");
  const supabase = await createSupabase();
  const { data } = await supabase.from("certificates").select("id, serial, learner_name, course_title, status, issued_at").order("issued_at", { ascending: false }).limit(100);
  return data ?? [];
}
export async function listEnrollments() {
  await requirePermission("enrollment.read.any");
  const supabase = await createSupabase();
  const { data } = await supabase.from("enrollments").select("id, status, source, enrolled_at, profiles(full_name), courses(slug)").order("enrolled_at", { ascending: false }).limit(100);
  return data ?? [];
}

/** Bulk enrollment from CSV (email,course_slug). Validates, reports errors, detects duplicates. */
export async function bulkEnroll(csv: string) {
  await requirePermission("enrollment.manage");
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const rows = lines[0]?.toLowerCase().startsWith("email") ? lines.slice(1) : lines;
  if (rows.length > 2000) throw new Error("Maximum 2000 rows per import");
  const admin = createAdminSupabase();
  const report = { created: 0, duplicates: 0, errors: [] as { line: number; message: string }[] };
  const seen = new Set<string>();
  for (const [i, row] of rows.entries()) {
    const [email, slug] = row.split(",").map((s) => s?.trim());
    if (!email || !slug || !/^\S+@\S+\.\S+$/.test(email)) { report.errors.push({ line: i + 1, message: "Invalid row" }); continue; }
    const key = `${email.toLowerCase()}|${slug}`;
    if (seen.has(key)) { report.duplicates++; continue; } seen.add(key);
    const { data: course } = await admin.from("courses").select("id, published_version_id").eq("slug", slug).maybeSingle();
    if (!course?.published_version_id) { report.errors.push({ line: i + 1, message: `Course not published: ${slug}` }); continue; }
    const { data: uid } = await admin.rpc("user_id_by_email", { p_email: email });
    const { data: profile } = uid ? await admin.from("profiles").select("id, status").eq("id", uid as string).maybeSingle() : { data: null };
    if (!profile || profile.status !== "active") { report.errors.push({ line: i + 1, message: `No active account: ${email}` }); continue; }
    const { error, status } = await admin.from("enrollments").insert({ learner_id: profile.id, course_id: course.id, version_id: course.published_version_id, source: "import" });
    if (error?.code === "23505") report.duplicates++; else if (error) report.errors.push({ line: i + 1, message: "Could not enroll" }); else report.created += status ? 1 : 0;
  }
  return report;
}
