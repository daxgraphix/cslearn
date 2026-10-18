import Link from "next/link";
import { LayoutDashboard, BookOpen, Tags, Award, Bell, BarChart3, GraduationCap, ClipboardCheck, Inbox, Users, KeyRound,
  ShieldCheck, FileBarChart, Building2, Activity, LifeBuoy, Settings, ListChecks, UserPlus, Layers, ScrollText, Menu } from "lucide-react";
import { getT, type MessageKey } from "@/i18n";
import type { Portal } from "@/lib/permissions";
import { NavLink } from "./NavLink";
import { logoutAction } from "@/app/actions";

type Item = { href: string; key: MessageKey; icon: React.ElementType };
type Section = { title: string; items: Item[] };

const NAV: Record<Portal, Section[]> = {
  learner: [{ title: "Core", items: [
    { href: "/learner/dashboard", key: "nav.dashboard", icon: LayoutDashboard }, { href: "/learner/my-learning", key: "nav.mylearning", icon: BookOpen },
    { href: "/learner/assessments", key: "nav.assessments", icon: ListChecks }, { href: "/learner/certificates", key: "nav.certificates", icon: Award },
    { href: "/learner/notifications", key: "nav.notifications", icon: Bell }, { href: "/learner/settings", key: "nav.settings", icon: Settings },
    { href: "/learner/support", key: "nav.support", icon: LifeBuoy } ] }],
  instructor: [
    { title: "Core", items: [
      { href: "/instructor/dashboard", key: "nav.dashboard", icon: LayoutDashboard }, { href: "/instructor/courses", key: "nav.courses", icon: GraduationCap },
      { href: "/instructor/submissions", key: "nav.submissions", icon: Inbox }, { href: "/instructor/assignments", key: "nav.grading", icon: ClipboardCheck },
      { href: "/learner/notifications", key: "nav.notifications", icon: Bell } ] },
    { title: "Growth", items: [{ href: "/instructor/analytics", key: "nav.analytics", icon: BarChart3 }] }],
  reviewer: [{ title: "Core", items: [
    { href: "/reviewer/dashboard", key: "nav.dashboard", icon: LayoutDashboard }, { href: "/reviewer/queue", key: "nav.queue", icon: Inbox } ] }],
  admin: [
    { title: "Core", items: [
      { href: "/admin/dashboard", key: "nav.dashboard", icon: LayoutDashboard }, { href: "/admin/users", key: "nav.users", icon: Users },
      { href: "/admin/courses", key: "nav.courses", icon: GraduationCap }, { href: "/admin/reviews", key: "nav.queue", icon: Inbox },
      { href: "/admin/categories", key: "nav.categories", icon: Tags }, { href: "/admin/enrollments", key: "nav.enrollments", icon: UserPlus },
      { href: "/admin/certificates", key: "nav.certificates", icon: Award } ] },
    { title: "Growth", items: [
      { href: "/admin/organizations", key: "nav.organizations", icon: Building2 },
      { href: "/admin/reports", key: "nav.reports", icon: FileBarChart } ] },
    { title: "Account", items: [
      { href: "/admin/roles", key: "nav.roles", icon: KeyRound }, { href: "/admin/security", key: "nav.security", icon: ShieldCheck }, { href: "/admin/operations", key: "nav.operations", icon: Activity },
      { href: "/admin/settings", key: "nav.settings", icon: Settings } ] }],
  organization: [{ title: "Core", items: [
    { href: "/organization/dashboard", key: "nav.dashboard", icon: LayoutDashboard }, { href: "/organization/members", key: "nav.members", icon: Users },
    { href: "/organization/cohorts", key: "nav.cohorts", icon: Layers }, { href: "/organization/reports", key: "nav.reports", icon: ScrollText } ] }],
  support: [{ title: "Core", items: [{ href: "/support/queue", key: "nav.support", icon: LifeBuoy }] }],
};
const TITLES: Record<Portal, string> = { learner: "Learner", instructor: "Instructor studio", reviewer: "Reviewer", admin: "Administration", organization: "Organization", support: "Support desk" };

export async function Shell({ portal, portals, name, children }: { portal: Portal; portals: Portal[]; name: string; children: React.ReactNode }) {
  const t = await getT();
  return (
    <div className="flex min-h-screen bg-surface-muted/30">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-surface-line bg-white px-3 py-5 md:flex" aria-label="Primary">
        <Link href="/" className="mb-7 flex items-center gap-2 px-3 text-lg font-semibold text-brand">
          <span className="grid h-8 w-10 place-items-center rounded-md border-2 border-ok text-[9px] font-bold">CSGO</span>{t("app.name")}
        </Link>
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{TITLES[portal]}</p>
        <nav className="flex flex-1 flex-col gap-5">
          {NAV[portal].map((s) => (
            <div key={s.title}>
              <p className="px-3 pb-1 text-xs text-ink-faint">{s.title}</p>
              <ul className="space-y-0.5">{s.items.map((i) => <li key={i.href}><NavLink href={i.href} icon={<i.icon size={18} />} label={t(i.key)} /></li>)}</ul>
            </div>
          ))}
        </nav>
        {portals.length > 1 && (
          <div className="mt-4 border-t border-surface-line pt-3">
            <p className="px-3 pb-1 text-xs font-medium text-ink-faint">Switch workspace</p>
            <ul className="space-y-0.5">{portals.filter((p) => p !== portal).map((p) => <li key={p}><Link className="flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink" href={`/${p === "support" ? "support/queue" : p + "/dashboard"}`}><span>{TITLES[p]}</span><span aria-hidden="true" className="text-ink-faint">↗</span></Link></li>)}</ul>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-surface-line px-3 pt-3 text-sm">
          <span className="truncate text-ink-soft" title={name}>{name}</span>
          <form action={logoutAction}><button className="text-brand hover:underline">{t("nav.logout")}</button></form>
        </div>
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-surface-line bg-white/95 px-4 py-2.5 backdrop-blur md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/" className="grid h-8 w-10 shrink-0 place-items-center rounded-md border-2 border-ok text-[9px] font-bold text-brand" aria-label="CSGO home">CSGO</Link>
            <span className="truncate text-sm font-semibold text-brand">{TITLES[portal]}</span>
          </div>
          <div className="hidden min-w-0 items-center gap-4 md:flex">
            {portals.length > 1 && <details className="relative">
              <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-surface-line px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted" aria-label={`Current workspace: ${TITLES[portal]}. Switch workspace`}>Switch workspace <span className="text-ink-faint">·</span><span className="max-w-32 truncate text-ink-soft">{TITLES[portal]}</span></summary>
              <div className="absolute right-0 top-12 z-30 min-w-56 rounded-xl border border-surface-line bg-white p-2 shadow-card">
                {portals.filter((p) => p !== portal).map((p) => <Link key={p} className="block rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-surface-muted hover:text-ink" href={`/${p === "support" ? "support/queue" : p + "/dashboard"}`}>{TITLES[p]}</Link>)}
              </div>
            </details>}
            <span className="max-w-56 truncate text-sm text-ink-soft" title={name}>{name}</span>
            <form action={logoutAction}><button className="btn-outline py-2">{t("nav.logout")}</button></form>
          </div>
          <details className="relative md:hidden">
            <summary aria-label={`Open ${TITLES[portal]} navigation`} className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-surface-muted"><Menu size={18} aria-hidden="true" />Menu</summary>
            <div className="absolute right-0 top-12 z-30 max-h-[80vh] w-72 overflow-y-auto rounded-lg border border-surface-line bg-white p-3 shadow-card">
              <nav aria-label="Primary">
                {NAV[portal].map((section) => <section key={section.title} className="mb-4 last:mb-0">
                  <p className="px-3 pb-1 text-xs text-ink-faint">{section.title}</p>
                  <ul className="space-y-0.5">{section.items.map((item) => <li key={item.href}><NavLink href={item.href} icon={<item.icon size={18} />} label={t(item.key)} /></li>)}</ul>
                </section>)}
              </nav>
              {portals.length > 1 && <div className="mt-3 border-t border-surface-line pt-3">
                <p className="px-3 pb-1 text-xs text-ink-faint">Switch workspace</p>
                {portals.filter((p) => p !== portal).map((p) => <Link key={p} className="block rounded-lg px-3 py-1.5 text-sm text-ink-soft hover:bg-surface-muted" href={`/${p === "support" ? "support/queue" : p + "/dashboard"}`}>{TITLES[p]}</Link>)}
              </div>}
              <div className="mt-3 flex items-center justify-between border-t border-surface-line px-3 pt-3 text-sm">
                <span className="truncate text-ink-soft" title={name}>{name}</span>
                <form action={logoutAction}><button className="text-brand hover:underline">{t("nav.logout")}</button></form>
              </div>
            </div>
          </details>
        </header>
        <main id="main" className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 p-4 md:p-8">{children}</main>
        <footer className="mt-auto border-t border-surface-line bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between md:px-8">
            <span>CSGO · {TITLES[portal]} workspace</span>
            <nav aria-label="Workspace footer" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href={`/${portal === "support" ? "support/queue" : portal + "/dashboard"}`} className="hover:text-brand">Workspace home</Link>
              <Link href="/courses" className="hover:text-brand">Course catalog</Link>
              <Link href="/help" className="hover:text-brand">Help center</Link>
              <Link href="/" className="hover:text-brand">Public site</Link>
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
