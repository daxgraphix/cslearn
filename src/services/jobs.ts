import "server-only";
import { createAdminSupabase } from "@/lib/supabase/server";

type Handler = (payload: any) => Promise<void>;

/** Register handlers per job kind. Real email/PDF providers plug in here. */
const handlers: Record<string, Handler> = {
  async send_email(p) { console.log("[email]", p.to, p.subject); /* integrate Resend/Postmark/SES */ },
  async generate_certificate_pdf(p) {
    const admin = createAdminSupabase();
    const { data: c } = await admin.from("certificates").select("id, serial, learner_name, course_title, issued_at").eq("id", p.certificate_id).single();
    if (!c) return;
    const { renderCertificatePdf } = await import("@/lib/certificate-pdf");
    const bytes = renderCertificatePdf(c);
    const path = `${c.id}/${c.serial}.pdf`;
    const { error } = await admin.storage.from("certificates").upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw error;
    await admin.from("certificates").update({ pdf_path: path }).eq("id", c.id);
  },
};

export async function runJobs(limit = 10) {
  const admin = createAdminSupabase();
  await admin.rpc("release_scheduled_versions");
  const { data: jobs } = await admin.rpc("claim_jobs", { p_limit: limit });
  let ok = 0, failed = 0;
  for (const j of (jobs ?? []) as any[]) {
    try {
      const h = handlers[j.kind]; if (!h) throw new Error(`No handler for ${j.kind}`);
      await h(j.payload); await admin.rpc("finish_job", { p_job: j.id, p_ok: true }); ok++;
    } catch (e: any) { await admin.rpc("finish_job", { p_job: j.id, p_ok: false, p_error: String(e?.message ?? e).slice(0, 500) }); failed++; }
  }
  return { ok, failed };
}
