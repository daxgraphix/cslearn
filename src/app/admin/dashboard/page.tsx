import Link from "next/link";
import { overview } from "@/services/admin";
import { PageHeader, Stat } from "@/components/ui";
export const metadata = { title: "Admin dashboard" };
export default async function Dash() {
  const o = await overview();
  const enrollments = Number(o?.enrollments ?? 0);
  const completions = Number(o?.completions ?? 0);
  const openReviews = Number(o?.open_reviews ?? 0);
  const deadJobs = Number(o?.dead_jobs ?? 0);
  const completionRate = enrollments > 0 ? Math.round((completions / enrollments) * 100) : 0;
  const actions = [
    { title: "Users", href: "/admin/users", text: "Manage access and platform roles" },
    { title: "Courses", href: "/admin/courses", text: "Review published and draft courses" },
    { title: "Reviews", href: "/admin/reviews", text: "Resolve learner submissions and reviews" },
    { title: "Operations", href: "/admin/operations", text: "Monitor job health and retries" },
  ];
  return (
    <>
      <PageHeader title="Administration" subtitle="Platform health at a glance" />
      {!o ? <p className="text-ink-soft">You do not have report access.</p> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Users" value={o.users} />
            <Stat label="Active learners (30 days)" value={o.learners_30d} />
            <Stat label="Published courses" value={o.published_courses} />
            <Stat label="Enrollments" value={o.enrollments} />
            <Stat label="Completions" value={o.completions} />
            <Stat label="Valid certificates" value={o.certificates} />
            <Stat label="Reviews waiting" value={o.open_reviews} />
            <Stat label="Dead jobs" value={o.dead_jobs} />
          </div>

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
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="text-ink-soft">Open reviews</span><span className="shrink-0 font-medium tabular-nums text-ink">{openReviews}</span></div>
                  <div className="h-2 rounded-full bg-surface-muted" role="progressbar" aria-label="Open reviews relative to a 30-item queue threshold" aria-valuemin={0} aria-valuemax={30} aria-valuenow={Math.min(openReviews, 30)}><div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.min((openReviews / 30) * 100, 100)}%` }} /></div>
                  <p className="mt-1 text-xs text-ink-faint">Queue reference: 30 items</p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="text-ink-soft">Enrollment completion</span><span className="shrink-0 font-medium tabular-nums text-ink">{enrollments > 0 ? `${completionRate}%` : "No data"}</span></div>
                  <div className="h-2 rounded-full bg-surface-muted" role="progressbar" aria-label="Enrollment completion rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionRate}><div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${completionRate}%` }} /></div>
                  <p className="mt-1 text-xs text-ink-faint">{completions} of {enrollments} enrollments completed</p>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="text-ink-soft">Dead jobs</span><span className="shrink-0 font-medium tabular-nums text-ink">{deadJobs === 0 ? "Clear" : deadJobs}</span></div>
                  <div className="h-2 rounded-full bg-surface-muted" role="progressbar" aria-label="Dead jobs relative to a 10-job queue threshold" aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.min(deadJobs, 10)}><div className="h-full rounded-full bg-danger transition-[width]" style={{ width: `${Math.min((deadJobs / 10) * 100, 100)}%` }} /></div>
                  <p className="mt-1 text-xs text-ink-faint">{deadJobs === 0 ? "No jobs need retry" : "Jobs may need a retry"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
