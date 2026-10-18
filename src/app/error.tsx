"use client";
import { CircleAlert, Home, RotateCcw } from "lucide-react";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-surface-muted/60 p-4">
      <section className="card w-full max-w-lg border border-surface-line p-6 text-center sm:p-8" aria-labelledby="error-title">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-danger"><CircleAlert size={24} aria-hidden="true" /></span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-danger">Temporary issue</p>
        <h1 id="error-title" className="mt-2 text-2xl font-semibold tracking-tight">This page didn’t load</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-soft">Your account and progress are safe. Try loading the page again, or return to the home page and continue from there.</p>
        {error.digest && <p className="mt-4 text-xs text-ink-faint">Support reference: <code className="font-mono">{error.digest}</code></p>}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button onClick={reset} className="btn-primary"><RotateCcw size={16} aria-hidden="true" />Try again</button>
          <a href="/" className="btn-outline"><Home size={16} aria-hidden="true" />Return home</a>
        </div>
      </section>
    </main>
  );
}
