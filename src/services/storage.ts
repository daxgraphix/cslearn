import "server-only";
import { createAdminSupabase, createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { safeFileName, validateUpload } from "@/lib/validation";

const TTL = Math.min(Number(process.env.SIGNED_URL_TTL ?? 300), 900);

/** Learner assignment upload into a private bucket under their own folder. */
export async function uploadAssignment(assignmentId: string, enrollmentId: string, file: File) {
  const user = await requireUser();
  const err = validateUpload("assignments", file);
  if (err) throw new Error(err);
  const supabase = await createSupabase();
  const { data: e } = await supabase.from("enrollments").select("id").eq("id", enrollmentId).eq("learner_id", user.id).in("status", ["active", "completed"]).maybeSingle();
  if (!e) throw new Error("Not enrolled");
  const path = `${user.id}/${assignmentId}/${Date.now()}-${safeFileName(file.name)}`;
  const { error } = await supabase.storage.from("assignments").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { error: se } = await supabase.from("submissions").upsert({ assignment_id: assignmentId, enrollment_id: enrollmentId, learner_id: user.id, file_path: path }, { onConflict: "assignment_id,learner_id" });
  if (se) throw se;
}

/** Signed URL for a course resource, issued only after enrollment/team authorization. */
export async function signedResourceUrl(resourceId: string) {
  const user = await requireUser();
  const supabase = await createSupabase();
  // RLS on lesson_resources already limits rows to readable versions (enrolled / team / reviewer)
  const { data: r } = await supabase.from("lesson_resources").select("storage_path, lessons(modules(course_versions(course_id)))").eq("id", resourceId).single();
  if (!r?.storage_path) return null;
  const { data } = await createAdminSupabase().storage.from("course-private").createSignedUrl(r.storage_path, TTL, { download: true });
  void user;
  return data?.signedUrl ?? null;
}

/** Instructors read learner submissions through signed URLs after verifying they teach the course. */
export async function signedSubmissionUrl(submissionId: string) {
  await requireUser();
  const supabase = await createSupabase();
  const { data: s } = await supabase.from("submissions").select("file_path").eq("id", submissionId).single(); // RLS: learner or course instructor
  if (!s?.file_path) return null;
  const { data } = await createAdminSupabase().storage.from("assignments").createSignedUrl(s.file_path, TTL);
  return data?.signedUrl ?? null;
}
