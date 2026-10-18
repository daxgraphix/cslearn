import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, Clock3, Layers3 } from "lucide-react";
import { getPublishedCourse } from "@/services/catalog";
import { getSessionUser } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { enrollAction } from "@/app/actions";
import { Flash } from "@/components/Flash";
import { getT } from "@/i18n";
import { getSiteUrl } from "@/lib/site-url";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ error?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const course: any = await getPublishedCourse((await params).slug);
  const version = course?.course_versions;
  if (!course || !version) return { title: "Course not found", robots: { index: false, follow: false } };
  const title = version.seo_title ?? version.title;
  const description = version.seo_description ?? version.subtitle ?? "Explore the course, review its curriculum, and learn at your own pace.";
  const image = version.thumbnail_path ? [{ url: version.thumbnail_path, width: 1200, height: 630, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { type: "website", title, description, url: `/courses/${course.slug}`, images: image },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image?.map((item) => item.url) },
  };
}

export default async function CourseDetail({ params, searchParams }: P) {
  const { slug } = await params;
  const { error } = await searchParams;
  const t = await getT();
  const course: any = await getPublishedCourse(slug);
  if (!course) notFound();
  const version = course.course_versions;
  const user = await getSessionUser();
  let enrolled = false;
  if (user) {
    const { data } = await (await createSupabase()).from("enrollments").select("id").eq("learner_id", user.id).eq("course_id", course.id).in("status", ["active", "completed"]).maybeSingle();
    enrolled = !!data;
  }
  const modules = [...(version.modules ?? [])].sort((a: any, b: any) => a.position - b.position);
  const lessonCount = modules.reduce((sum: number, module: any) => sum + (module.lessons?.length ?? 0), 0);
  const hours = version.estimated_minutes ? Math.floor(version.estimated_minutes / 60) : 0;
  const minutes = version.estimated_minutes ? version.estimated_minutes % 60 : 0;
  const duration = version.estimated_minutes ? [hours ? `${hours} hr${hours === 1 ? "" : "s"}` : "", minutes ? `${minutes} min` : ""].filter(Boolean).join(" ") : null;
  const courseStructuredData = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: version.title,
    description: version.seo_description ?? version.subtitle ?? version.description ?? undefined,
    url: `${getSiteUrl()}/courses/${encodeURIComponent(slug)}`,
    provider: { "@type": "Organization", name: "CSGO Learning" },
    educationalLevel: version.level,
    inLanguage: version.language ?? "en",
    isAccessibleForFree: true,
    timeRequired: version.estimated_minutes ? `PT${version.estimated_minutes}M` : undefined,
    image: version.thumbnail_path || undefined,
  };

  return <div className="space-y-7">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(courseStructuredData).replace(/</g, "\\u003c") }} />
    <Flash error={error} />
    <header className="relative isolate overflow-hidden rounded-2xl bg-gradient-to-br from-[#102b31] via-[#17434a] to-brand text-white shadow-card">
      {version.thumbnail_path && <img src={version.thumbnail_path} alt="" width={1600} height={900} fetchPriority="high" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-25" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#102b31]/95 via-[#102b31]/80 to-brand/55" />
      <div className="max-w-4xl px-6 py-8 sm:px-10 sm:py-12">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/75">
          <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1">{course.categories?.name ?? "General"}</span>
          <span className="capitalize">{version.level}</span><span aria-hidden="true">·</span><span>English</span>
        </div>
        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">{version.title}</h1>
        {version.subtitle && <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">{version.subtitle}</p>}
        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/80">
          {duration && <span className="inline-flex items-center gap-2"><Clock3 size={17} />{duration}</span>}
          <span className="inline-flex items-center gap-2"><Layers3 size={17} />{modules.length} {modules.length === 1 ? "module" : "modules"}</span>
          <span className="inline-flex items-center gap-2"><BookOpen size={17} />{lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</span>
          {version.certificate_enabled && <span className="inline-flex items-center gap-2"><Award size={17} />Certificate included</span>}
        </div>
      </div>
    </header>

    <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
      <main className="min-w-0 space-y-7">
        {version.description && <section className="card p-5 sm:p-7"><h2 className="text-xl font-semibold">About this course</h2><p className="mt-3 max-w-prose whitespace-pre-line leading-7 text-ink-soft">{version.description}</p></section>}
        {version.objectives?.length > 0 && <section className="card p-5 sm:p-7"><h2 className="text-xl font-semibold">What you will learn</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{version.objectives.map((objective: string) => <li key={objective} className="flex gap-3 rounded-xl bg-surface-muted/70 p-3 text-sm leading-6"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ok" /><span>{objective}</span></li>)}</ul></section>}
        {version.prerequisites && <section className="rounded-xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Before you start</h2><p className="mt-2 text-sm leading-6 text-amber-900">{version.prerequisites}</p></section>}
        <section aria-labelledby="curriculum-title">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><h2 id="curriculum-title" className="text-xl font-semibold">Course content</h2><p className="mt-1 text-sm text-ink-soft">{modules.length} {modules.length === 1 ? "module" : "modules"} · {lessonCount} {lessonCount === 1 ? "lesson" : "lessons"}</p></div></div>
          {modules.length === 0 ? <div className="card p-5 text-sm text-ink-soft">Course content will be available after enrollment.</div> : <div className="space-y-3">{modules.map((module: any, index: number) => {
            const lessons = [...(module.lessons ?? [])].sort((a: any, b: any) => a.position - b.position);
            return <details key={module.id} className="card overflow-hidden" open={modules.length <= 2}>
              <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 marker:hidden hover:bg-surface-muted/50 sm:px-5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">{String(index + 1).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1"><span className="block font-semibold">{module.title}</span><span className="mt-1 block text-xs text-ink-faint">{lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}</span></span>
                <span className="text-ink-faint" aria-hidden="true">⌄</span>
              </summary>
              <ul className="divide-y divide-surface-line border-t border-surface-line">{lessons.map((lesson: any, lessonIndex: number) => <li key={lesson.id} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-xs font-medium text-ink-soft">{lessonIndex + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{lesson.title}</span><span className="chip shrink-0 bg-surface-muted capitalize text-ink-soft">{lesson.type.replace(/_/g, " ")}</span>
              </li>)}</ul>
            </details>;
          })}</div>}
        </section>
      </main>

      <aside className="card space-y-5 p-5 lg:sticky lg:top-6">
        <div><p className="text-2xl font-semibold">{t("common.free")}</p><p className="mt-1 text-sm text-ink-soft">Learn online at your own pace.</p></div>
        <div className="space-y-3 border-y border-surface-line py-4 text-sm text-ink-soft">
          {duration && <p className="flex items-center gap-2"><Clock3 size={17} className="text-brand" />{duration} of learning</p>}
          <p className="flex items-center gap-2"><BookOpen size={17} className="text-brand" />{lessonCount} lessons across {modules.length} {modules.length === 1 ? "module" : "modules"}</p>
          {version.certificate_enabled && <p className="flex items-center gap-2"><Award size={17} className="text-brand" />Certificate on completion (pass mark {version.pass_mark}%)</p>}
        </div>
        {enrolled ? <Link className="btn-primary w-full" href={`/learner/learn/${course.id}`}>Continue learning <ArrowRight size={17} /></Link>
          : !user ? <Link className="btn-primary w-full" href={`/login?next=/courses/${slug}`}>Log in to enroll <ArrowRight size={17} /></Link>
            : <form action={enrollAction}><input type="hidden" name="courseId" value={course.id} /><input type="hidden" name="slug" value={slug} /><button className="btn-primary w-full">Enroll for free <ArrowRight size={17} /></button></form>}
        <p className="text-center text-xs text-ink-faint">{enrolled ? "Your course progress is saved." : "Free enrollment · Start whenever you are ready"}</p>
      </aside>
    </div>
  </div>;
}
