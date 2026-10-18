"use client";
import { useState, useTransition } from "react";
import { startQuizAction, submitQuizAction, completeLessonAction } from "@/app/actions";

type Q = { id: string; prompt: string; type: string; options: { id: string; label: string }[] };
type Quiz = { id: string; timeLimit: number | null; maxAttempts: number | null; passMark: number; instructions?: string | null; questions: Q[] };

/** Answers are only sent to the server. Grading and answer keys never reach the browser. */
export function QuizRunner({ quiz, enrollmentId, courseId, lessonId }: { quiz: Quiz; enrollmentId: string; courseId: string; lessonId: string }) {
  const [attempt, setAttempt] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { option_ids: string[]; text?: string }>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; show_results: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const begin = () => start(async () => {
    setError(null); const r = await startQuizAction(enrollmentId, quiz.id);
    if (r.ok) { setAttempt(r.data as string); setResult(null); setAnswers({}); } else setError(r.error);
  });
  const submit = () => start(async () => {
    if (!attempt) return;
    const payload = quiz.questions.map((q) => ({ question_id: q.id, option_ids: answers[q.id]?.option_ids ?? [], text: answers[q.id]?.text }));
    const r = await submitQuizAction(attempt, payload);
    if (r.ok) { setResult(r.data as any); setAttempt(null); } else setError(r.error);
  });
  const toggle = (q: Q, id: string) => setAnswers((a) => {
    const cur = a[q.id]?.option_ids ?? [];
    return { ...a, [q.id]: { option_ids: q.type === "multiple" ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id] } };
  });

  return (
    <div className="space-y-5">
      {quiz.instructions && <p className="text-ink-soft">{quiz.instructions}</p>}
      <p className="text-sm text-ink-faint">Pass mark {quiz.passMark}%{quiz.maxAttempts ? ` · ${quiz.maxAttempts} attempts allowed` : ""}{quiz.timeLimit ? ` · ${Math.round(quiz.timeLimit / 60)} minute limit` : ""}</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>}
      {result && (
        <div role="status" className={`rounded-xl p-4 ${result.passed ? "bg-emerald-50 text-ok" : "bg-amber-50 text-draft"}`}>
          <p className="font-semibold">{result.passed ? "You passed" : "Not passed yet"}: {result.score}%</p>
          {result.passed && <form action={completeLessonAction} className="mt-3"><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="lessonId" value={lessonId} /><input type="hidden" name="enrollmentId" value={enrollmentId} /><button className="btn-primary">Mark lesson complete</button></form>}
        </div>)}
      {!attempt ? <button onClick={begin} disabled={pending} className="btn-primary">{result ? "Try again" : "Start quiz"}</button> : (
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-6">
          {quiz.questions.map((q, i) => (
            <fieldset key={q.id} className="space-y-2"><legend className="font-medium">{i + 1}. {q.prompt}</legend>
              {q.type === "short_text" ? <input className="input" aria-label={q.prompt} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: { option_ids: [], text: e.target.value } }))} /> :
                q.options.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-surface-line px-3 py-2.5 hover:bg-surface-muted">
                    <input type={q.type === "multiple" ? "checkbox" : "radio"} name={q.id} checked={answers[q.id]?.option_ids.includes(o.id) ?? false} onChange={() => toggle(q, o.id)} />{o.label}
                  </label>))}
            </fieldset>))}
          <button disabled={pending} className="btn-primary">Submit answers</button>
        </form>)}
    </div>
  );
}
