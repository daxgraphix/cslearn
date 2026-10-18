import Link from "next/link";
import { updatePasswordAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { PasswordField } from "@/components/PasswordField";
import { createSupabase } from "@/lib/supabase/server";

export const metadata = { title: "Set a new password" };

export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { data: { user } } = await (await createSupabase()).auth.getUser();
  if (!user) return <>
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Open your reset link</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">Use the latest password reset email to continue. Reset links expire after a short time and can only be used once.</p>
    </div>
    <Flash error={params.error ?? "This reset link is missing or has expired. Request a new one to continue."} />
    <Link href="/forgot-password" className="btn-primary mt-4 block w-full text-center">Request a new reset email</Link>
    <p className="mt-4 text-center text-sm"><Link href="/login" className="font-medium text-brand hover:underline">Return to log in</Link></p>
  </>;
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
          <PasswordField id="password" name="password" autoComplete="new-password" minLength={10} maxLength={128} placeholder="At least 10 characters" />
          <p className="mt-1 text-xs text-ink-faint">Use 10–128 characters.</p>
        </div>
        <div>
          <label className="label" htmlFor="confirmPassword">Confirm new password</label>
          <PasswordField id="confirmPassword" name="confirmPassword" autoComplete="new-password" minLength={10} maxLength={128} placeholder="Enter the new password again" />
        </div>
        <SubmitButton className="btn-primary w-full" pendingLabel="Updating password…">Update password</SubmitButton>
      </form>
      <p className="mt-5 text-sm text-ink-soft">Need another reset link? <Link href="/login" className="font-medium text-brand hover:underline">Return to log in</Link></p>
    </>
  );
}
