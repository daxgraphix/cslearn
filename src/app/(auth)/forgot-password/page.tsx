import Link from "next/link";
import { requestPasswordResetAction, verifyRecoveryCodeAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Reset your password" };

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  return <>
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">Request a reset email. If the email link has trouble opening, enter its verification code here instead.</p>
    </div>
    <Flash error={params.error} notice={params.sent ? "If an account matches that email, recovery instructions are on the way. Check your inbox and spam folder." : undefined} />
    <form action={requestPasswordResetAction} className="mt-4 space-y-3">
      <div><label className="label" htmlFor="reset-email">Email</label><input id="reset-email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" /></div>
      <SubmitButton className="btn-primary w-full" pendingLabel="Sending email…">Send reset email</SubmitButton>
    </form>
    <div className="my-6 flex items-center gap-3 text-xs text-ink-faint"><span className="h-px flex-1 bg-surface-line" />Already have a code?<span className="h-px flex-1 bg-surface-line" /></div>
    <form action={verifyRecoveryCodeAction} className="space-y-3">
      <div><label className="label" htmlFor="code-email">Email</label><input id="code-email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" /></div>
      <div><label className="label" htmlFor="recovery-code">Email verification code</label><input id="recovery-code" name="token" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required className="input" placeholder="6-digit code" /></div>
      <SubmitButton className="btn-outline w-full" pendingLabel="Checking code…">Verify code</SubmitButton>
    </form>
    <p className="mt-5 text-sm text-ink-soft"><Link href="/login" className="font-medium text-brand hover:underline">Return to log in</Link></p>
  </>;
}
