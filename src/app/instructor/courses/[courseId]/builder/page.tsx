import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, GripVertical, Trash2, ClipboardList, PlayCircle, FileText, Link2, FileDown, Radio, Upload, ListChecks, Plus, MessageSquareWarning, Eye, Menu } from "lucide-react";
import { getBuilderData, validateVersion } from "@/services/authoring";
import { listCategories } from "@/services/catalog";
import { StatusDot, Badge } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { addModuleAction, deleteModuleAction, addLessonAction, deleteLessonAction, moveAction, submitReviewAction, createRevisionAction, saveMetaAction } from "@/app/actions";
import { cn } from "@/lib/utils";
import { VideoLessonUploadForm } from "@/components/VideoLessonUploadForm";

export const metadata = { title: "Course studio" };
const ICON: Record<string, React.ElementType> = { video: PlayCircle, text: FileText, quiz: ClipboardList, external: Link2, document: FileDown, live: Radio, assignment: Upload, practical: ListChecks, survey: ListChecks };
const label = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default async function Builder({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ tab?: string; error?: string }> }) {
  const { courseId } = await params; const sp = await searchParams;
  const data = await getBuilderData(courseId); if (!data) notFound();
  const { version: v, modules, feedback, course } = data;
  const editable = ["draft", "changes_requested"].includes(v.status);
  const issues = editable ? await validateVersion(v.id) : [];
  const tab = sp.tab === "settings" ? "settings" : "curriculum";
  const reviews = (feedback as any[]).flatMap((s) => s.course_reviews);
  const canRevise = !editable && v.status === "published";
  const cats = await listCategories();
  const base = `/instructor/courses/${courseId}/builder`;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header card: breadcrumb, status, primary actions */}
      <header className="card p-5">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[15px]">
          <Link href="/instructor/dashboard" className="text-brand hover:underline">Dashboard</Link><ChevronRight size={14} className="text-ink-faint" />
          <Link href="/instructor/courses" className="text-brand hover:underline">Courses</Link><ChevronRight size={14} className="text-ink-faint" />
          <span className="text-ink-soft">{v.title}</span>
        </nav>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <StatusDot status={v.status} label={label(v.status)} />
          <span className="text-sm text-ink-faint">Version {v.version_number}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {editable && (<form action={submitReviewAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="versionId" value={v.id} />
              <button className="btn-primary" disabled={issues.length > 0} title={issues.length ? "Fix the items listed below first" : undefined}>Submit for review</button></form>)}
            <a href="#feedback" className="btn-ghost"><MessageSquareWarning size={18} />Admin feedback{reviews.length > 0 && <span className="chip bg-brand-soft text-brand">{reviews.length}</span>}</a>
            <Link href={`/instructor/courses/${courseId}/preview`} className="btn-ghost"><Eye size={18} />Preview as student</Link>
            <details className="relative"><summary className="btn-ghost cursor-pointer list-none"><Menu size={18} />Quick actions</summary>
              <div className="absolute right-0 z-10 mt-2 w-64 space-y-1 rounded-xl border border-surface-line bg-white p-2 shadow-lg">
                <Link className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-muted" href={`${base}?tab=settings`}>Course settings</Link>
                {canRevise && <form action={createRevisionAction} className="space-y-2 p-2"><input type="hidden" name="courseId" value={courseId} /><input name="summary" className="input" placeholder="What will change?" aria-label="Revision summary" /><button className="btn-outline w-full">Create draft revision</button></form>}
                {course?.slug && v.status === "published" && <Link className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-muted" href={`/courses/${course.slug}`}>View public page</Link>}
              </div></details>
          </div>
        </div>
      </header>

      <Flash error={sp.error} />
      {issues.length > 0 && (
        <section aria-label="Before you can submit" className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-medium text-amber-900">Fix {issues.length} {issues.length === 1 ? "item" : "items"} before submitting</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-amber-900">{issues.map((i) => <li key={i.code + i.message}>{i.message}</li>)}</ul></section>)}
      {!editable && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-brand">This version is {label(v.status).toLowerCase()} and read-only. {canRevise ? "Create a draft revision from Quick actions to make changes." : ""}</p>}

      <div role="tablist" aria-label="Course sections" className="flex gap-8 border-b border-surface-line px-2">
        {([["curriculum", "Curriculum"], ["settings", "Settings"]] as const).map(([k, l]) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={k === "curriculum" ? base : `${base}?tab=settings`} className={cn("-mb-px border-b-2 px-1 pb-3 pt-2 text-lg", tab === k ? "border-brand font-medium text-brand" : "border-transparent text-ink-soft hover:text-ink")}>{l}</Link>))}
      </div>

      {tab === "curriculum" ? (
        <section aria-labelledby="cur" className="space-y-4">
          <div className="flex items-center justify-between"><h2 id="cur" className="text-2xl font-semibold">Course curriculum</h2>
            {editable && <details className="relative"><summary className="btn-primary cursor-pointer list-none"><Plus size={18} />Add module</summary>
              <form action={addModuleAction} className="absolute right-0 z-10 mt-2 w-80 space-y-3 rounded-xl border border-surface-line bg-white p-4 shadow-lg"><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="versionId" value={v.id} />
                <input name="title" className="input" placeholder="Module title" required minLength={2} aria-label="Module title" /><button className="btn-primary w-full">Add module</button></form></details>}</div>
          {modules.length === 0 && <div className="card px-6 py-12 text-center text-ink-soft">No modules yet. Add the first module to start building.</div>}
          {(modules as any[]).map((m, mi) => {
            const lessons = [...m.lessons].sort((a: any, b: any) => a.position - b.position);
            return (
              <article key={m.id} className="card overflow-hidden">
                <div className="flex items-start gap-4 p-6">
                  {editable ? <div className="flex flex-col"><MoveBtn courseId={courseId} table="modules" id={m.id} dir="up" disabled={mi === 0} /><GripVertical className="text-ink-faint" size={20} /><MoveBtn courseId={courseId} table="modules" id={m.id} dir="down" disabled={mi === modules.length - 1} /></div> : null}
                  <div className="flex-1"><p className="text-ink-soft">Module {mi + 1}</p><h3 className="text-xl font-semibold">{m.title}</h3><p className="mt-2 text-ink-faint">{lessons.length} lessons</p></div>
                  {editable && <form action={deleteModuleAction} className="flex items-center gap-3"><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="moduleId" value={m.id} /><span className="text-ink-soft">Edit</span>
                    <button className="rounded-lg p-2 text-danger hover:bg-red-50" aria-label={`Delete module ${m.title}`}><Trash2 size={18} /></button></form>}
                </div>
                <ul className="divide-y divide-surface-line border-t border-surface-line">
                  {lessons.map((l: any, li: number) => { const Icon = ICON[l.type] ?? FileText; const quiz = Array.isArray(l.quizzes) ? l.quizzes[0] : l.quizzes;
                    return (
                      <li key={l.id} className="flex items-center gap-4 px-6 py-5">
                        {editable && <div className="flex flex-col"><MoveBtn courseId={courseId} table="lessons" id={l.id} dir="up" disabled={li === 0} /><MoveBtn courseId={courseId} table="lessons" id={l.id} dir="down" disabled={li === lessons.length - 1} /></div>}
                        <span className={cn("grid h-11 w-11 place-items-center rounded-lg", l.type === "quiz" ? "bg-quiz-soft text-quiz" : "bg-surface-muted text-ink-soft")}><Icon size={20} /></span>
                        <div className="min-w-0 flex-1"><p className="truncate text-lg font-medium">{l.title}</p>{quiz && <p className="text-sm text-ink-faint">{quiz.questions?.length ?? 0} questions</p>}</div>
                        <span className={cn("chip", l.type === "quiz" ? "bg-quiz-soft text-quiz" : "bg-surface-muted text-ink-soft")}>{label(l.type)}</span>
                        {quiz && <Link href={`/instructor/courses/${courseId}/quiz/${quiz.id}`} className="inline-flex items-center gap-2 text-ink hover:text-brand"><ClipboardList size={18} />{editable ? "Edit quiz" : "View quiz"}</Link>}
                        {editable && <form action={deleteLessonAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="lessonId" value={l.id} /><button className="rounded-lg p-2 text-danger hover:bg-red-50" aria-label={`Delete lesson ${l.title}`}><Trash2 size={18} /></button></form>}
                      </li>); })}
                </ul>
                {editable && (
                  <details className="border-t border-surface-line"><summary className="cursor-pointer px-6 py-4 text-brand hover:bg-surface-muted"><Plus className="mr-2 inline" size={16} />Add lesson</summary>
                    <div className="grid gap-5 px-6 pb-6 lg:grid-cols-2">
                      <div className="space-y-4">
                        <section className="rounded-xl border border-brand/20 bg-brand-soft/30 p-4">
                          <h4 className="font-semibold">Add a video link</h4><p className="mt-1 text-xs leading-5 text-ink-soft">Paste a YouTube, Vimeo, or direct video URL. The link is embedded in the learner player.</p>
                          <form action={addLessonAction} className="mt-3 space-y-3"><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="moduleId" value={m.id} /><input type="hidden" name="type" value="video" />
                            <label className="label">Lesson title<input name="title" className="input mt-1" placeholder="For example, Welcome and course overview" required minLength={2} maxLength={160} /></label>
                            <label className="label">Video URL<input name="url" type="url" className="input mt-1" placeholder="https://youtu.be/…" required /></label>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label className="label">Duration in minutes <span className="font-normal text-ink-faint">(optional)</span><input name="durationMinutes" type="number" min={1} max={1000} className="input mt-1" /></label><label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft"><input type="checkbox" name="isRequired" defaultChecked className="accent-brand" />Required</label></div>
                            <button className="btn-primary">Add linked video</button>
                          </form>
                        </section>
                        <VideoLessonUploadForm courseId={courseId} versionId={v.id} moduleId={m.id} />
                      </div>
                      <form action={addLessonAction} className="space-y-3 rounded-xl border border-surface-line p-4"><div><h4 className="font-semibold">Add another lesson type</h4><p className="mt-1 text-xs text-ink-soft">Create reading, quiz, assignment, live, or external lessons.</p></div><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="moduleId" value={m.id} />
                        <label className="label">Lesson title<input name="title" className="input mt-1" placeholder="Lesson title" required minLength={2} maxLength={160} /></label>
                        <label className="label">Lesson type<select name="type" className="input mt-1">{["text", "document", "external", "quiz", "assignment", "practical", "live", "survey"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
                        <label className="label">Resource link <span className="font-normal text-ink-faint">(optional)</span><input name="url" type="url" className="input mt-1" placeholder="https://…" /></label>
                        <label className="label">Duration in minutes <span className="font-normal text-ink-faint">(optional)</span><input name="durationMinutes" type="number" min={0} max={1000} className="input mt-1" /></label>
                        <label className="label">Lesson text<textarea name="text" rows={4} className="input mt-1" placeholder="Add reading content for text lessons" /></label>
                        <label className="flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" name="isRequired" defaultChecked className="accent-brand" />Required lesson</label>
                        <button className="btn-outline">Add lesson</button>
                      </form>
                    </div></details>)}
              </article>);
          })}
        </section>
      ) : (
        <form action={saveMetaAction} className="card space-y-5 p-6"><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="versionId" value={v.id} />
          <fieldset disabled={!editable} className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2"><label className="label" htmlFor="title">Title</label><input id="title" name="title" defaultValue={v.title} className="input" required /></div>
            <div className="md:col-span-2"><label className="label" htmlFor="subtitle">Subtitle</label><input id="subtitle" name="subtitle" defaultValue={v.subtitle ?? ""} className="input" /></div>
            <div className="md:col-span-2"><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={v.description ?? ""} rows={5} className="input" /></div>
            <div className="md:col-span-2"><label className="label" htmlFor="objectives">Learning objectives</label><textarea id="objectives" name="objectives" defaultValue={(v.objectives ?? []).join("\n")} rows={4} className="input" /><p className="mt-1 text-xs text-ink-faint">One per line.</p></div>
            <div className="md:col-span-2"><label className="label" htmlFor="prerequisites">Prerequisites</label><input id="prerequisites" name="prerequisites" defaultValue={v.prerequisites ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="language">Language</label><select id="language" name="language" defaultValue={v.language ?? "en"} className="input"><option value="en">English</option></select></div>
            <div><label className="label" htmlFor="level">Level</label><select id="level" name="level" defaultValue={v.level} className="input"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
            <div><label className="label" htmlFor="estimatedMinutes">Estimated minutes</label><input id="estimatedMinutes" name="estimatedMinutes" type="number" min={0} defaultValue={v.estimated_minutes ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="enrollmentPolicy">Enrollment</label><select id="enrollmentPolicy" name="enrollmentPolicy" defaultValue={v.enrollment_policy} className="input"><option value="open">Open</option><option value="approval">Approval required</option><option value="invite_only">Invite only</option></select></div>
            <div><label className="label" htmlFor="passMark">Pass mark (%)</label><input id="passMark" name="passMark" type="number" min={0} max={100} defaultValue={v.pass_mark} className="input" /></div>
            <label className="flex items-center gap-2 md:col-span-2"><input type="checkbox" name="certificateEnabled" defaultChecked={v.certificate_enabled} />Issue a certificate on completion</label>
            <div><label className="label" htmlFor="seoTitle">SEO title</label><input id="seoTitle" name="seoTitle" maxLength={70} defaultValue={v.seo_title ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="seoDescription">SEO description</label><input id="seoDescription" name="seoDescription" maxLength={160} defaultValue={v.seo_description ?? ""} className="input" /></div>
          </fieldset>
          {editable && <button className="btn-primary">Save changes</button>}
          <p className="text-xs text-ink-faint">Categories: {cats.map((c) => c.name).join(", ")}. Contact an administrator to move a course between categories.</p>
        </form>
      )}

      <section id="feedback" aria-labelledby="fb" className="card p-6"><h2 id="fb" className="text-lg font-semibold">Reviewer feedback</h2>
        {reviews.length === 0 ? <p className="mt-2 text-sm text-ink-soft">No feedback yet.</p> : <ul className="mt-3 space-y-3">{reviews.map((r: any, i: number) => <li key={i} className="rounded-lg bg-surface-muted p-3 text-sm"><Badge status={r.decision === "approved" ? "approved" : "changes_requested"}>{label(r.decision)}</Badge><p className="mt-2">{r.summary}</p></li>)}</ul>}</section>
    </div>
  );
}

function MoveBtn({ courseId, table, id, dir, disabled }: { courseId: string; table: string; id: string; dir: "up" | "down"; disabled: boolean }) {
  return (<form action={moveAction}><input type="hidden" name="courseId" value={courseId} /><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="dir" value={dir} />
    <button disabled={disabled} aria-label={`Move ${dir}`} className="px-1 text-xs leading-none text-ink-faint hover:text-ink disabled:opacity-20">{dir === "up" ? "▲" : "▼"}</button></form>);
}
