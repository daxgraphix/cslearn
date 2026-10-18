"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function UsersError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card mx-auto mt-8 max-w-2xl border border-amber-200 p-6 sm:p-8" role="alert">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Users could not load</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">The user directory is temporarily unavailable</h1>
    <p className="mt-2 text-sm leading-6 text-ink-soft">Your account and user records are safe. Try again. If the issue continues, check the Supabase connection and server-side service role configuration.</p>
    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={reset} className="btn-primary"><RotateCcw size={16} aria-hidden="true" />Try again</button>
      <Link href="/admin/dashboard" className="btn-outline">Return to dashboard</Link>
    </div>
  </section>;
}
