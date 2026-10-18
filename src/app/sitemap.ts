import type { MetadataRoute } from "next";
import { createSupabase } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const fixed: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/courses`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/learning-paths`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/help`, changeFrequency: "monthly", priority: 0.4 },
  ];
  const supabase = await createSupabase();
  const courses: { slug: string; updated_at: string }[] = [];
  for (let offset = 0; offset < 50_000; offset += 1000) {
    const { data, error } = await supabase.from("courses").select("slug, course_versions!fk_courses_published_version!inner(updated_at)")
      .eq("visibility", "public").is("archived_at", null).not("published_version_id", "is", null)
      .order("slug").range(offset, offset + 999);
    if (error) throw error;
    const rows = (data ?? []) as any[];
    courses.push(...rows.map((row) => ({ slug: row.slug, updated_at: row.course_versions?.updated_at })));
    if (rows.length < 1000) break;
  }
  return [...fixed, ...courses.map((course) => ({
    url: `${base}/courses/${encodeURIComponent(course.slug)}`,
    lastModified: course.updated_at ? new Date(course.updated_at) : undefined,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }))];
}
