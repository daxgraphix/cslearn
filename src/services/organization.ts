import "server-only";
import { createSupabase } from "@/lib/supabase/server";
import { requireOrgManager } from "@/lib/auth";

export async function orgOverview(orgId: string) {
  await requireOrgManager(orgId);
  const supabase = await createSupabase();
  const [{ data: org }, { data: members }, { data: cohorts }, { data: report }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", orgId).single(),
    supabase.from("organization_memberships").select("user_id, member_type, status, profiles(full_name)").eq("organization_id", orgId),
    supabase.from("cohorts").select("id, name, starts_on, ends_on, cohort_memberships(count), cohort_course_assignments(course_id, due_on, courses(slug))").eq("organization_id", orgId),
    supabase.rpc("org_completion_report", { p_org: orgId }),
  ]);
  return { org, members: members ?? [], cohorts: cohorts ?? [], report: (report as any[]) ?? [] };
}
export async function createCohort(orgId: string, name: string) {
  await requireOrgManager(orgId);
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("org_create_cohort", { p_org: orgId, p_name: name.trim().slice(0, 120) });
  if (error) throw error;
}
export async function addMember(orgId: string, email: string, cohortId?: string) {
  await requireOrgManager(orgId);
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("org_add_member", { p_org: orgId, p_email: email.trim(), p_cohort: cohortId || null, p_type: "learner" });
  if (error) throw error;
}
export async function assignCourse(orgId: string, cohortId: string, courseId: string) {
  await requireOrgManager(orgId);
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("org_assign_course", { p_cohort: cohortId, p_course: courseId });
  if (error) throw error;
  return data as number;
}
