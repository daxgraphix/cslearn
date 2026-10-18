import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle, FileText, ClipboardList, Link2, FileDown, Radio, Upload } from "lucide-react";
import { completeLessonAction, submitAssignmentAction } from "@/app/actions";
import { QuizRunner } from "./QuizRunner";
import { cn } from "@/lib/utils";

const ICON: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, quiz: ClipboardList, external: Link2, document: FileDown, live: Radio, assignment: Upload };

function embedUrl(url: string) {
  try { const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed${u.pathname}`;
    if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video${u.pathname}`;
  } catch { /* invalid */ } return null;
}

export function Player({ courseId, title, enrollmentId, modules, completed, currentId }: { courseId: string; title: string; enrollmentId: string; modules: any[]; completed: string[]; currentId?: string }) {
  const done = new Set(completed); const flat = modules.flatMap((m) => m.lessons);
  const lesson = flat.find((l) => l.id === currentId); const idx = flat.findIndex((l) => l.id === currentId);
  const next = flat[idx + 1]; const isDone = lesson && done.has(lesson.id);
  const quiz = lesson?.quizzes?.[0] ?? lesson?.quizzes; const q = Array.isArray(lesson?.quizzes) ? lesson.quizzes[0] : lesson?.quizzes;
  void quiz;
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <nav aria-label="Course outline" className="card h-fit max-h-[80vh] overflow-y-auto p-3">
        <h2 className="px-2 pb-2 font-semibold">{title}</h2>
        {modules.map((m) => (
          <div key={m.id} className="mb-3"><p className="px-2 py-1 text-xs font-medium text-ink-faint">{m.title}</p>
            <ul>{m.lessons.map((l: any) => { const Icon = ICON[l.type] ?? FileText; const d = done.has(l.id);
              return <li key={l.id}><Link href={`/learner/learn/${courseId}?lesson=${l.id}`} aria-current={l.id === currentId ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-muted", l.id === currentId && "bg-brand-soft text-brand")}>
                {d ? <CheckCircle2 size={16} className="text-ok" /> : <Circle size={16} className="text-ink-faint" />}<Icon size={14} className="shrink-0 text-ink-faint" /><span className="truncate">{l.title}</span></Link></li>; })}</ul></div>))}
      </nav>
      <article className="card min-w-0 p-6">
        {!lesson ? <p className="text-ink-soft">This course has no lessons yet.</p> : <>
          <h1 className="text-2xl font-semibold">{lesson.title}</h1>
          <div className="mt-5 space-y-5">
            {lesson.type === "video" && (() => { const url = lesson.body?.url as string | undefined; const e = url ? embedUrl(url) : null;
              return e ? <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe src={e} title={lesson.title} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" /></div>
                : url ? <video controls className="w-full rounded-xl" src={url}><track kind="captions" /></video> : <p className="text-ink-soft">Video not available.</p>; })()}
            {lesson.type === "text" && <div className="prose max-w-none whitespace-pre-line leading-relaxed">{lesson.body?.html}</div>}
            {lesson.type === "external" && lesson.body?.url && <a className="btn-outline" href={lesson.body.url} target="_blank" rel="noopener noreferrer nofollow">Open resource</a>}
            {lesson.type === "document" && <p className="text-sm text-ink-soft">Downloads are available below.</p>}
            {(lesson.lesson_resources ?? []).length > 0 && <ul className="space-y-1 text-sm">{lesson.lesson_resources.map((r: any) => <li key={r.id}><a className="text-brand hover:underline" href={`/learner/resource/${r.id}`}>{r.title}</a></li>)}</ul>}
            {lesson.type === "live" && <p className="text-sm text-ink-soft">Attendance is recorded by your instructor after the session.</p>}
            {lesson.type === "quiz" && q && <QuizRunner enrollmentId={enrollmentId} quiz={{ id: q.id, timeLimit: q.time_limit_seconds, maxAttempts: q.max_attempts, passMark: q.pass_mark, instructions: q.instructions, questions: [...q.questions].sort((a: any, b: any) => a.position - b.position).map((x: any) => ({ id: x.id, prompt: x.prompt, type: x.type, options: [...x.answer_options].sort((a: any, b: any) => a.position - b.position) })) }} courseId={courseId} lessonId={lesson.id} />}
            {lesson.type === "assignment" && (
              <form action={submitAssignmentAction} className="space-y-3 rounded-xl border border-surface-line p-4"><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="enrollmentId" value={enrollmentId} /><input type="hidden" name="assignmentId" value={lesson.assignments?.id ?? ""} />
                <label className="label" htmlFor="file">Upload your work (PDF, PNG, JPG or text, max 10 MB)</label><input id="file" type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt" className="input" required /><button className="btn-primary">Submit assignment</button></form>)}
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-surface-line pt-5">
            {isDone ? <span className="inline-flex items-center gap-2 text-sm text-ok"><CheckCircle2 size={18} />Completed</span> :
              lesson.type !== "quiz" && lesson.type !== "assignment" && lesson.type !== "live" ? (
                <form action={completeLessonAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="enrollmentId" value={enrollmentId} />
                  <button className="btn-primary">Mark as complete</button></form>) : <span className="text-sm text-ink-soft">Completes when you meet the lesson requirement.</span>}
            {next && <Link className="btn-outline" href={`/learner/learn/${courseId}?lesson=${next.id}`}>Next lesson</Link>}
          </div></>}
      </article>
    </div>
  );
}
