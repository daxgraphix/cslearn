"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";

export default function ReviewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="card mx-auto mt-8 max-w-2xl border border-amber-200 p-6 sm:p-8" role="alert">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Review queue unavailable</p>
    <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">The review queue couldn’t load</h1>
    <p className="mt-2 text-sm leading-6 text-ink-soft">Your course submissions are safe. Try loading the queue again, or return to the admin dashboard.</p>
    <div className="mt-5 flex flex-wrap gap-2">
      <button onClick={reset} className="btn-primary"><RotateCcw size={16} aria-hidden="true" />Try again</button>
      <Link href="/admin/dashboard" className="btn-outline">Return to dashboard</Link>
    </div>
  </section>;
}
