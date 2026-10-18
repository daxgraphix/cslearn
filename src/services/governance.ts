import "server-only";
import { createAdminSupabase, createSupabase } from "@/lib/supabase/server";
import { requirePermission, requirePageAccess, requireCourseTeam } from "@/lib/auth";
import { reviewAssignmentSchema, reviewCommentSchema, reviewSchema } from "@/lib/validation";
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
  const user = await requirePageAccess("course.review.assigned", "course.review.any");
  // Staff read is explicitly permission-gated above. Use the server-only client
  // so RLS on course content cannot silently hide submissions from reviewers.
  const supabase = createAdminSupabase();
  let q = supabase.from("course_submissions")
    .select("id, version_id, created_at, note, assigned_reviewer_id, submitted_by")
    .neq("status", "closed").order("created_at");
  if (!user.permissions.has("course.review.any")) q = q.or(`assigned_reviewer_id.is.null,assigned_reviewer_id.eq.${user.id}`);
  const { data, error } = await q;
  if (error) throw error;
  const submissions = (data ?? []) as { id: string; version_id: string; created_at: string; note: string | null; assigned_reviewer_id: string | null; submitted_by: string }[];
  const versionIds = [...new Set(submissions.map((submission) => submission.version_id))];
  if (!versionIds.length) return [];
  const { data: versions, error: versionsError } = await supabase.from("course_versions")
    .select("id, title, version_number, course_id").in("id", versionIds);
  if (versionsError) throw versionsError;
  const versionRows = (versions ?? []) as { id: string; title: string; version_number: number; course_id: string }[];
  const courseIds = [...new Set(versionRows.map((version) => version.course_id))];
  let courseRows: { id: string; slug: string; owner_id: string }[] = [];
  let instructorRows: { course_id: string; user_id: string }[] = [];
  if (courseIds.length) {
    const { data: courses, error: coursesError } = await supabase.from("courses").select("id, slug, owner_id").in("id", courseIds);
    if (coursesError) throw coursesError;
    courseRows = (courses ?? []) as { id: string; slug: string; owner_id: string }[];
    const { data: instructors, error: instructorsError } = await supabase.from("course_instructors").select("course_id, user_id").in("course_id", courseIds);
    if (instructorsError) throw instructorsError;
    instructorRows = (instructors ?? []) as { course_id: string; user_id: string }[];
  }
  const courseById = new Map(courseRows.map((course) => [course.id, {
    ...course,
    course_instructors: instructorRows.filter((instructor) => instructor.course_id === course.id),
  }]));
  const versionById = new Map(versionRows.map((version) => [version.id, {
    ...version, courses: courseById.get(version.course_id),
  }]));
  return submissions.map((submission) => ({ ...submission, course_versions: versionById.get(submission.version_id) }))
    .filter((submission: any) => {
    const course = submission.course_versions?.courses;
    return submission.submitted_by !== user.id && course?.owner_id !== user.id
      && !(course?.course_instructors ?? []).some((instructor: any) => instructor.user_id === user.id);
  });
}

/** Let a reviewer claim only open, unassigned work. The conditional update makes claims race-safe. */
export async function claimReview(submissionId: string) {
  const id = reviewAssignmentSchema.shape.submissionId.parse(submissionId);
  await requirePermission("course.review.assigned");
  const supabase = await createSupabase();
  const { data: claimed, error } = await supabase.rpc("claim_course_review", { p_submission: id });
  if (error) throw error;
  return claimed as string;
}

export async function assignReviewer(submissionId: string, reviewerId: string) {
  const input = reviewAssignmentSchema.parse({ submissionId, reviewerId });
  await requirePermission("course.review.any");
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("assign_course_reviewer", {
    p_submission: input.submissionId,
    p_reviewer: input.reviewerId,
  });
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
  const input = reviewCommentSchema.parse({ submissionId, lessonId, body });
  await requirePermission("course.review.assigned", "course.review.any");
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("add_course_review_comment", {
    p_submission: input.submissionId,
    p_lesson: input.lessonId,
    p_body: input.body,
  });
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
  // Page access failures should be routed to the access explanation, not rendered
  // as an unhandled server error screen.
  const user = await requirePageAccess("course.review.assigned", "course.review.any");
  // This privileged read is safe only after checking queue access, assignment,
  // author identity, and course-team membership below.
  const supabase = createAdminSupabase();
  const { data: submission, error: submissionError } = await supabase.from("course_submissions")
    .select("id, version_id, submitted_by, assigned_reviewer_id, status, note")
    .eq("id", submissionId).maybeSingle();
  if (submissionError) throw submissionError;
  if (!submission || submission.status === "closed") return null;
  const canReviewAny = user.permissions.has("course.review.any");
  if (!canReviewAny && submission.assigned_reviewer_id !== user.id) return null;
  if (submission.submitted_by === user.id) return null;

  const { data: version, error: versionError } = await supabase.from("course_versions")
    .select("id, title, subtitle, description, objectives, prerequisites, accessibility_notes, level, estimated_minutes, pass_mark, status, version_number, course_id")
    .eq("id", submission.version_id).maybeSingle();
  if (versionError) throw versionError;
  if (!version) return null;
  const [{ data: course, error: courseError }, { data: moduleRows, error: modulesError }, { data: comments, error: commentsError }] = await Promise.all([
    supabase.from("courses").select("owner_id, course_instructors(user_id)").eq("id", version.course_id).maybeSingle(),
    supabase.from("modules").select("id, title, description, position").eq("version_id", version.id).order("position"),
    supabase.from("review_comments").select("id, body, lesson_id, created_at").eq("submission_id", submissionId).order("created_at"),
  ]);
  if (courseError) throw courseError;
  if (modulesError) throw modulesError;
  if (commentsError) throw commentsError;
  if (!course || course.owner_id === user.id || (course.course_instructors ?? []).some((instructor: any) => instructor.user_id === user.id)) return null;
  const modules = (moduleRows ?? []) as any[];
  const moduleIds = modules.map((module) => module.id);
  const { data: lessonRows, error: lessonsError } = moduleIds.length
    ? await supabase.from("lessons")
      .select("id, module_id, title, type, position, body, duration_minutes, is_required, lesson_resources(title, kind, url, mime_type, size_bytes), quizzes(pass_mark, max_attempts, time_limit_seconds, questions(id, prompt, type, points, answer_options(label)))")
      .in("module_id", moduleIds).order("position")
    : { data: [], error: null };
  if (lessonsError) throw lessonsError;
  const lessonsByModule = new Map<string, any[]>();
  for (const lesson of lessonRows ?? []) lessonsByModule.set(lesson.module_id, [...(lessonsByModule.get(lesson.module_id) ?? []), lesson]);
  return {
    id: submission.id,
    note: submission.note,
    status: submission.status,
    course_versions: { ...version, modules: modules.map((module) => ({ ...module, lessons: lessonsByModule.get(module.id) ?? [] })) },
    review_comments: comments ?? [],
  };
}
