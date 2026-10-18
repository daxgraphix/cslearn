import { NextResponse } from "next/server";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

/** Authorizes ownership via RLS, then redirects to a short-lived signed URL. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") return NextResponse.redirect(new URL("/login", _.url));
  const { data: c } = await (await createSupabase()).from("certificates").select("id, pdf_path, status, serial").eq("id", (await params).id).maybeSingle();
  if (!c || c.status !== "valid" || !c.pdf_path) return NextResponse.json({ error: "Not available" }, { status: 404 });
  const { data } = await createAdminSupabase().storage.from("certificates").createSignedUrl(c.pdf_path, 120, { download: `${c.serial}.pdf` });
  await createAdminSupabase().from("certificate_events").insert({ certificate_id: c.id, action: "downloaded", actor_id: user.id });
  return NextResponse.redirect(data!.signedUrl);
}
