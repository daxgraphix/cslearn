import Link from "next/link";
import { registerAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
export const metadata = { title: "Create account" };
export default async function Register({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Get started</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
      </div>
      <div className="mb-5"><Flash error={sp.error} notice={sp.notice} /></div>
      {sp.notice ? <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-ink-soft">
          <p className="font-semibold text-ink">Next step: verify your email</p>
          <p className="mt-1">Open the link in your email to activate your account. If it isn’t there in a few minutes, check your spam folder.</p>
        </div>
        <Link href="/login" className="btn-primary w-full">Continue to log in</Link>
      </div> : <form action={registerAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" required minLength={2} autoComplete="name" className="input" placeholder="Your full name" />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@example.com" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password" aria-describedby="password-help" className="input" placeholder="At least 10 characters" />
          <p id="password-help" className="mt-1 text-xs text-ink-faint">Use 10–128 characters. A passphrase is easier to remember and harder to guess.</p>
        </div>
        <input type="hidden" name="locale" value="en" />
        <SubmitButton className="btn-primary w-full" pendingLabel="Creating your account…">Create account</SubmitButton>
      </form>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        {!sp.notice && <span>Already registered? <Link className="text-brand hover:underline" href="/login">Log in</Link></span>}
        <Link className="text-brand hover:underline" href="/">Return home</Link>
      </div>
    </>
  );
}
