import Link from "next/link";
import { myLearning } from "@/services/learning";
import { PageHeader, Stat, Empty } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { getT } from "@/i18n";
export const metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const t = await getT(); const user = await getSessionUser(); const items = await myLearning();
  const active = items.filter((i) => i.status === "active"); const done = items.filter((i) => i.status === "completed");
  const rolePrompts = user?.roles?.includes("instructor")
    ? [{ title: "Teach with confidence", text: "Create a new course and publish a clear learning path for your learners.", href: "/instructor/courses/new" }]
    : user?.roles?.includes("admin") || user?.roles?.includes("owner")
      ? [{ title: "Keep the platform healthy", text: "Review queue health, manage roles, and monitor operations in one place.", href: "/admin/dashboard" }]
      : [{ title: "Choose your next win", text: "Pick a focused course to build momentum and keep your streak going.", href: "/courses" }];
  return (<>
    <PageHeader title={t("nav.dashboard")} subtitle="Your learning progress and recommended next step." actions={<Link className="btn-primary" href="/courses">{t("nav.catalog")}</Link>} />
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="In progress" value={active.length} /><Stat label="Completed" value={done.length} /><Stat label="Total enrolled" value={items.length} /></div>

    <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Next best step</p>
        <h2 className="mt-2 text-xl font-semibold">{rolePrompts[0].title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{rolePrompts[0].text}</p>
        <Link href={rolePrompts[0].href} className="btn-primary mt-4">Continue</Link>
      </div>
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Learning momentum</p>
        <h2 className="mt-2 text-xl font-semibold">{active.length > 0 ? `${active.length} active path${active.length > 1 ? "s" : ""}` : "Ready to begin"}</h2>
        <p className="mt-2 text-sm text-ink-soft">The best progress comes from short, consistent steps. Keep your learning streak alive with one focused lesson today.</p>
      </div>
    </div>

    <h2 className="mb-3 mt-8 text-lg font-semibold">{t("action.continue")}</h2>
    {active.length === 0 ? <Empty title={t("learner.empty")} href="/courses" cta={t("nav.catalog")} /> :
      <div className="grid gap-4 md:grid-cols-2">{active.slice(0, 4).map((e) => (
        <Link key={e.id} href={`/learner/learn/${e.courses.id}`} className="card block p-5 hover:shadow-md">
          <h3 className="font-semibold">{e.course_versions.title}</h3>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuenow={e.progress.pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-brand" style={{ width: `${e.progress.pct}%` }} /></div>
          <p className="mt-2 text-sm text-ink-soft">{e.progress.done} of {e.progress.total} lessons · {e.progress.pct}%</p></Link>))}</div>}
  </>);
}
