import "server-only";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/auth";

export async function claimCertificate(enrollmentId: string) {
  await requireUser();
  const supabase = await createSupabase();
  const { data, error } = await supabase.rpc("issue_certificate", { p_enrollment: enrollmentId });
  if (error) throw error;
  return data as string;
}
export async function revoke(certificateId: string, reason: string) {
  await requirePermission("certificate.revoke");
  const supabase = await createSupabase();
  const { error } = await supabase.rpc("revoke_certificate", { p_certificate: certificateId, p_reason: reason });
  if (error) throw error;
}
export async function verify(serial: string) {
  const supabase = await createSupabase();
  const { data } = await supabase.rpc("verify_certificate", { p_serial: serial.slice(0, 40) });
  return (data as any[] | null)?.[0] ?? null;
}
export async function myCertificates() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data } = await supabase.from("certificates").select("id, serial, course_title, status, issued_at, pdf_path").eq("learner_id", user.id).order("issued_at", { ascending: false });
  return data ?? [];
}
