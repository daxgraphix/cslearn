import "server-only";
import { requireUser, type SessionUser } from "@/lib/auth";
import { portalsFor, type Portal, type Permission } from "@/lib/permissions";
import { redirect } from "next/navigation";

const GATE: Record<Portal, Permission[] | null> = {
  learner: null,
  instructor: ["course.create", "course.update.own"],
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
