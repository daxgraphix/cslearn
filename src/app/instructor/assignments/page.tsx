import { createSupabase } from "@/lib/supabase/server";
import { signedSubmissionUrl } from "@/services/storage";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { gradeAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Grading" };
export default async function Grading({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const { data } = await (await createSupabase()).from("submissions").select("id, status, text_answer, file_path, submitted_at, profiles(full_name), assignments(max_points, lessons(title)), grades(points, feedback, finalized)").order("submitted_at");
  const rows = await Promise.all(((data ?? []) as any[]).map(async (s) => ({ ...s, url: s.file_path ? await signedSubmissionUrl(s.id) : null })));
  return (<><PageHeader title="Grading" subtitle="Submissions from learners in your courses" /><Flash error={sp.error} />
    {rows.length === 0 ? <Empty title="No submissions to grade" /> : <ul className="space-y-4">{rows.map((s) => (
      <li key={s.id} className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-medium">{s.assignments.lessons.title}</p><p className="text-sm text-ink-soft">{s.profiles?.full_name} · {fmtDate(s.submitted_at)}</p></div><Badge status={s.status === "graded" ? "completed" : "pending"}>{s.status}</Badge></div>
        {s.url && <a className="mt-2 inline-block text-sm text-brand hover:underline" href={s.url} rel="noopener noreferrer">Open submitted file (link expires in minutes)</a>}
        <form action={gradeAction} className="mt-4 grid gap-3 sm:grid-cols-[120px_1fr_auto]"><input type="hidden" name="submissionId" value={s.id} />
          <input name="points" type="number" min={0} max={s.assignments.max_points} step="0.5" defaultValue={s.grades?.points ?? ""} className="input" placeholder={`/${s.assignments.max_points}`} required aria-label="Points" />
          <input name="feedback" defaultValue={s.grades?.feedback ?? ""} className="input" placeholder="Feedback for the learner" aria-label="Feedback" />
          <button className="btn-primary">{s.grades ? "Update grade" : "Save grade"}</button>
          {s.grades && <input name="reason" className="input sm:col-span-3" placeholder="Reason for changing the grade (recorded)" aria-label="Reason" />}</form></li>))}</ul>}</>);
}
