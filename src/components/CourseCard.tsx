import Link from "next/link";

export function CourseCard({ course }: { course: any }) {
  const v = Array.isArray(course.course_versions) ? course.course_versions[0] : course.course_versions;
  return (
    <Link href={`/courses/${course.slug}`} className="card group block min-w-0 overflow-hidden border border-surface-line transition-shadow hover:shadow-md">
      <div className="relative aspect-[16/9] overflow-hidden bg-[#e7eef0]">
        {v?.thumbnail_path && <img src={v.thumbnail_path} alt="" width={1200} height={675} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#102b31]/65 via-transparent to-transparent" />
        <span className="absolute bottom-3 left-3 rounded-md border border-white/30 bg-[#102b31]/75 px-2.5 py-1 text-xs font-medium text-white">{course.categories?.name ?? "General"}</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-ink-faint">
          <span className="capitalize">{v?.level ?? "Course"}</span>
          {v?.estimated_minutes > 0 && <span>{Math.ceil(v.estimated_minutes / 60)} hr{v.estimated_minutes > 60 ? "s" : ""}</span>}
        </div>
        <h3 className="mt-2 line-clamp-2 font-semibold leading-snug text-ink group-hover:text-brand">{v?.title}</h3>
        {v?.subtitle && <p className="mt-2 line-clamp-2 text-sm leading-5 text-ink-soft">{v.subtitle}</p>}
      </div>
    </Link>
  );
}
