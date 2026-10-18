import Link from "next/link";
import { myLearning } from "@/services/learning";
import { PageHeader, Stat, Empty } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { getT } from "@/i18n";
export const metadata = { title: "Dashboard" };
export default async function Dashboard() {
  const t = await getT(); const user = await getSessionUser(); const items = await myLearning();
  const active = items.filter((i) => i.status === "active"); const done = items.filter((i) => i.status === "completed");
  const canCreateCourse = user?.permissions.has("course.create") && (user.permissions.has("course.update.own") || user.permissions.has("course.update.any"));
  const canReviewCourses = user?.permissions.has("course.review.assigned") || user?.permissions.has("course.review.any");
  const hasAdminAccess = user?.roles?.some((role) => ["admin", "owner"].includes(role)) || user?.permissions.has("user.read");
  const rolePrompts = hasAdminAccess
      ? [{ title: "Keep the platform healthy", text: "Review queue health, manage roles, and monitor operations in one place.", href: "/admin/dashboard" }]
      : canReviewCourses
      ? [{ title: "Review a course", text: "Open your review queue and help course authors get ready to publish.", href: "/reviewer/dashboard" }]
      : canCreateCourse
      ? [{ title: "Teach with confidence", text: "Start a course draft, build its learning path, and submit it for review.", href: "/instructor/courses/new" }]
      : [{ title: "Choose your next win", text: "Pick a focused course to build momentum and keep your streak going.", href: "/courses" }];
  return (<>
    <PageHeader title={t("nav.dashboard")} subtitle="Your learning progress and recommended next step." actions={<Link className="btn-primary" href="/courses">{t("nav.catalog")}</Link>} />
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="In progress" value={active.length} href="/learner/my-learning" /><Stat label="Completed" value={done.length} href="/learner/my-learning?status=completed" /><Stat label="Total enrolled" value={items.length} href="/learner/my-learning" /></div>

    <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Link href={rolePrompts[0].href} className="card block p-5 transition duration-150 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Next best step</p>
        <h2 className="mt-2 text-xl font-semibold">{rolePrompts[0].title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{rolePrompts[0].text}</p>
        <span className="btn-primary mt-4 inline-flex">Continue</span>
      </Link>
      <Link href="/learner/my-learning" className="card block p-5 transition duration-150 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Learning momentum</p>
        <h2 className="mt-2 text-xl font-semibold">{active.length > 0 ? `${active.length} active path${active.length > 1 ? "s" : ""}` : "Ready to begin"}</h2>
        <p className="mt-2 text-sm text-ink-soft">The best progress comes from short, consistent steps. Keep your learning streak alive with one focused lesson today.</p>
        <span className="mt-3 inline-flex text-sm font-medium text-brand">View my learning →</span>
      </Link>
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
