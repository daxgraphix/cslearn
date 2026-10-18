/** Pure grading helpers mirroring the SQL functions (used for tests and previews). The database remains authoritative. */
export type GradeQuestion = { id: string; type: "single" | "multiple" | "true_false" | "short_text"; points: number; correctOptionIds?: string[]; accepted?: string[] };
export type GradeAnswer = { questionId: string; optionIds?: string[]; text?: string };

export function gradeAttempt(questions: GradeQuestion[], answers: GradeAnswer[], passMark: number) {
  let total = 0, earned = 0;
  for (const q of questions) {
    total += q.points;
    const a = answers.find((x) => x.questionId === q.id);
    let ok = false;
    if (q.type === "short_text") {
      ok = !!a?.text && (q.accepted ?? []).some((x) => x.trim().toLowerCase() === a.text!.trim().toLowerCase());
    } else {
      const sel = [...new Set(a?.optionIds ?? [])].sort();
      const key = [...(q.correctOptionIds ?? [])].sort();
      ok = key.length > 0 && sel.length === key.length && sel.every((v, i) => v === key[i]);
    }
    if (ok) earned += q.points;
  }
  const score = total === 0 ? 0 : Math.round((earned / total) * 10000) / 100;
  return { score, passed: score >= passMark, earned, total };
}

export function courseProgress(requiredLessonIds: string[], completed: Set<string>) {
  const done = requiredLessonIds.filter((id) => completed.has(id)).length;
  const pct = requiredLessonIds.length === 0 ? 0 : Math.round((done / requiredLessonIds.length) * 100);
  return { done, total: requiredLessonIds.length, pct, complete: requiredLessonIds.length > 0 && done === requiredLessonIds.length };
}

export function certificateEligible(a: { completed: boolean; finalScore: number | null; passMark: number; enabled: boolean; alreadyValid: boolean }) {
  if (!a.enabled || !a.completed) return false;
  if (a.finalScore !== null && a.finalScore < a.passMark) return false;
  return !a.alreadyValid;
}
