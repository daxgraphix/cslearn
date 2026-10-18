import { NextResponse } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const otpTypes = ["signup", "invite", "magiclink", "email", "recovery", "email_change"] as const;
  const otpType = otpTypes.find((candidate) => candidate === type);
  const next = url.searchParams.get("next") ?? "/learner/dashboard";
  const providerError = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  const isRecovery = type === "recovery" || next === "/reset-password";
  const expiredMessage = "This email link has expired or was already used. Request a new reset email, or enter the verification code from your email.";
  const failureUrl = (message: string) => new URL(`${isRecovery ? "/forgot-password" : "/login"}?error=${encodeURIComponent(message)}`, url.origin);
  if (providerError) return NextResponse.redirect(failureUrl(expiredMessage));

  const supabase = await createSupabase();
  let error: Error | null = null;
  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && otpType) {
    const result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
    error = result.error;
  } else {
    return NextResponse.redirect(failureUrl(isRecovery ? "This reset email link is incomplete. Request a new reset email or enter its verification code." : "This email link is incomplete. Request a new link and try again."));
  }
  if (error) return NextResponse.redirect(failureUrl(expiredMessage));

  let destination = new URL("/learner/dashboard", url.origin);
  if (next.startsWith("/") && !next.startsWith("//")) {
    const candidate = new URL(next, url.origin);
    if (candidate.origin === url.origin) destination = candidate;
  }
  return NextResponse.redirect(destination);
}
