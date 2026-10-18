import Link from "next/link";
import { updatePasswordAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Set a new password" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account recovery</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Set a new password</h1>
        <p className="mt-2 text-sm leading-6 text-ink-soft">Choose a new password to secure your account. Use 10–128 characters.</p>
      </div>
      <Flash error={params.error} />
      <form action={updatePasswordAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">New password</label>
          <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required className="input" placeholder="At least 10 characters" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingLabel="Updating password…">Update password</SubmitButton>
      </form>
      <p className="mt-5 text-sm text-ink-soft">Need another reset link? <Link href="/login" className="font-medium text-brand hover:underline">Return to log in</Link></p>
    </>
  );
}