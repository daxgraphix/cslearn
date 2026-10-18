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
  const admin = createAdminSupabase();
  let q = admin.from("course_submissions")
    .select("id, created_at, note, assigned_reviewer_id, submitted_by, course_versions(id, title, version_number, course_id, courses(slug, owner_id, course_instructors(user_id)))")
    .neq("status", "closed").order("created_at");
  if (!user.permissions.has("course.review.any")) q = q.or(`assigned_reviewer_id.is.null,assigned_reviewer_id.eq.${user.id}`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).filter((submission: any) => {
    const course = submission.course_versions?.courses;
    return submission.submitted_by !== user.id && course?.owner_id !== user.id
      && !(course?.course_instructors ?? []).some((instructor: any) => instructor.user_id === user.id);
  });
}

/** Let a reviewer claim only open, unassigned work. The conditional update makes claims race-safe. */
export async function claimReview(submissionId: string) {
  const user = await requirePermission("course.review.assigned");
  const admin = createAdminSupabase();
  const { data: submission, error: submissionError } = await admin.from("course_submissions")
    .select("id, status, assigned_reviewer_id, submitted_by, version_id").eq("id", submissionId).maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission || submission.status === "closed") throw new Error("This review is no longer open.");
  if (submission.assigned_reviewer_id) throw new Error("This review has already been assigned.");
  if (submission.submitted_by === user.id) throw new Error("You cannot review a course you submitted.");

  const { data: version, error: versionError } = await admin.from("course_versions").select("course_id").eq("id", submission.version_id).single();
  if (versionError) throw versionError;
  if (!version) throw new Error("This course version could not be found.");
  const [{ data: course, error: courseError }, { data: membership, error: membershipError }] = await Promise.all([
    admin.from("courses").select("owner_id").eq("id", version.course_id).single(),
    admin.from("course_instructors").select("user_id").eq("course_id", version.course_id).eq("user_id", user.id).maybeSingle(),
  ]);
  if (courseError) throw courseError;
  if (!course) throw new Error("This course could not be found.");
  if (membershipError) throw membershipError;
  if (course.owner_id === user.id || membership) throw new Error("You cannot review a course you authored.");

  const { data: claimed, error } = await admin.from("course_submissions")
    .update({ assigned_reviewer_id: user.id, status: "in_review" })
    .eq("id", submissionId).is("assigned_reviewer_id", null).neq("status", "closed").select("id").maybeSingle();
  if (error) throw error;
  if (!claimed) throw new Error("This review was claimed by someone else. Refresh the queue to see the latest assignments.");
  await admin.rpc("write_audit", { p_actor: user.id, p_action: "course.review_claimed", p_type: "course_submission", p_id: submissionId, p_meta: { course_id: version.course_id } });
  return claimed.id;
}

export async function assignReviewer(submissionId: string, reviewerId: string) {
  await requirePermission("course.review.any");
  const admin = createAdminSupabase();
  const { data: has } = await admin.rpc("has_permission", { uid: reviewerId, perm: "course.review.assigned" });
  if (!has) throw new Error("User cannot review courses");
  const { error } = await admin.from("course_submissions").update({ assigned_reviewer_id: reviewerId, status: "in_review" }).eq("id", submissionId);
  if (error) throw error;
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
  const user = await requirePermission("course.review.assigned", "course.review.any");
  const admin = createAdminSupabase();
  const { data: submission, error: submissionError } = await admin.from("course_submissions")
    .select("id, version_id, submitted_by, assigned_reviewer_id, status, note")
    .eq("id", submissionId).maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission || submission.status === "closed") return null;
  const canReviewAny = user.permissions.has("course.review.any");
  if (!canReviewAny && submission.assigned_reviewer_id !== user.id) return null;
  if (submission.submitted_by === user.id) return null;

  const { data: version, error: versionError } = await admin.from("course_versions")
    .select("id, title, status, version_number, course_id, modules(id, title, position, lessons(id, title, type, position))")
    .eq("id", submission.version_id).maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;
  const { data: course, error: courseError } = await admin.from("courses")
    .select("owner_id, course_instructors(user_id)").eq("id", version.course_id).maybeSingle();
  if (courseError) throw courseError;
  if (!course || course.owner_id === user.id || (course.course_instructors ?? []).some((instructor: any) => instructor.user_id === user.id)) return null;

  const { data: comments, error: commentsError } = await admin.from("review_comments")
    .select("id, body, lesson_id, created_at").eq("submission_id", submissionId).order("created_at");
  if (commentsError) throw commentsError;
  return { id: submission.id, note: submission.note, status: submission.status, course_versions: version, review_comments: comments ?? [] };
}
