import Link from "next/link";
import { loginAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordField } from "@/components/PasswordField";
export const metadata = { title: "Log in" };
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; next?: string }> }) {
  const sp = await searchParams;
  return <>
    <div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Welcome back</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Log in to continue</h1><p className="mt-2 text-sm leading-6 text-ink-soft">Sign in to continue learning, manage your courses, or review a submission.</p></div>
    <div className="mb-5"><Flash error={sp.error} notice={sp.notice} /></div>
    <form action={loginAction} className="space-y-4">
      <input type="hidden" name="next" value={sp.next ?? ""} />
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" /></div>
      <div><label className="label" htmlFor="password">Password</label><PasswordField id="password" name="password" autoComplete="current-password" placeholder="Enter your password" /></div>
      <SubmitButton className="btn-primary w-full" pendingLabel="Signing in…">Log in</SubmitButton>
    </form>
    <div className="mt-4 flex items-center justify-between gap-2 text-sm text-ink-soft"><Link href="/courses" className="text-brand hover:underline">Browse courses</Link><Link href={sp.next ? `/register?next=${encodeURIComponent(sp.next)}` : "/register"} className="text-brand hover:underline">Create account</Link></div>
    <p className="mt-4 text-center text-sm"><Link href="/forgot-password" className="font-medium text-brand hover:underline">Forgot your password?</Link></p>
  </>;
}
