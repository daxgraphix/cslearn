import { NextResponse } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/learner/dashboard";
  if (code) { const supabase = await createSupabase(); await supabase.auth.exchangeCodeForSession(code); }
  return NextResponse.redirect(new URL(next.startsWith("/") && !next.startsWith("//") ? next : "/learner/dashboard", url.origin));
}
