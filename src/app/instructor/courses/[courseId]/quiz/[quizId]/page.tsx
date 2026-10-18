import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { requireCourseTeam } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { addQuestionAction } from "@/app/actions";
export const metadata = { title: "Quiz editor" };

export default async function QuizEditor({ params, searchParams }: { params: Promise<{ courseId: string; quizId: string }>; searchParams: Promise<{ error?: string }> }) {
  const { courseId, quizId } = await params; const sp = await searchParams;
  await requireCourseTeam(courseId);
  const supabase = await createSupabase();
  const { data: quiz } = await supabase.from("quizzes").select("id, pass_mark, max_attempts, time_limit_seconds, lessons(title, modules(version_id, course_versions(status, course_id))), questions(id, prompt, type, points, position, answer_options(id, label, position))").eq("id", quizId).single();
  const q: any = quiz; if (!q || q.lessons.modules.course_versions.course_id !== courseId) notFound();
  const editable = ["draft", "changes_requested"].includes(q.lessons.modules.course_versions.status);
  // Instructors (authors) may see keys for their own editable quiz: read through service role after authorization above.
  const ids = q.questions.flatMap((x: any) => x.answer_options.map((o: any) => o.id));
  const { data: keys } = ids.length ? await createAdminSupabase().from("answer_keys").select("option_id, is_correct").in("option_id", ids) : { data: [] };
  const correct = new Set((keys ?? []).filter((k) => k.is_correct).map((k) => k.option_id));
  const questions = [...q.questions].sort((a: any, b: any) => a.position - b.position);
  return (<div className="mx-auto max-w-3xl">
    <PageHeader title={q.lessons.title} subtitle={`Pass mark ${q.pass_mark}% · ${questions.length} questions`} actions={<Link className="btn-outline" href={`/instructor/courses/${courseId}/builder`}>Back to curriculum</Link>} />
    <Flash error={sp.error} />
    <ol className="space-y-3">{questions.map((x: any, i: number) => (
      <li key={x.id} className="card p-5"><p className="font-medium">{i + 1}. {x.prompt} <span className="text-sm font-normal text-ink-faint">({x.points} pt)</span></p>
        <ul className="mt-2 space-y-1 text-sm">{[...x.answer_options].sort((a: any, b: any) => a.position - b.position).map((o: any) => <li key={o.id} className={correct.has(o.id) ? "font-medium text-ok" : "text-ink-soft"}>{correct.has(o.id) ? "✓ " : "• "}{o.label}</li>)}</ul></li>))}</ol>
    {editable && (
      <form action={addQuestionAction} className="card mt-6 space-y-4 p-6"><h2 className="font-semibold">Add question</h2>
        <input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="quizId" value={quizId} />
        <textarea name="prompt" required rows={2} className="input" placeholder="Question" aria-label="Question" />
        <div className="grid gap-3 sm:grid-cols-2"><select name="type" className="input" aria-label="Type"><option value="single">Single choice</option><option value="multiple">Multiple choice</option><option value="true_false">True or false</option><option value="short_text">Short answer</option></select>
          <input name="points" type="number" min={1} defaultValue={1} className="input" aria-label="Points" /></div>
        <fieldset className="space-y-2"><legend className="text-sm text-ink-soft">Options. Tick the correct ones. For true/false use “True” and “False”. Leave unused rows empty.</legend>
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="flex items-center gap-2"><input type="checkbox" name="correct" value={i} aria-label={`Option ${i + 1} is correct`} /><input name={`opt${i}`} className="input" placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`} /></div>)}</fieldset>
        <div><label className="label" htmlFor="accepted">Accepted answers (short answer only)</label><textarea id="accepted" name="accepted" rows={2} className="input" placeholder="One per line" /></div>
        <button className="btn-primary">Add question</button></form>)}
  </div>);
}
