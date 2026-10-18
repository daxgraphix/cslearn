import { notFound } from "next/navigation";
import { getReviewDetail } from "@/services/governance";
import { PageHeader, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { decideAction, commentAction } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Review" };
function plainLessonText(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}
function safeWebUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; }
  catch { return null; }
}
export default async function Review({ params, searchParams }: { params: Promise<{ reviewId: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  const { reviewId } = await params; const sp = await searchParams;
  const s: any = await getReviewDetail(reviewId); if (!s?.course_versions) notFound(); const v = s.course_versions;
  const summaryError = sp.error?.toLowerCase().includes("summary") ?? false;
  const modules = [...(v.modules ?? [])].sort((a: any, b: any) => a.position - b.position);
  return (<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"><div className="min-w-0">
    <PageHeader title={v.title} subtitle={`${v.subtitle ? `${v.subtitle} · ` : ""}Version ${v.version_number}`} actions={<Badge status={v.status} />} /><Flash error={sp.error} notice={sp.notice} />
    <section className="card mb-4 space-y-3 p-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand">Course overview</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink-soft">{v.description || "No course description was provided."}</p></div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-faint"><span>Level: {v.level}</span>{v.estimated_minutes != null && <span>Estimated: {v.estimated_minutes} min</span>}<span>Pass mark: {v.pass_mark}%</span></div>
      {!!v.objectives?.length && <div><h2 className="text-sm font-semibold">Learning objectives</h2><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-soft">{v.objectives.map((objective: string, i: number) => <li key={`${i}-${objective}`}>{objective}</li>)}</ul></div>}
      {v.prerequisites && <p className="text-sm text-ink-soft"><strong className="text-ink">Prerequisites:</strong> {v.prerequisites}</p>}
      {v.accessibility_notes && <p className="text-sm text-ink-soft"><strong className="text-ink">Accessibility:</strong> {v.accessibility_notes}</p>}
    </section>
    <section className="card mb-4 p-5"><h2 className="font-semibold">Checklist</h2><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft"><li>Learning objectives are clear and measurable</li><li>Content is accurate and accessible (captions, alt text, headings)</li><li>Assessments align with the objectives and pass mark</li><li>Resources open and are appropriately licensed</li></ul></section>
    {modules.length === 0 ? <section className="card mb-3 p-5"><h2 className="font-semibold">No lesson modules yet</h2><p className="mt-1 text-sm text-ink-soft">This submission does not contain course lessons to review.</p></section> : modules.map((m: any) => (<section key={m.id} className="card mb-3 p-5">
      <div className="border-b border-surface-line pb-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Module</p><h3 className="mt-1 text-lg font-semibold">{m.title}</h3>{m.description && <p className="mt-1 text-sm text-ink-soft">{m.description}</p>}</div>
      <div className="mt-4 space-y-4">{[...(m.lessons ?? [])].sort((a: any, b: any) => a.position - b.position).map((l: any) => {
        const lessonUrl = safeWebUrl(l.body?.url);
        const quiz = l.quizzes?.[0];
        return <article key={l.id} className="rounded-xl border border-surface-line bg-surface-muted/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold">{l.title}</h4><p className="mt-1 text-xs text-ink-faint">{l.type}{l.duration_minutes ? ` · ${l.duration_minutes} min` : ""} · {l.is_required ? "Required" : "Optional"}</p></div><Badge status={l.is_required ? "active" : "pending"}>{l.type}</Badge></div>
          {l.body?.html && <div className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-ink-soft">{plainLessonText(l.body.html)}</div>}
          {lessonUrl && <a className="mt-3 inline-flex text-sm font-medium text-brand underline" href={lessonUrl} target="_blank" rel="noreferrer">Open lesson media or link</a>}
          {!!l.lesson_resources?.length && <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Resources</p><ul className="mt-1 space-y-1 text-sm">{l.lesson_resources.map((resource: any, i: number) => { const resourceUrl = safeWebUrl(resource.url); return <li key={`${resource.title}-${i}`} className="flex flex-wrap items-center gap-x-2"><span>{resource.title}</span><span className="text-xs text-ink-faint">{resource.kind}{resource.mime_type ? ` · ${resource.mime_type}` : ""}</span>{resourceUrl && <a className="text-brand underline" href={resourceUrl} target="_blank" rel="noreferrer">Open</a>}</li>; })}</ul></div>}
          {quiz && <div className="mt-3 rounded-lg border border-brand/15 bg-white p-3"><p className="text-sm font-semibold">Quiz · pass mark {quiz.pass_mark}%{quiz.time_limit_seconds ? ` · ${Math.ceil(quiz.time_limit_seconds / 60)} min` : ""}</p><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink-soft">{(quiz.questions ?? []).map((question: any) => <li key={question.id}><span>{question.prompt}</span><span className="ml-2 text-xs text-ink-faint">{question.type} · {question.points} {question.points === 1 ? "point" : "points"}</span>{!!question.answer_options?.length && <ul className="mt-1 list-disc pl-5">{question.answer_options.map((option: any, i: number) => <li key={`${question.id}-${i}`}>{option.label}</li>)}</ul>}</li>)}</ol></div>}
        </article>;
      })}</div>
    </section>))}
  </div>
  <aside className="space-y-4">
    <form action={decideAction} className="card space-y-3 p-5"><h2 className="font-semibold">Decision</h2><input type="hidden" name="submissionId" value={reviewId} />
      <div><label htmlFor="review-summary" className="label">Decision summary <span className="font-normal text-ink-faint">(required)</span></label><textarea id="review-summary" name="summary" rows={5} minLength={3} maxLength={4000} className={`input ${summaryError ? "border-danger focus:border-danger focus:ring-danger/20" : ""}`} placeholder="Explain the decision and any follow-up for the author." required aria-invalid={summaryError} aria-describedby="review-summary-help" />
        <p id="review-summary-help" className={`mt-1 text-xs ${summaryError ? "text-danger" : "text-ink-faint"}`}>{summaryError ? "Add at least 3 characters. The author will receive this summary." : "At least 3 characters. The author will receive this summary."}</p>
      </div>
      <div className="grid gap-2"><SubmitButton name="decision" value="approved" className="btn-primary" pendingLabel="Submitting decision…">Approve course</SubmitButton><SubmitButton name="decision" value="changes_requested" className="btn-outline" pendingLabel="Submitting decision…">Request changes</SubmitButton><SubmitButton name="decision" value="rejected" className="btn-danger" pendingLabel="Submitting decision…">Reject course</SubmitButton></div>
      <p className="text-xs text-ink-faint">You cannot review a course you authored. Approval does not publish it; an authorized publisher releases it.</p></form>
    <form action={commentAction} className="card space-y-3 p-5"><h2 className="font-semibold">Add a comment</h2><input type="hidden" name="submissionId" value={reviewId} />
      <select name="lessonId" className="input" aria-label="Lesson"><option value="">General</option>{modules.flatMap((m: any) => m.lessons).map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}</select>
      <textarea name="body" rows={3} maxLength={4000} className="input" required aria-label="Comment" placeholder="Add specific, actionable feedback for the course team." /><SubmitButton className="btn-outline" pendingLabel="Posting…">Post comment</SubmitButton></form>
    {!!s.review_comments?.length && <section><h2 className="mb-2 text-sm font-semibold">Review discussion</h2><ul className="space-y-2">{s.review_comments.map((c: any) => <li key={c.id} className="rounded-lg bg-white p-3 text-sm shadow-card"><p className="whitespace-pre-wrap">{c.body}</p><p className="mt-2 text-xs text-ink-faint">{c.lesson_id ? "Lesson feedback" : "General feedback"} · {fmtDate(c.created_at)}</p></li>)}</ul></section>}
  </aside></div>);
}
