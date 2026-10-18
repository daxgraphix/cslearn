import Link from "next/link";
import { Menu } from "lucide-react";
import { getT } from "@/i18n";
import { getSessionUser } from "@/lib/auth";
import { defaultWorkspacePath, portalsFor } from "@/lib/permissions";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const t = await getT(); const user = await getSessionUser().catch(() => null);
  const portals = user ? portalsFor(user.roles, user.permissions, user.orgManagerOf.length > 0) : [];
  const dashboardHref = defaultWorkspacePath(portals);
  return (
    <div className="flex min-h-screen flex-col bg-[#fbfcfb]">
      <header className="sticky top-0 z-40 border-b border-surface-line/80 bg-white/95 shadow-[0_4px_18px_rgba(23,45,39,0.04)] backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href={user ? dashboardHref : "/"} className="flex shrink-0 items-center gap-2.5 text-base font-semibold text-brand" aria-label={user ? `${t("app.name")} workspace` : `${t("app.name")} home`}>
            <span className="grid h-9 w-11 place-items-center rounded-md border-2 border-ok bg-[#f3f8f5] text-[9px] font-bold tracking-wide">CSGO</span>
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-5 text-sm font-medium text-ink-soft lg:flex xl:gap-7">
            <Link href="/courses" className="transition-colors hover:text-brand">{t("nav.catalog")}</Link>
            <Link href="/learning-paths" className="transition-colors hover:text-brand">{t("nav.paths")}</Link>
            <Link href="/about" className="transition-colors hover:text-brand">{t("nav.about")}</Link>
            <Link href="/help" className="transition-colors hover:text-brand">{t("nav.help")}</Link>
            <Link href="/verify" className="transition-colors hover:text-brand">{t("cert.verify")}</Link>
          </nav>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              {user ? <Link className="btn-primary" href={dashboardHref}>{t("nav.dashboard")}</Link> : <>
                <Link className="btn-ghost" href="/login">{t("nav.login")}</Link>
                <Link className="btn-primary" href="/register">{t("nav.register")}</Link>
              </>}
            </div>
            <details className="relative lg:hidden">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-medium text-ink hover:bg-surface-muted">
                <Menu size={18} aria-hidden="true" /><span className="sr-only">Open navigation menu</span>
              </summary>
              <nav aria-label="Main" className="absolute right-0 top-12 z-30 flex w-60 flex-col rounded-lg border border-surface-line bg-white p-2 shadow-card">
                <Link href="/courses" className="rounded-md px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-muted">{t("nav.catalog")}</Link>
                <Link href="/learning-paths" className="rounded-md px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-muted">{t("nav.paths")}</Link>
                <Link href="/about" className="rounded-md px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-muted">{t("nav.about")}</Link>
                <Link href="/help" className="rounded-md px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-muted">{t("nav.help")}</Link>
                <Link href="/verify" className="rounded-md px-3 py-2.5 text-sm text-ink-soft hover:bg-surface-muted">{t("cert.verify")}</Link>
                <div className="mt-2 border-t border-surface-line pt-2 sm:hidden">
                  {user ? <Link className="btn-primary w-full" href={dashboardHref}>{t("nav.dashboard")}</Link> : <div className="grid gap-1">
                    <Link className="btn-ghost justify-start" href="/login">{t("nav.login")}</Link>
                    <Link className="btn-primary" href="/register">{t("nav.register")}</Link>
                  </div>}
                </div>
              </nav>
            </details>
            <div className="sm:hidden">
              {user ? <Link className="btn-primary px-3" href={dashboardHref}>{t("nav.dashboard")}</Link> : <Link className="btn-primary px-3" href="/register">{t("nav.register")}</Link>}
            </div>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">{children}</main>
      <footer className="mt-auto bg-[#173a35] text-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.5fr_1fr_1fr_1fr] lg:gap-8 lg:px-8 lg:py-12">
          <div className="col-span-2 lg:col-span-1">
            <Link href={user ? dashboardHref : "/"} className="inline-flex items-center gap-2.5 text-base font-semibold text-white">
              <span className="grid h-9 w-11 place-items-center rounded-md border border-white/40 text-[9px] font-bold tracking-wide">CSGO</span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-white/70 lg:mt-4">Learn with purpose, demonstrate what you know, and earn credentials anyone can verify.</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f0c77a]">Explore</h2>
            <ul className="mt-2 space-y-2 text-sm text-white/75 lg:mt-3">
              <li><Link className="hover:text-white" href="/courses">{t("nav.catalog")}</Link></li>
              <li><Link className="hover:text-white" href="/learning-paths">{t("nav.paths")}</Link></li>
              <li><Link className="hover:text-white" href="/about">{t("nav.about")}</Link></li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f0c77a]">Support</h2>
            <ul className="mt-2 space-y-2 text-sm text-white/75 lg:mt-3">
              <li><Link className="hover:text-white" href="/help">{t("nav.help")}</Link></li>
              <li><Link className="hover:text-white" href="/verify">{t("cert.verify")}</Link></li>
            </ul>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f0c77a]">Get started</h2>
            <p className="mt-2 text-sm leading-6 text-white/70 lg:mt-3">Find a course and take your next step with confidence.</p>
            <Link href="/courses" className="mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#f0c77a] px-4 text-sm font-semibold text-[#173a35] transition-colors hover:bg-[#f6d99e] lg:mt-4">Browse courses</Link>
          </div>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 lg:py-4">
            <span>CSGO learning platform</span>
            <span>Learn, get assessed, and earn certificates that anyone can verify.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
