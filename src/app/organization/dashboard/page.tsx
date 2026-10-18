import { orgOverview } from "@/services/organization";
import { currentOrgId } from "@/lib/org-context";
import { PageHeader, Stat } from "@/components/ui";
export const metadata = { title: "Organization" };
export default async function Dash() {
  const d = await orgOverview(await currentOrgId());
  const total = d.report.reduce((a, r) => a + Number(r.learners), 0), done = d.report.reduce((a, r) => a + Number(r.completed), 0);
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
  return (<><PageHeader title={d.org?.name ?? "Organization"} subtitle="Membership, cohort activity, and assigned learning progress." />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Active members" value={d.members.filter((m: any) => m.status === "active").length} /><Stat label="Cohorts" value={d.cohorts.length} /><Stat label="Learners assigned" value={total} /><Stat label="Completed learners" value={done} /></div>
    <section className="card mt-6 border border-surface-line p-5" aria-labelledby="org-progress-heading"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Learning outcomes</p><h2 id="org-progress-heading" className="mt-1 text-lg font-semibold">Completion progress</h2></div><span className="text-2xl font-semibold tabular-nums">{total > 0 ? `${completionRate}%` : "No data"}</span></div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Assigned learner completion rate" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionRate}><div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${completionRate}%` }} /></div>
      <p className="mt-2 text-sm text-ink-soft">{total > 0 ? `${done} of ${total} assigned learners have completed their learning.` : "Assign courses to a cohort to see completion progress."}</p>
    </section></>);
}
