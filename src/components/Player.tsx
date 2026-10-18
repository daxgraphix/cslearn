import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle, FileText, ClipboardList, Link2, FileDown, Radio, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { completeLessonAction, submitAssignmentAction } from "@/app/actions";
import { QuizRunner } from "./QuizRunner";
import { cn } from "@/lib/utils";

const ICON: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, quiz: ClipboardList, external: Link2, document: FileDown, live: Radio, assignment: Upload };

function embedUrl(url: string) {
  try { const u = new URL(url); const host = u.hostname.toLowerCase();
    const youtubeId = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1];
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host) && youtubeId && /^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return `https://www.youtube-nocookie.com/embed/${youtubeId}`;
    if (["youtu.be", "www.youtu.be"].includes(host)) { const id = u.pathname.split("/").filter(Boolean)[0]; if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`; }
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) { const id = u.pathname.match(/\/(?:video\/)?(\d+)(?:\/|$)/)?.[1]; if (id) return `https://player.vimeo.com/video/${id}`; }
  } catch { /* invalid */ } return null;
}

export function Player({ courseId, title, enrollmentId, modules, completed, currentId }: { courseId: string; title: string; enrollmentId: string; modules: any[]; completed: string[]; currentId?: string }) {
  const done = new Set(completed); const flat = modules.flatMap((m) => m.lessons);
  const lesson = flat.find((l) => l.id === currentId); const idx = flat.findIndex((l) => l.id === currentId);
  const previous = idx > 0 ? flat[idx - 1] : undefined;
  const next = idx >= 0 ? flat[idx + 1] : undefined;
  const isDone = lesson && done.has(lesson.id);
  const completedCount = flat.filter((item) => done.has(item.id)).length;
  const progress = flat.length ? Math.round((completedCount / flat.length) * 100) : 0;
  const quiz = lesson?.quizzes?.[0] ?? lesson?.quizzes; const q = Array.isArray(lesson?.quizzes) ? lesson.quizzes[0] : lesson?.quizzes;
  void quiz;
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
      <nav aria-label="Course outline" className="card h-fit max-h-[38vh] overflow-y-auto p-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
        <div className="px-2 pb-3">
          <h2 className="line-clamp-2 text-sm font-semibold sm:text-base">{title}</h2>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-ink-soft"><span>Course progress</span><span className="tabular-nums">{completedCount} / {flat.length}</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Course progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${progress}%` }} /></div>
        </div>
        {modules.map((m) => (
          <div key={m.id} className="mb-3"><p className="break-words px-2 py-1 text-xs font-medium text-ink-faint">{m.title}</p>
            <ul>{m.lessons.map((l: any) => { const Icon = ICON[l.type] ?? FileText; const d = done.has(l.id);
              return <li key={l.id}><Link href={`/learner/learn/${courseId}?lesson=${l.id}`} aria-current={l.id === currentId ? "page" : undefined}
                className={cn("flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-surface-muted", l.id === currentId && "bg-brand-soft text-brand")}>
                {d ? <CheckCircle2 size={16} className="text-ok" /> : <Circle size={16} className="text-ink-faint" />}<Icon size={14} className="shrink-0 text-ink-faint" /><span className="truncate">{l.title}</span></Link></li>; })}</ul></div>))}
      </nav>
      <article className="card min-w-0 p-4 sm:p-6">
        {!lesson ? <div className="grid min-h-40 place-items-center text-center"><p className="text-sm text-ink-soft">This course has no lessons yet.</p></div> : <>
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-brand">Lesson {idx + 1} of {flat.length}</p><h1 className="mt-1 break-words text-xl font-semibold sm:text-2xl">{lesson.title}</h1></div><span className="chip shrink-0 bg-surface-muted capitalize text-ink-soft">{lesson.type.replace(/_/g, " ")}</span></div>
          <div className="mt-5 space-y-5">
            {lesson.type === "video" && (() => { const url = lesson.body?.url as string | undefined; const e = url ? embedUrl(url) : null; const uploaded = lesson.lesson_resources?.find((resource: any) => resource.id === lesson.body?.resource_id);
              return e ? <div className="aspect-video overflow-hidden rounded-xl bg-black"><iframe src={e} title={lesson.title} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
                : uploaded ? <video controls playsInline preload="metadata" className="w-full rounded-xl bg-black" src={`/learner/resource/${uploaded.id}`}><track kind="captions" /></video>
                : url ? <video controls playsInline preload="metadata" className="w-full rounded-xl bg-black" src={url}><track kind="captions" /></video> : <p className="text-ink-soft">Video not available.</p>; })()}
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
          <div className="mt-8 flex flex-col gap-4 border-t border-surface-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            {isDone ? <span className="inline-flex items-center gap-2 text-sm text-ok"><CheckCircle2 size={18} />Completed</span> :
              lesson.type !== "quiz" && lesson.type !== "assignment" && lesson.type !== "live" ? (
                <form action={completeLessonAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="enrollmentId" value={enrollmentId} />
                  <button className="btn-primary">Mark as complete</button></form>) : <span className="text-sm text-ink-soft">Completes when you meet the lesson requirement.</span>}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {previous && <Link className="btn-outline flex-1 sm:flex-none" href={`/learner/learn/${courseId}?lesson=${previous.id}`}><ChevronLeft size={16} />Previous</Link>}
              {next && <Link className="btn-primary flex-1 sm:flex-none" href={`/learner/learn/${courseId}?lesson=${next.id}`}>Next lesson<ChevronRight size={16} /></Link>}
            </div>
          </div></>}
      </article>
    </div>
  );
}
