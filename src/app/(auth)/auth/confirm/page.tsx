import Link from "next/link";
import { confirmRecoveryLinkAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";

export const metadata = { title: "Confirm password reset", robots: { index: false, follow: false } };

export default async function ConfirmRecovery({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const params = await searchParams;
  const valid = params.type === "recovery" && Boolean(params.token_hash);
  return <>
    <div className="mb-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Account recovery</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Continue password reset</h1>
      <p className="mt-2 text-sm leading-6 text-ink-soft">Confirm below to verify your email and choose a new password.</p>
    </div>
    {valid ? <form action={confirmRecoveryLinkAction} className="space-y-4">
      <input type="hidden" name="tokenHash" value={params.token_hash} />
      <SubmitButton className="btn-primary w-full" pendingLabel="Verifying…">Continue to new password</SubmitButton>
    </form> : <>
      <Flash error="This reset link is incomplete. Request a new reset email and try again." />
      <Link href="/forgot-password" className="btn-primary mt-4 block w-full text-center">Request a new reset email</Link>
    </>}
  </>;
}
