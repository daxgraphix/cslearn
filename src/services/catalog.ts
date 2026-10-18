import "server-only";
import { cache } from "react";
import { createSupabase } from "@/lib/supabase/server";

export type CatalogFilters = { q?: string; category?: string; level?: string; language?: string; page?: number; limit?: number; includeCount?: boolean };
const PAGE = 12;

/** Public catalog: only published, non-retired courses (RLS enforces this as well). */
export async function listCatalog(f: CatalogFilters) {
  const supabase = await createSupabase();
  let q = supabase.from("courses")
    .select("id, slug, categories(name, slug), course_versions!fk_courses_published_version!inner(id,title,subtitle,level,language,thumbnail_path,estimated_minutes)", f.includeCount === false ? undefined : { count: "exact" })
    .not("published_version_id", "is", null).is("archived_at", null).eq("visibility", "public");
  if (f.q) q = q.ilike("course_versions.title", `%${f.q.replace(/[%_]/g, "")}%`);
  if (f.level) q = q.eq("course_versions.level", f.level);
  if (f.language) q = q.eq("course_versions.language", f.language);
  if (f.category) { const { data: c } = await supabase.from("categories").select("id").eq("slug", f.category).single(); if (c) q = q.eq("category_id", c.id); }
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.max(1, Math.min(f.limit ?? PAGE, PAGE));
  const { data, count } = await q.order("created_at", { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);
  return { items: data ?? [], total: count ?? 0, page, pageSize };
}

export const getPublishedCourse = cache(async (slug: string) => {
  const supabase = await createSupabase();
  const { data } = await supabase.from("courses")
    .select(`id, slug, categories(name), course_versions!fk_courses_published_version!inner(*, modules(id, title, position, lessons(id, title, type, position, duration_minutes)))`)
    .eq("slug", slug).is("archived_at", null).maybeSingle();
  return data;
});

export async function listCategories() {
  const supabase = await createSupabase();
  const { data } = await supabase.from("categories").select("id, slug, name, name_sw").order("position");
  return data ?? [];
}
