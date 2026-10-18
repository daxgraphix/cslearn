/** Permission naming: <domain>.<action>[.<scope>]. Keep in sync with supabase/migrations/0004_seed.sql */
export const PERMISSIONS = [
  "course.create", "course.update.own", "course.update.any", "course.read.any", "course.submit",
  "course.review.assigned", "course.review.any", "course.publish", "course.unpublish",
  "grade.write.assigned", "grade.write.any", "grade.override",
  "user.read", "user.suspend", "role.read", "role.assign", "role.assign.privileged", "owner.manage",
  "enrollment.read.any", "enrollment.manage",
  "certificate.issue", "certificate.revoke", "certificate.read.any",
  "support.read", "support.reply",
  "audit.read", "report.read", "ops.read", "ops.retry", "settings.read", "settings.write",
  "org.read.any", "org.manage", "category.manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type RoleKey =
  | "owner" | "admin" | "reviewer" | "instructor" | "learner" | "support" | "org_manager"
  | "certificate_officer" | "assessment_moderator" | "auditor" | "enrollment_manager" | (string & {});

export type Portal = "learner" | "instructor" | "reviewer" | "admin" | "organization" | "support";

/** Which portals a set of roles/permissions may open (navigation only, never a security boundary). */
export function portalsFor(roles: RoleKey[], perms: Set<string>, isOrgManager: boolean): Portal[] {
  const out: Portal[] = ["learner"];
  if (perms.has("course.update.own") || perms.has("course.update.any")) out.push("instructor");
  if (perms.has("course.review.assigned") || perms.has("course.review.any")) out.push("reviewer");
  const adminPermission = ["user.read", "report.read", "audit.read", "ops.read", "role.assign", "certificate.read.any", "enrollment.read.any"];
  if (roles.some((r) => ["owner", "admin", "auditor", "certificate_officer", "enrollment_manager", "assessment_moderator"].includes(r)) || adminPermission.some((permission) => perms.has(permission))) out.push("admin");
  if (perms.has("support.read")) out.push("support");
  if (isOrgManager) out.push("organization");
  return out;
}

/** Landing destination for an authenticated person, preferring their most operational workspace. */
export function defaultWorkspacePath(portals: Portal[]): string {
  const portal = (["admin", "reviewer", "instructor", "organization", "support", "learner"] as Portal[]).find((candidate) => portals.includes(candidate)) ?? "learner";
  return `/${portal === "support" ? "support/queue" : `${portal}/dashboard`}`;
}

/** Pure policy check used by unit tests and service guards. Explicit denials always win. */
export function can(grants: Iterable<string>, denials: Iterable<string>, perm: Permission): boolean {
  const denied = new Set(denials);
  if (denied.has(perm)) return false;
  return new Set(grants).has(perm);
}

/** Resource-level rules: a role never overrides ownership, state or tenant boundaries. */
export function canEditVersion(args: { isAuthor: boolean; hasOwn: boolean; hasAny: boolean; status: string }) {
  const editable = args.status === "draft" || args.status === "changes_requested";
  return editable && ((args.isAuthor && args.hasOwn) || args.hasAny);
}
export function canReviewVersion(args: { reviewerId: string; submittedBy: string; isCourseInstructor: boolean; assignedTo: string | null; hasAny: boolean }) {
  if (args.reviewerId === args.submittedBy || args.isCourseInstructor) return false; // no self-approval
  return args.hasAny || args.assignedTo === args.reviewerId;
}
