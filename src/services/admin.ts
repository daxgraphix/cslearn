import "server-only";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { ForbiddenError, requirePermission } from "@/lib/auth";
import { createPlatformRoleSchema } from "@/lib/validation";
import { suspendSchema } from "@/lib/validation";
import type { z } from "zod";

export async function listUsers(search?: string, page = 1) {
  await requirePermission("user.read");
  const supabase = await createSupabase();
  let q = supabase.from("profiles").select("id, full_name, status, created_at, user_roles(roles(key, name))", { count: "exact" });
  if (search) q = q.ilike("full_name", `%${search.replace(/[%_]/g, "")}%`);
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * 25, page * 25 - 1);
  return { users: data ?? [], total: count ?? 0 };
}

export async function suspend(input: z.input<typeof suspendSchema>) {
  await requirePermission("user.suspend");
  const v = suspendSchema.parse(input);
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("suspend_user", { p_user: v.userId, p_reason: v.reason });
  if (error) throw error;
  // Revoke active sessions (service role): suspended users can no longer refresh tokens.
  await createAdminSupabase().auth.admin.signOut(v.userId, "global").catch(() => undefined);
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
  const supabase = await createSupabase();
  const [{ data: roles, error: rolesError }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("roles").select("id, key, name, description, is_privileged, scope, role_permissions(permission_key)").order("name"),
    supabase.from("permissions").select("key, description").order("key"),
  ]);
  if (rolesError) throw rolesError;
  if (permissionsError) throw permissionsError;
  return {
    roles: roles ?? [],
    permissions: (permissions ?? []).filter((permission) => user.permissions.has(permission.key)),
    permissionDescriptions: Object.fromEntries((permissions ?? []).map((permission) => [permission.key, permission.description])),
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
