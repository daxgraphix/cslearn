import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
export const metadata = { title: "Reviewer dashboard" };
export default async function Dash() {
  const [q, user] = await Promise.all([reviewQueue(), getSessionUser()]);
  const canReviewAny = user?.permissions.has("course.review.any") ?? false;
  const oldestDays = q[0] ? Math.floor((Date.now() - new Date(q[0].created_at).getTime()) / 86400000) : 0;
  return (<><PageHeader title="Reviewer dashboard" subtitle="Your assigned course reviews and items waiting for a decision." actions={<Link className="btn-primary" href="/reviewer/queue">Open the queue</Link>} /><div className="grid gap-4 sm:grid-cols-2"><Stat label="Open reviews" value={q.length} href="/reviewer/queue" /><Stat label="Oldest waiting (days)" value={oldestDays} href="/reviewer/queue" /></div>
    <section className="mt-8" aria-labelledby="review-preview-heading"><h2 id="review-preview-heading" className="mb-3 text-lg font-semibold">Next in your queue</h2>
      {q.length === 0 ? <Empty title="No assigned reviews" hint="New assignments will appear here when a course is ready for review." href="/reviewer/queue" cta="View review queue" /> :
        <ul className="card divide-y divide-surface-line">{q.slice(0, 5).map((item: any) => { const canOpen = canReviewAny || item.assigned_reviewer_id === user?.id; const href = canOpen ? `/reviewer/reviews/${item.id}` : "/reviewer/queue"; return <li key={item.id}><Link className="flex flex-col gap-3 p-4 transition-colors hover:bg-brand-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand sm:flex-row sm:items-center sm:justify-between" href={href}><div className="min-w-0"><p className="truncate font-medium">{item.course_versions?.title ?? "Course submission"}</p><p className="mt-1 text-xs text-ink-faint">{item.assigned_reviewer_id ? "Assigned review" : "Unassigned · claim it from the queue"} · Waiting {Math.max(0, Math.floor((Date.now() - new Date(item.created_at).getTime()) / 86400000))} days</p></div><span className="btn-outline shrink-0">{canOpen ? "Review" : "Claim in queue"}</span></Link></li>; })}</ul>}
    </section></>);
}
