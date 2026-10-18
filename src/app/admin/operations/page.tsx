import Link from "next/link";
import { jobHealth } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { retryDeadJobAction } from "@/app/actions";
import { PageHeader, Table, Badge, Empty, Stat } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
export const metadata = { title: "Operations" };
export default async function Ops({ searchParams }: { searchParams: Promise<{ error?: string; status?: string }> }) {
  const [jobs, user, sp] = await Promise.all([jobHealth(), getSessionUser(), searchParams]);
  const activeStatus = (["queued", "failed", "dead", "attention"] as const).find((status) => status === sp.status) ?? "all";
  const visibleJobs = activeStatus === "all" ? jobs : activeStatus === "attention" ? jobs.filter((job) => ["failed", "dead"].includes(job.status)) : jobs.filter((job) => job.status === activeStatus);
  const queued = jobs.filter((job) => job.status === "queued").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const dead = jobs.filter((job) => job.status === "dead").length;
  const attention = jobs.filter((job) => ["failed", "dead"].includes(job.status)).length;
  const canRetry = user?.permissions.has("ops.retry") ?? false;
  return (<>
    <PageHeader title="Operations" subtitle="Monitor queued work, investigate failures, and retry dead jobs after checking the cause." actions={<Link href="/admin/security" className="btn-outline">View audit log</Link>} />
    <Flash error={sp.error} />
    <div className="mb-6 grid gap-3 sm:grid-cols-4">
      <Stat label="Queued" value={queued} href="/admin/operations?status=queued" />
      <Stat label="Failed" value={failed} href="/admin/operations?status=failed" />
      <Stat label="Dead letters" value={dead} href="/admin/operations?status=dead" />
      <Stat label="Needs attention" value={attention} href="/admin/operations?status=attention" />
    </div>
    <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Recent activity</p>
        <h2 className="mt-2 text-xl font-semibold">Job queue snapshot</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Link href="/admin/operations" className="rounded-xl bg-surface-muted p-3 transition-colors hover:bg-brand-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <p className="text-sm text-ink-soft">Jobs in view</p>
            <p className="mt-2 text-2xl font-semibold">{queued + failed + dead}</p>
          </Link>
          <Link href="/admin/operations?status=dead" className="rounded-xl bg-surface-muted p-3 transition-colors hover:bg-brand-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <p className="text-sm text-ink-soft">Retry eligible</p>
            <p className="mt-2 text-2xl font-semibold">{dead}</p>
          </Link>
          <Link href="/admin/operations?status=attention" className="rounded-xl bg-surface-muted p-3 transition-colors hover:bg-brand-soft/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            <p className="text-sm text-ink-soft">Recovery signal</p>
            <p className="mt-2 text-2xl font-semibold">{attention === 0 ? "Good" : "Watch"}</p>
          </Link>
        </div>
      </div>
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Recommended action</p>
        <h2 className="mt-2 text-xl font-semibold">Keep the queue healthy</h2>
        <ul className="mt-4 space-y-2 text-sm text-ink-soft">
          <li>• Review failed jobs before they hit the dead-letter state.</li>
          <li>• Retry only verified dead jobs with clear root-cause checks.</li>
          <li>• Use platform logs for the full audit trail and incident context.</li>
        </ul>
      </div>
    </div>
    <nav className="mb-4 flex flex-wrap items-center gap-2" aria-label="Filter jobs by status">
      {[{ key: "all", label: "Recent jobs" }, { key: "queued", label: "Queued" }, { key: "failed", label: "Failed" }, { key: "dead", label: "Dead letters" }, { key: "attention", label: "Needs attention" }].map((filter) => <Link key={filter.key} href={filter.key === "all" ? "/admin/operations" : `/admin/operations?status=${filter.key}`} aria-current={activeStatus === filter.key ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${activeStatus === filter.key ? "border-brand bg-brand-soft text-brand" : "border-surface-line bg-white text-ink-soft hover:bg-surface-muted"}`}>{filter.label}<span className="ml-2 tabular-nums">{filter.key === "all" ? jobs.length : filter.key === "attention" ? attention : jobs.filter((job) => job.status === filter.key).length}</span></Link>)}
    </nav>
    {visibleJobs.length === 0 ? <Empty title={activeStatus === "all" ? "Queue is clear" : `No ${activeStatus === "dead" ? "dead-letter" : activeStatus} jobs`} hint={activeStatus === "all" ? "No queued or failed jobs need attention." : "Try another status filter to see other jobs."} /> : <Table head={["Job", "Status", "Attempts", "Last error", "Next run", "Action"]}>{visibleJobs.map((j) => <tr key={j.id}>
      <td className="table-td"><p className="font-medium capitalize">{j.kind.replace(/_/g, " ")}</p><p className="font-mono text-xs text-ink-faint">{j.id.slice(0, 8)}</p></td>
      <td className="table-td"><Badge status={j.status} /></td>
      <td className="table-td tabular-nums">{j.attempts} / {j.max_attempts}</td>
      <td className="table-td max-w-sm text-ink-soft">{j.last_error ? <details><summary className="cursor-pointer text-brand">View error</summary><pre className="mt-2 max-w-sm whitespace-pre-wrap break-words rounded-md bg-surface-muted p-3 text-xs">{j.last_error}</pre></details> : "-"}</td>
      <td className="table-td whitespace-nowrap">{new Date(j.run_at).toLocaleString("en-GB")}</td>
      <td className="table-td">{canRetry && j.status === "dead" ? <details>
        <summary className="cursor-pointer text-sm font-medium text-brand hover:underline">Retry job</summary>
        <form action={retryDeadJobAction} className="mt-2 min-w-52 space-y-2">
          <input type="hidden" name="jobId" value={j.id} />
          <p className="text-xs text-ink-soft">This resets attempts and queues the job immediately. The retry will be recorded in the audit log.</p>
          <SubmitButton className="btn-danger" pendingLabel="Queueing retry…">Queue for retry</SubmitButton>
        </form>
      </details> : "-"}</td>
    </tr>)}</Table>}
  </>);
}
