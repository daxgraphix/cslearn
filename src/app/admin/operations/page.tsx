import { jobHealth } from "@/services/admin";
import { getSessionUser } from "@/lib/auth";
import { retryDeadJobAction } from "@/app/actions";
import { PageHeader, Table, Badge, Empty, Stat } from "@/components/ui";
import { Flash } from "@/components/Flash";
export const metadata = { title: "Operations" };
export default async function Ops({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [jobs, user, sp] = await Promise.all([jobHealth(), getSessionUser(), searchParams]);
  const queued = jobs.filter((job) => job.status === "queued").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const dead = jobs.filter((job) => job.status === "dead").length;
  const attention = jobs.filter((job) => ["failed", "dead"].includes(job.status)).length;
  const canRetry = user?.permissions.has("ops.retry") ?? false;
  return (<>
    <PageHeader title="Operations" subtitle="Queue health, retry readiness, and platform reliability for internal operations." />
    <Flash error={sp.error} />
    <div className="mb-6 grid gap-3 sm:grid-cols-4">
      <Stat label="Queued" value={queued} />
      <Stat label="Failed" value={failed} />
      <Stat label="Dead letters" value={dead} />
      <Stat label="Needs attention" value={attention} />
    </div>
    <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Operational health</p>
        <h2 className="mt-2 text-xl font-semibold">System reliability overview</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-surface-muted p-3">
            <p className="text-sm text-ink-soft">Queue load</p>
            <p className="mt-2 text-2xl font-semibold">{queued + failed + dead}</p>
          </div>
          <div className="rounded-xl bg-surface-muted p-3">
            <p className="text-sm text-ink-soft">Retry eligible</p>
            <p className="mt-2 text-2xl font-semibold">{dead}</p>
          </div>
          <div className="rounded-xl bg-surface-muted p-3">
            <p className="text-sm text-ink-soft">Recovery signal</p>
            <p className="mt-2 text-2xl font-semibold">{attention === 0 ? "Good" : "Watch"}</p>
          </div>
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
    {jobs.length === 0 ? <Empty title="Queue is clear" hint="No queued or failed jobs need attention." /> : <Table head={["Job", "Status", "Attempts", "Last error", "Next run", "Action"]}>{jobs.map((j) => <tr key={j.id}>
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
          <button className="btn-outline">Confirm retry</button>
        </form>
      </details> : "-"}</td>
    </tr>)}</Table>}
  </>);
}
