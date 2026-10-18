import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#f3f8f5] via-white to-[#eef8f4]">
      <header className="border-b border-surface-line/80 bg-white/80">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2.5 text-sm font-semibold text-brand" aria-label="CSGO home">
            <span className="grid h-9 w-11 place-items-center rounded-md border-2 border-ok bg-[#f3f8f5] text-[9px] font-bold tracking-wide">CSGO</span>
            <span className="hidden sm:inline">Learning platform</span>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-4 text-sm text-ink-soft sm:gap-6">
            <Link href="/courses" className="hover:text-brand">Browse courses</Link>
            <Link href="/help" className="hover:text-brand">Help</Link>
            </nav>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-2xl border border-surface-line bg-white shadow-[0_30px_80px_rgba(15,39,35,0.08)] sm:rounded-[28px] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="hidden flex-col justify-between bg-[#17443e] p-8 text-white lg:flex xl:p-10">
            <div>
              <h1 className="max-w-md font-serif text-4xl leading-tight">Learn with purpose. Grow with momentum.</h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-white/75">
                Track progress, earn verifiable credentials, and build skills that lead to confident next steps in work and life.
              </p>
            </div>

            <div className="grid gap-3">
              {[
                "Clear pathways from beginner to job-ready",
                "Trusted assessments and certificate verification",
                "Fast onboarding for learners, teams, and operators",
              ].map((point) => (
                <div key={point} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#f0c77a]" />
                  {point}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center p-5 sm:p-8 lg:py-10">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-surface-line/80 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>CSGO learning platform</span>
          <nav aria-label="Account support" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/verify" className="hover:text-brand">Verify a certificate</Link>
            <Link href="/help" className="hover:text-brand">Help center</Link>
            <Link href="/" className="hover:text-brand">Return home</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
