import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedCourse } from "@/services/catalog";
import { getSessionUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { enrollAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { getT } from "@/i18n";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c: any = await getPublishedCourse((await params).slug); const v = c?.course_versions;
  return { title: v?.seo_title ?? v?.title ?? "Course", description: v?.seo_description ?? v?.subtitle ?? undefined };
}

export default async function CourseDetail({ params, searchParams }: P) {
  const { slug } = await params; const { error } = await searchParams;
  const t = await getT();
  const course: any = await getPublishedCourse(slug);
  if (!course) notFound();
  const v = course.course_versions; const user = await getSessionUser();
  let enrolled = false;
  if (user) { const { data } = await (await createSupabase()).from("enrollments").select("id").eq("learner_id", user.id).eq("course_id", course.id).in("status", ["active", "completed"]).maybeSingle(); enrolled = !!data; }
  const modules = [...(v.modules ?? [])].sort((a: any, b: any) => a.position - b.position);
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <Flash error={error} />
        <p className="text-sm text-ink-faint">{course.categories?.name} · {v.level} · English</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{v.title}</h1>
        {v.subtitle && <p className="mt-2 text-lg text-ink-soft">{v.subtitle}</p>}
        {v.thumbnail_path && <figure className="mt-6 aspect-[16/9] overflow-hidden rounded-xl border border-surface-line bg-surface-muted">
          <img src={v.thumbnail_path} alt="" width={1200} height={675} fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
        </figure>}
        {v.description && <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed">{v.description}</p>}
        {v.objectives?.length > 0 && <section className="mt-8"><h2 className="text-lg font-semibold">What you will learn</h2><ul className="mt-3 list-disc space-y-1 pl-5">{v.objectives.map((o: string) => <li key={o}>{o}</li>)}</ul></section>}
        {v.prerequisites && <section className="mt-8"><h2 className="text-lg font-semibold">Before you start</h2><p className="mt-2 text-ink-soft">{v.prerequisites}</p></section>}
        <section className="mt-8"><h2 className="text-lg font-semibold">Curriculum</h2>
          <div className="mt-3 space-y-3">{modules.map((m: any) => (
            <details key={m.id} className="card px-4 py-3" open={modules.length < 4}>
              <summary className="cursor-pointer font-medium">{m.title} <span className="text-sm font-normal text-ink-faint">· {m.lessons?.length ?? 0} lessons</span></summary>
              <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">{[...(m.lessons ?? [])].sort((a: any, b: any) => a.position - b.position).map((l: any) => <li key={l.id} className="flex justify-between"><span>{l.title}</span><span className="text-ink-faint">{l.type}</span></li>)}</ul>
            </details>))}</div>
        </section>
      </div>
      <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-6">
        <p className="text-3xl font-semibold">{t("common.free")}</p>
        {v.estimated_minutes && <p className="text-sm text-ink-soft">About {Math.round(v.estimated_minutes / 60)} hours</p>}
        {v.certificate_enabled && <p className="text-sm text-ink-soft">Certificate on completion (pass mark {v.pass_mark}%)</p>}
        {enrolled ? <Link className="btn-primary w-full" href={`/learner/learn/${course.id}`}>Continue learning</Link>
          : !user ? <Link className="btn-primary w-full" href={`/login?next=/courses/${slug}`}>Log in to enroll</Link>
            : <form action={enrollAction}><input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="slug" value={slug} />
              <button className="btn-primary w-full">Enroll for free</button></form>}
      </aside>
    </div>
  );
}
