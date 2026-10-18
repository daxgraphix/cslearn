import { notFound } from "next/navigation";
import { getReviewDetail } from "@/services/governance";
import { PageHeader, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { decideAction, commentAction } from "@/app/actions";
export const metadata = { title: "Review" };
export default async function Review({ params, searchParams }: { params: Promise<{ reviewId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { reviewId } = await params; const sp = await searchParams;
  const s: any = await getReviewDetail(reviewId); if (!s) notFound(); const v = s.course_versions;
  const summaryError = sp.error?.toLowerCase().includes("summary") ?? false;
  const modules = [...(v.modules ?? [])].sort((a: any, b: any) => a.position - b.position);
  return (<div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div>
    <PageHeader title={v.title} subtitle={`Version ${v.version_number}`} actions={<Badge status={v.status} />} /><Flash error={sp.error} />
    <section className="card mb-4 p-5"><h2 className="font-semibold">Checklist</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft"><li>Learning objectives are clear and measurable</li><li>Content is accurate and accessible (captions, alt text, headings)</li><li>Assessments align with the objectives and pass mark</li><li>Resources open and are appropriately licensed</li></ul></section>
    {modules.map((m: any) => (<section key={m.id} className="card mb-3 p-5"><h3 className="font-semibold">{m.title}</h3><ul className="mt-2 space-y-1 text-sm">{[...m.lessons].sort((a: any, b: any) => a.position - b.position).map((l: any) => <li key={l.id} className="flex justify-between"><span>{l.title}</span><span className="text-ink-faint">{l.type}</span></li>)}</ul></section>))}
  </div>
  <aside className="space-y-4">
    <form action={decideAction} className="card space-y-3 p-5"><h2 className="font-semibold">Decision</h2><input type="hidden" name="submissionId" value={reviewId} />
      <div><label htmlFor="review-summary" className="label">Decision summary <span className="font-normal text-ink-faint">(required)</span></label><textarea id="review-summary" name="summary" rows={5} minLength={3} maxLength={4000} className={`input ${summaryError ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`} placeholder="Explain the decision and any follow-up for the author." required aria-invalid={summaryError} aria-describedby="review-summary-help" />
        <p id="review-summary-help" className={`mt-1 text-xs ${summaryError ? "text-danger" : "text-ink-faint"}`}>{summaryError ? "Add at least 3 characters. The author will receive this summary." : "At least 3 characters. The author will receive this summary."}</p>
      </div>
      <div className="grid gap-2"><button name="decision" value="approved" className="btn-primary">Approve</button><button name="decision" value="changes_requested" className="btn-outline">Request changes</button><button name="decision" value="rejected" className="btn-danger">Reject</button></div>
      <p className="text-xs text-ink-faint">You cannot review a course you authored. Approval does not publish it; an authorized publisher releases it.</p></form>
    <form action={commentAction} className="card space-y-3 p-5"><h2 className="font-semibold">Add a comment</h2><input type="hidden" name="submissionId" value={reviewId} />
      <select name="lessonId" className="input" aria-label="Lesson"><option value="">General</option>{modules.flatMap((m: any) => m.lessons).map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
      <textarea name="body" rows={3} className="input" required aria-label="Comment" /><button className="btn-outline">Post comment</button></form>
    <ul className="space-y-2">{(s.review_comments ?? []).map((c: any) => <li key={c.id} className="rounded-lg bg-white p-3 text-sm shadow-card">{c.body}</li>)}</ul>
  </aside></div>);
}
