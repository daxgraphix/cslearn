import "server-only";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { courseProgress } from "@/lib/grading";
import { z } from "zod";
import { answersSchema } from "@/lib/validation";

export async function enroll(courseId: string) {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("enroll_self", { p_course: courseId });
  if (error) throw error;
  return data as string;
}

export async function myLearning() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: enrollments } = await supabase.from("enrollments")
    .select("id, status, enrolled_at, completed_at, version_id, courses(id, slug), course_versions(title, thumbnail_path)")
    .eq("learner_id", user.id).order("enrolled_at", { ascending: false });
  const out = [] as any[];
  for (const e of (enrollments ?? []) as any[]) {
    const { data: required } = await supabase.from("lessons").select("id, modules!inner(version_id)").eq("modules.version_id", e.version_id).eq("is_required", true);
    const { data: done } = await supabase.from("lesson_progress").select("lesson_id").eq("enrollment_id", e.id).eq("status", "completed");
    out.push({ ...e, progress: courseProgress((required ?? []).map((r) => r.id), new Set((done ?? []).map((d) => d.lesson_id))) });
  }
  return out;
}

/** Course player payload: re-verifies enrollment server-side and never includes answer keys. */
export async function getPlayer(courseId: string) {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: enrollment } = await supabase.from("enrollments").select("id, status, version_id, expires_at").eq("learner_id", user.id).eq("course_id", courseId).maybeSingle();
  if (!enrollment || !["active", "completed"].includes(enrollment.status) || (enrollment.expires_at && new Date(enrollment.expires_at) < new Date())) return null;
  const { data: version } = await supabase.from("course_versions")
    .select("id, title, modules(id, title, position, lessons(id, title, type, position, body, duration_minutes, is_required, lesson_resources(id, title, kind), quizzes(id, time_limit_seconds, max_attempts, pass_mark, instructions, questions(id, prompt, type, points, position, answer_options(id, label, position)))))")
    .eq("id", enrollment.version_id).single();
  const { data: progress } = await supabase.from("lesson_progress").select("lesson_id, status, watched_percent, last_position_seconds").eq("enrollment_id", enrollment.id);
  return { enrollment, version, progress: progress ?? [] };
}

export async function markComplete(enrollmentId: string, lessonId: string, percent = 100) {
  await requireUser();
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("complete_lesson", { p_enrollment: enrollmentId, p_lesson: lessonId, p_percent: percent });
  if (error) throw error;
}

export async function startAttempt(enrollmentId: string, quizId: string) {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_enrollment: enrollmentId, p_quiz: quizId });
  if (error) throw error;
  return data as string;
}

export async function submitAttempt(attemptId: string, answers: z.input<typeof answersSchema>) {
  await requireUser();
  const parsed = answersSchema.parse(answers);
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_attempt: attemptId, p_answers: parsed });
  if (error) throw error;
  return (data as any[])[0] as { score: number; passed: boolean; show_results: string };
}
