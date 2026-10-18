import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { Empty, PageHeader, Stat } from "@/components/ui";
export const metadata = { title: "Reviewer dashboard" };
export default async function Dash() {
  const q = await reviewQueue();
  const oldestDays = q[0] ? Math.floor((Date.now() - new Date(q[0].created_at).getTime()) / 86400000) : 0;
  return (<><PageHeader title="Reviewer dashboard" subtitle="Your assigned course reviews and items waiting for a decision." actions={<Link className="btn-primary" href="/reviewer/queue">Open the queue</Link>} /><div className="grid gap-4 sm:grid-cols-2"><Stat label="Open reviews" value={q.length} /><Stat label="Oldest waiting (days)" value={oldestDays} /></div>
    <section className="mt-8" aria-labelledby="review-preview-heading"><h2 id="review-preview-heading" className="mb-3 text-lg font-semibold">Next in your queue</h2>
      {q.length === 0 ? <Empty title="No assigned reviews" hint="New assignments will appear here when a course is ready for review." href="/reviewer/queue" cta="View review queue" /> :
        <ul className="card divide-y divide-surface-line">{q.slice(0, 5).map((item: any) => <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium">{item.course_versions?.title ?? "Course submission"}</p><p className="mt-1 text-xs text-ink-faint">Waiting {Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000))} days</p></div><Link className="btn-outline shrink-0" href={`/reviewer/reviews/${item.id}`}>Review</Link></li>)}</ul>}
    </section></>);
}
