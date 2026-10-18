import Link from "next/link";
import { loginAction, requestPasswordResetAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
export const metadata = { title: "Log in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Log in to continue</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">Sign in to pick up where you left off. New here? Create an account to get started.</p>
      </div>
      <div className="mb-5"><Flash error={sp.error} notice={sp.notice} /></div>
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="input" placeholder="••••••••••" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingLabel="Signing in…">Log in</SubmitButton>
      </form>

      <div className="mt-4 flex items-center justify-between gap-2 text-sm text-ink-soft">
        <Link href="/courses" className="text-brand hover:underline">Browse courses</Link>
        <Link href="/register" className="text-brand hover:underline">Create account</Link>
      </div>

      <details className="mt-4 rounded-xl border border-surface-line bg-surface-muted/60 p-3 text-sm">
        <summary className="cursor-pointer text-brand">Forgot password?</summary>
        <p className="mt-2 text-xs leading-5 text-ink-soft">Enter your account email. We’ll show a neutral confirmation either way.</p>
        <form action={requestPasswordResetAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input name="email" type="email" required autoComplete="email" className="input min-w-0 flex-1" placeholder="Your email" aria-label="Recovery email" />
          <SubmitButton className="btn-outline shrink-0" pendingLabel="Sending…">Send reset link</SubmitButton>
        </form>
      </details>
    </>
  );
}
