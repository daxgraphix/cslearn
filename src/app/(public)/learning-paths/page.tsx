import Link from "next/link";
import { createSupabase } from "@/lib/supabase/server";
import { Empty } from "@/components/ui";
export const metadata = { title: "Learning paths" };
export default async function Paths() {
  const { data } = await (await createSupabase()).from("learning_paths").select("id, title, description, learning_path_courses(position, courses(slug, course_versions!fk_courses_published_version(title)))").eq("status", "published");
  return (
    <div><h1 className="text-3xl font-semibold tracking-tight">Learning paths</h1>
      <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">{(data ?? []).length === 0 ? <Empty title="No learning paths yet" /> : (data ?? []).map((p: any) => (
        <section key={p.id} className="card min-w-0 p-4 sm:p-5"><h2 className="break-words text-lg font-semibold">{p.title}</h2><p className="mt-1 break-words text-sm text-ink-soft">{p.description}</p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">{[...p.learning_path_courses].sort((a: any, b: any) => a.position - b.position).map((c: any) => <li key={c.courses.slug} className="break-words"><Link className="text-brand hover:underline" href={`/courses/${c.courses.slug}`}>{c.courses.course_versions?.title}</Link></li>)}</ol></section>))}</div></div>
  );
}
