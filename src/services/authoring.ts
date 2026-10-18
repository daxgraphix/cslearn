import "server-only";
import { createSupabase } from "@/lib/supabase/server";
import { ForbiddenError, requireCourseTeam, requirePermission } from "@/lib/auth";
import { courseMetaSchema, createCourseSchema, lessonSchema, moduleSchema, questionSchema } from "@/lib/validation";
import { createAdminSupabase } from "@/lib/supabase/server";
import type { z } from "zod";

async function versionCourseId(versionId: string) {
  const supabase = await createSupabase();
  const { data } = await supabase.from("course_versions").select("course_id, status").eq("id", versionId).single();
  if (!data) throw new Error("Version not found");
  return data;
}

export async function createCourse(input: z.input<typeof createCourseSchema>) {
  const user = await requirePermission("course.create");
  if (!user.permissions.has("course.update.own") && !user.permissions.has("course.update.any")) {
    throw new ForbiddenError("Course creation also requires permission to edit course drafts.");
  }
  const v = createCourseSchema.parse(input);
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("create_course", { p_title: v.title, p_slug: v.slug, p_category: v.categoryId || null });
  if (error) throw error;
  return data as string;
}

export async function updateMeta(input: z.input<typeof courseMetaSchema>) {
  const v = courseMetaSchema.parse(input);
  await requireCourseTeam(v.courseId);
  const supabase = await createSupabase();
  const { error } = await supabase.from("course_versions").update({
    title: v.title, subtitle: v.subtitle, description: v.description, objectives: v.objectives, prerequisites: v.prerequisites,
    language: v.language, level: v.level, estimated_minutes: v.estimatedMinutes, enrollment_policy: v.enrollmentPolicy,
    price_cents: 0, pass_mark: v.passMark, certificate_enabled: v.certificateEnabled,
    seo_title: v.seoTitle, seo_description: v.seoDescription,
  }).eq("id", v.versionId); // RLS: only draft / changes_requested versions of own courses
  if (error) throw error;
}

export async function addModule(input: z.input<typeof moduleSchema>) {
  const v = moduleSchema.parse(input);
  const { course_id } = await versionCourseId(v.versionId);
  await requireCourseTeam(course_id);
  const supabase = await createSupabase();
  const { data: last } = await supabase.from("modules").select("position").eq("version_id", v.versionId).order("position", { ascending: false }).limit(1);
  const { error } = await supabase.from("modules").insert({ version_id: v.versionId, title: v.title, description: v.description, position: (last?.[0]?.position ?? -1) + 1 });
  if (error) throw error;
}

export async function deleteModule(moduleId: string) {
  const supabase = await createSupabase();
  const { error } = await supabase.from("modules").delete().eq("id", moduleId); // RLS blocks non-editable versions
  if (error) throw error;
}

export async function addLesson(input: z.input<typeof lessonSchema>) {
  const v = lessonSchema.parse(input);
  const supabase = await createSupabase();
  const { data: last } = await supabase.from("lessons").select("position").eq("module_id", v.moduleId).order("position", { ascending: false }).limit(1);
  const body = v.type === "text" ? { html: v.text ?? "" } : v.url ? { url: v.url } : {};
  const completion = v.type === "quiz" ? { mode: "quiz_pass" } : v.type === "video" ? { mode: "watch_percent", threshold: 90 }
    : v.type === "assignment" ? { mode: "submission" } : v.type === "live" ? { mode: "attendance" } : { mode: "manual" };
  const { data: lesson, error } = await supabase.from("lessons").insert({
    module_id: v.moduleId, title: v.title, type: v.type, duration_minutes: v.durationMinutes, is_required: v.isRequired,
    body, completion_rule: completion, position: (last?.[0]?.position ?? -1) + 1,
  }).select("id").single();
  if (error) throw error;
  if (v.type === "quiz") await supabase.from("quizzes").insert({ lesson_id: lesson.id });
  if (v.type === "assignment") await supabase.from("assignments").insert({ lesson_id: lesson.id });
  return lesson.id as string;
}

export async function deleteLesson(lessonId: string) {
  const supabase = await createSupabase();
  const { error } = await supabase.from("lessons").delete().eq("id", lessonId);
  if (error) throw error;
}

/** Swap a lesson/module with its neighbour. Uniqueness is DEFERRABLE so a swap inside one transaction is safe. */
export async function moveItem(table: "modules" | "lessons", id: string, dir: "up" | "down") {
  const supabase = await createSupabase();
  const { data: cur } = await supabase.from(table).select("*").eq("id", id).single();
  if (!cur) return;
  const parentCol = table === "modules" ? "version_id" : "module_id";
  const { data: sibs } = await supabase.from(table).select("id, position").eq(parentCol, (cur as any)[parentCol]).order("position");
  const i = (sibs ?? []).findIndex((s) => s.id === id); const j = dir === "up" ? i - 1 : i + 1;
  if (!sibs || j < 0 || j >= sibs.length) return;
  const { error } = await supabase.rpc("swap_positions", { p_table: table, p_a: sibs[i].id, p_b: sibs[j].id });
  if (error) throw error;
}

/** Answer keys have no browser grants, so questions are written via the service role AFTER ownership is verified. */
export async function addQuestion(input: z.input<typeof questionSchema>) {
  const v = questionSchema.parse(input);
  const supabase = await createSupabase();
  const { data: quiz } = await supabase.from("quizzes").select("id, lesson_id").eq("id", v.quizId).single(); // RLS: editable only
  if (!quiz) throw new Error("Quiz is not editable");
  const { data: last } = await supabase.from("questions").select("position").eq("quiz_id", v.quizId).order("position", { ascending: false }).limit(1);
  const admin = createAdminSupabase();
  const { data: q, error } = await admin.from("questions").insert({ quiz_id: v.quizId, type: v.type, prompt: v.prompt, points: v.points, position: (last?.[0]?.position ?? -1) + 1 }).select("id").single();
  if (error) throw error;
  if (v.type === "short_text") {
    await admin.from("short_answer_keys").insert({ question_id: q.id, accepted: v.accepted });
  } else {
    const opts = v.type === "true_false" && v.options.length === 0
      ? [{ label: "True", correct: false }, { label: "False", correct: false }] : v.options;
    for (const [i, o] of opts.entries()) {
      const { data: opt } = await admin.from("answer_options").insert({ question_id: q.id, label: o.label, position: i }).select("id").single();
      await admin.from("answer_keys").insert({ option_id: opt!.id, is_correct: o.correct });
    }
  }
}

export async function validateVersion(versionId: string) {
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("validate_version", { p_version: versionId });
  if (error) throw error;
  return (data ?? []) as { code: string; message: string }[];
}

export async function getBuilderData(courseId: string) {
  await requireCourseTeam(courseId);
  const supabase = await createSupabase();
  const { data: course } = await supabase.from("courses").select("id, slug, published_version_id").eq("id", courseId).single();
  const { data: versions } = await supabase.from("course_versions").select("*").eq("course_id", courseId).order("version_number", { ascending: false });
  const working = (versions ?? []).find((v) => ["draft", "changes_requested", "in_review", "approved"].includes(v.status)) ?? versions?.[0];
  if (!working) return null;
  const { data: modules } = await supabase.from("modules")
    .select("id, title, description, position, lessons(id, title, type, position, duration_minutes, is_required, quizzes(id, questions(id)))")
    .eq("version_id", working.id).order("position");
  const { data: feedback } = await supabase.from("course_submissions")
    .select("id, created_at, course_reviews(decision, summary, created_at)").eq("version_id", working.id).order("created_at", { ascending: false });
  return { course, version: working, modules: modules ?? [], feedback: feedback ?? [] };
}
