import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";

export function CourseCard({ course }: { course: any }) {
  const v = Array.isArray(course.course_versions) ? course.course_versions[0] : course.course_versions;
  const minutes = Number(v?.estimated_minutes ?? 0);
  const duration = minutes ? (minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${Math.floor(minutes / 60) === 1 ? "" : "s"}${minutes % 60 ? ` ${minutes % 60} min` : ""}`) : null;
  return (
    <Link href={`/courses/${course.slug}`} className="card group block min-w-0 overflow-hidden border border-surface-line transition duration-200 hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-brand-soft via-[#e7eef0] to-surface-muted">
        {v?.thumbnail_path && <img src={v.thumbnail_path} alt="" width={1200} height={675} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />}
        {!v?.thumbnail_path && <div className="absolute inset-0 grid place-items-center text-brand/60"><BookOpen size={42} strokeWidth={1.4} aria-hidden="true" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-[#102b31]/70 via-[#102b31]/5 to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-full border border-white/25 bg-[#102b31]/75 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">{course.categories?.name ?? "General"}</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs font-medium text-ink-faint">
          <span className="rounded-md bg-surface-muted px-2 py-1 capitalize text-ink-soft">{v?.level ?? "All levels"}</span>
          {duration && <span>{duration}</span>}
        </div>
        <h3 className="mt-3 line-clamp-2 min-h-[3.25rem] text-lg font-semibold leading-snug text-ink group-hover:text-brand">{v?.title}</h3>
        <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-ink-soft">{v?.subtitle || "Explore the course and start learning at your own pace."}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">View course <ArrowUpRight size={16} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></span>
      </div>
    </Link>
  );
}
