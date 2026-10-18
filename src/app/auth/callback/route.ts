import { NextResponse } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/learner/dashboard";
  if (!code) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("This sign-in link is incomplete. Request a new link and try again.")}`, url.origin));

  const supabase = await createSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("This link has expired or was already used. Request a new one and try again.")}`, url.origin));

  let destination = new URL("/learner/dashboard", url.origin);
  if (next.startsWith("/") && !next.startsWith("//")) {
    const candidate = new URL(next, url.origin);
    if (candidate.origin === url.origin) destination = candidate;
  }
  return NextResponse.redirect(destination);
}
