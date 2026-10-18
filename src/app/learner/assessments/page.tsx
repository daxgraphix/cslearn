import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader, Table, Badge, Empty } from "@/components/ui";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Assessments" };
export default async function Assessments() {
  const u = await requireUser(); const supabase = await createSupabase();
  const [{ data: attempts }, { data: subs }] = await Promise.all([
    supabase.from("quiz_attempts").select("id, attempt_number, status, score, passed, submitted_at, quizzes(lessons(title))").eq("learner_id", u.id).order("started_at", { ascending: false }),
    supabase.from("submissions").select("id, status, submitted_at, grades(points, feedback), assignments(max_points, lessons(title))").eq("learner_id", u.id).order("submitted_at", { ascending: false })]);
  return (<><PageHeader title="Assessments" subtitle="Quiz attempts and assignment feedback" />
    <h2 className="mb-3 font-semibold">Quizzes</h2>
    {(attempts ?? []).length === 0 ? <Empty title="No quiz attempts yet" /> : <Table head={["Quiz", "Attempt", "Score", "Result", "Date"]}>{(attempts as any[]).map((a) => (
      <tr key={a.id}><td className="table-td">{a.quizzes?.lessons?.title}</td><td className="table-td">#{a.attempt_number}</td><td className="table-td">{a.score ?? "-"}%</td><td className="table-td">{a.status === "submitted" ? <Badge status={a.passed ? "completed" : "pending"}>{a.passed ? "Passed" : "Not passed"}</Badge> : <Badge status={a.status} />}</td><td className="table-td">{fmtDate(a.submitted_at)}</td></tr>))}</Table>}
    <h2 className="mb-3 mt-8 font-semibold">Assignments</h2>
    {(subs ?? []).length === 0 ? <Empty title="No submissions yet" /> : <Table head={["Assignment", "Status", "Grade", "Feedback"]}>{(subs as any[]).map((s) => (
      <tr key={s.id}><td className="table-td">{s.assignments?.lessons?.title}</td><td className="table-td"><Badge status={s.status === "graded" ? "completed" : "pending"}>{s.status}</Badge></td><td className="table-td">{s.grades ? `${s.grades.points}/${s.assignments.max_points}` : "-"}</td><td className="table-td text-ink-soft">{s.grades?.feedback ?? "-"}</td></tr>))}</Table>}</>);
}
