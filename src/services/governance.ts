import "server-only";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { requirePermission, requireCourseTeam } from "@/lib/auth";
import { reviewSchema } from "@/lib/validation";
import type { z } from "zod";

export async function submitForReview(versionId: string, note?: string) {
  const supabase = await createSupabase();
  const { data: v } = await supabase.from("course_versions").select("course_id").eq("id", versionId).single();
  if (!v) throw new Error("Version not found");
  await requireCourseTeam(v.course_id);
  await requirePermission("course.submit");
  const { data, error } = await supabase.rpc("submit_version", { p_version: versionId, p_note: note ?? null });
  if (error) throw error;
  return data as string;
}

export async function reviewQueue() {
  const user = await requirePermission("course.review.assigned", "course.review.any");
  const supabase = await createSupabase();
  let q = supabase.from("course_submissions")
    .select("id, created_at, note, assigned_reviewer_id, submitted_by, course_versions(id, title, version_number, course_id, courses(slug))")
    .neq("status", "closed").order("created_at");
  if (!user.permissions.has("course.review.any")) q = q.eq("assigned_reviewer_id", user.id);
  const { data } = await q;
  return data ?? [];
}

export async function assignReviewer(submissionId: string, reviewerId: string) {
  await requirePermission("course.review.any");
  const admin = createAdminSupabase();
  const { data: has } = await admin.rpc("has_permission", { uid: reviewerId, perm: "course.review.assigned" });
  if (!has) throw new Error("User cannot review courses");
  await admin.from("course_submissions").update({ assigned_reviewer_id: reviewerId, status: "in_review" }).eq("id", submissionId);
}

export async function decide(input: z.input<typeof reviewSchema>) {
  const v = reviewSchema.parse(input);
  await requirePermission("course.review.assigned", "course.review.any");
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("review_submission", { p_submission: v.submissionId, p_decision: v.decision, p_summary: v.summary });
  if (error) throw error;
  return data as string;
}

export async function addReviewComment(submissionId: string, lessonId: string | null, body: string) {
  const user = await requirePermission("course.review.assigned", "course.review.any");
  const supabase = await createSupabase();
  const { data: s } = await supabase.from("course_submissions").select("id").eq("id", submissionId).single(); // RLS: visible only if reviewer/author/any
  if (!s) throw new Error("Submission not found");
  const { error } = await createAdminSupabase().from("review_comments").insert({ submission_id: submissionId, lesson_id: lessonId, author_id: user.id, body: body.slice(0, 4000) });
  if (error) throw error;
}

export async function publish(versionId: string) {
  await requirePermission("course.publish");
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("publish_version", { p_version: versionId });
  if (error) throw error;
}

export async function createRevision(courseId: string, summary?: string) {
  await requireCourseTeam(courseId);
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("create_draft_revision", { p_course: courseId, p_summary: summary ?? null });
  if (error) throw error;
  return data as string;
}

export async function getReviewDetail(submissionId: string) {
  await requirePermission("course.review.assigned", "course.review.any");
  const supabase = await createSupabase();
  const { data: sub } = await supabase.from("course_submissions")
    .select("id, note, status, course_versions(*, modules(id, title, position, lessons(id, title, type, position))), review_comments(id, body, lesson_id, created_at)")
    .eq("id", submissionId).single();
  return sub;
}
