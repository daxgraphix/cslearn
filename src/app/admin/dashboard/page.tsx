import Link from "next/link";
import { overview } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Admin dashboard" };
export default async function Dash() {
  const user = await getSessionUser();
  const canViewReports = user?.permissions.has("report.read") ?? false;
  const o = canViewReports ? await overview() : null;
  const enrollments = Number(o?.enrollments ?? 0);
  const completions = Number(o?.completions ?? 0);
  const openReviews = Number(o?.open_reviews ?? 0);
  const deadJobs = Number(o?.dead_jobs ?? 0);
  const completionRate = enrollments > 0 ? Math.round((completions / enrollments) * 100) : 0;
  const count = (value: unknown) => new Intl.NumberFormat("en-KE").format(Number(value ?? 0));
  const actions = [
    ...(user?.permissions.has("course.review.assigned") || user?.permissions.has("course.review.any") ? [{ title: "Review courses", href: "/admin/reviews", text: openReviews ? `${count(openReviews)} ${openReviews === 1 ? "submission" : "submissions"} waiting for a decision` : "Open the review queue" }] : []),
    ...(user?.permissions.has("course.read.any") ? [{ title: "Publish courses", href: "/admin/courses", text: "Publish approved versions and manage the catalog" }] : []),
    ...(user?.permissions.has("user.read") ? [{ title: "Manage users", href: "/admin/users", text: "Accounts, access, and role assignments" }] : []),
    ...(user?.permissions.has("ops.read") ? [{ title: "Check operations", href: "/admin/operations", text: deadJobs ? `${count(deadJobs)} jobs need attention` : "Queue health and background jobs" }] : []),
    ...(user?.permissions.has("role.assign") ? [{ title: "Manage roles", href: "/admin/roles", text: "Review permission bundles and role access" }] : []),
  ];
  const metrics = [
    { label: "Users", value: o?.users, href: "/admin/users", permission: "user.read", hint: "Manage accounts" },
    { label: "Active learners · 30 days", value: o?.learners_30d, href: "/admin/users", permission: "user.read", hint: "Browse user accounts" },
    { label: "Published courses", value: o?.published_courses, href: "/admin/courses", permission: "course.read.any", hint: "Open course publishing" },
    { label: "Enrollments", value: o?.enrollments, href: "/admin/enrollments", permission: "enrollment.read.any", hint: "View learner access" },
    { label: "Completions", value: o?.completions, href: "/admin/reports", permission: "report.read", hint: "View learning reports" },
    { label: "Valid certificates", value: o?.certificates, href: "/admin/certificates", permission: "certificate.read.any", hint: "Manage certificates" },
    { label: "Reviews waiting", value: o?.open_reviews, href: "/admin/reviews", permission: "course.review.assigned", hint: openReviews ? "Review submissions" : "Queue is clear", attention: openReviews > 0 },
    { label: "Dead jobs", value: o?.dead_jobs, href: "/admin/operations?status=dead", permission: "ops.read", hint: deadJobs ? "Inspect jobs" : "No retries needed", attention: deadJobs > 0 },
  ];
  const visibleMetrics = metrics.filter((metric) => user?.permissions.has(metric.permission)
    || (metric.permission === "course.review.assigned" && user?.permissions.has("course.review.any")));
  return (
    <>
      <PageHeader title="Administration" subtitle="A live overview of learning activity, pending decisions, and platform health." />
      {!o ? <section className="space-y-5" aria-labelledby="admin-access-heading">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <h2 id="admin-access-heading" className="font-semibold">{canViewReports ? "Platform overview is temporarily unavailable" : "Analytics access is not part of your role"}</h2>
          <p className="mt-1">{canViewReports ? "You can still continue to the areas available to your account below." : "You can still open your permitted admin areas below. Ask an owner to add report access if you need platform-wide analytics."}</p>
        </div>
        {actions.length > 0 && <section aria-labelledby="admin-shortcuts-heading"><h2 id="admin-shortcuts-heading" className="mb-3 text-lg font-semibold">Your admin shortcuts</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{actions.map((action) => <Link key={action.href} href={action.href} className="card block p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/20"><p className="font-semibold text-ink">{action.title}</p><p className="mt-1 text-sm text-ink-soft">{action.text}</p><span className="mt-3 inline-flex text-sm font-medium text-brand">Open area <span aria-hidden="true">→</span></span></Link>)}</div></section>}
      </section> : (
        <div className="space-y-6">
          <section aria-labelledby="overview-heading">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h2 id="overview-heading" className="text-lg font-semibold">Platform overview</h2><p className="mt-1 text-sm text-ink-soft">Select a metric to open its management page.</p></div></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {visibleMetrics.map((metric) => <Link key={metric.label} href={metric.href} aria-label={`${metric.label}: ${count(metric.value)}. ${metric.hint}.`} className={`group rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${metric.attention ? "ring-1 ring-amber-300" : ""}`}>
                <div className="card h-full border border-surface-line p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-brand/40 group-hover:shadow-card sm:p-5">
                  <p className="text-sm font-medium text-ink-soft">{metric.label}</p>
                  <p className={`mt-2 text-3xl font-semibold tabular-nums ${metric.attention ? "text-amber-700" : "text-ink"}`}>{count(metric.value)}</p>
                  <p className="mt-2 text-xs text-brand">{metric.hint} <span aria-hidden="true">→</span></p>
                </div>
              </Link>)}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Quick actions</p>
                  <h2 className="mt-2 text-xl font-semibold">Platform operations</h2>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {actions.map((action) => (
                  <Link key={action.href} href={action.href} className="rounded-2xl border border-surface-line bg-surface-muted/60 p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/50">
                    <p className="text-sm font-semibold text-ink">{action.title}</p>
                    <p className="mt-1 text-sm text-ink-soft">{action.text}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Operational signals</p>
              <h2 className="mt-2 text-xl font-semibold">Performance and risk</h2>
              <div className="mt-4 space-y-4">
                {(user?.permissions.has("course.review.assigned") || user?.permissions.has("course.review.any")) && <Link href="/admin/reviews" className="flex items-center justify-between gap-4 rounded-xl border border-surface-line p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/30">
                  <span><span className="block text-sm font-medium text-ink">Course reviews</span><span className="mt-1 block text-xs text-ink-soft">{openReviews ? "Submissions need a decision" : "No submissions are waiting"}</span></span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${openReviews ? "bg-amber-100 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{count(openReviews)}</span>
                </Link>}
                <Link href="/admin/reports" className="block rounded-xl border border-surface-line p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-ink">Enrollment completion</span><span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{enrollments > 0 ? `${completionRate}%` : "Waiting for data"}</span></div>
                  {enrollments > 0 ? <><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Enrollment completion rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionRate}><div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${completionRate}%` }} /></div><p className="mt-2 text-xs text-ink-soft">{count(completions)} of {count(enrollments)} enrollments completed</p></> : <p className="mt-2 text-xs text-ink-soft">Completion data will appear after learners enroll in courses.</p>}
                  <span className="mt-2 block text-xs font-medium text-brand">Open learning reports →</span>
                </Link>
                {user?.permissions.has("ops.read") && <Link href="/admin/operations?status=dead" className="flex items-center justify-between gap-4 rounded-xl border border-surface-line p-4 transition-colors hover:border-brand/40 hover:bg-brand-soft/30">
                  <span><span className="block text-sm font-medium text-ink">Background jobs</span><span className="mt-1 block text-xs text-ink-soft">{deadJobs ? "Failed jobs need attention" : "No failed jobs need a retry"}</span></span>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${deadJobs ? "bg-red-50 text-danger" : "bg-emerald-50 text-emerald-700"}`}>{deadJobs ? count(deadJobs) : "Clear"}</span>
                </Link>}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
