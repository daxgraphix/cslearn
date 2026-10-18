import "server-only";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

/** Instructor analytics for courses the user teaches (RLS limits rows to those courses). */
export async function instructorAnalytics() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data: courses } = await supabase.from("course_instructors").select("course_id, courses(slug, published_version_id, course_versions!fk_courses_published_version(title))").eq("user_id", user.id);
  const rows = [] as { courseId: string; title: string; enrolled: number; completed: number; avgScore: number | null }[];
  for (const c of (courses ?? []) as any[]) {
    const [{ count: enrolled }, { count: completed }, { data: scores }] = await Promise.all([
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", c.course_id),
      supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("course_id", c.course_id).eq("status", "completed"),
      supabase.from("quiz_attempts").select("score, enrollments!inner(course_id)").eq("enrollments.course_id", c.course_id).eq("status", "submitted"),
    ]);
    const s = (scores ?? []).map((x: any) => Number(x.score)); 
    rows.push({ courseId: c.course_id, title: c.courses?.course_versions?.title ?? c.courses?.slug, enrolled: enrolled ?? 0, completed: completed ?? 0, avgScore: s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null });
  }
  return rows;
}

export { toCsv } from "./reporting.csv";
