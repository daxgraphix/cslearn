import Link from "next/link";
import { listCatalog, listCategories } from "@/services/catalog";
import { CourseCard } from "@/components/CourseCard";
import { Empty } from "@/components/ui";
import { getT } from "@/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Online Course Catalog",
  description: "Browse practical online courses by subject and level. Find structured lessons, assessments, learning paths, and certificates.",
  alternates: { canonical: "/courses" },
};

export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const t = await getT();
  const page = Number(sp.page ?? 1) || 1;
  const [res, cats] = await Promise.all([
    listCatalog({ q: sp.q, category: sp.category, level: sp.level, language: sp.language, page }), listCategories()]);
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#102b31] via-[#17434a] to-brand px-6 py-8 text-white shadow-card sm:px-9 sm:py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">Learn at your pace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t("catalog.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Explore practical courses, find a topic that fits your goals, and build skills one lesson at a time.</p>
        <div className="mt-5 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white/90">{res.total} {res.total === 1 ? "course" : "courses"} available</div>
      </header>
      <form className="card grid gap-3 p-4 sm:p-5 md:grid-cols-[2fr_1fr_1fr_auto]" role="search">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Search courses by title" aria-label="Search courses" />
        <select className="input" name="category" defaultValue={sp.category ?? ""} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
        <select className="input" name="level" defaultValue={sp.level ?? ""} aria-label="Level"><option value="">Any level</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
        <div className="flex gap-2"><select className="input" name="language" defaultValue={sp.language ?? "en"} aria-label="Language"><option value="en">English</option></select><button className="btn-primary shrink-0">Find courses</button></div>
      </form>
      <section aria-label="Course results">
        <div className="mb-4 flex items-end justify-between gap-3"><div><h2 className="text-xl font-semibold">{sp.q || sp.category || sp.level ? "Search results" : "Explore courses"}</h2><p className="mt-1 text-sm text-ink-soft">{res.total ? `Showing ${Math.min((page - 1) * res.pageSize + 1, res.total)}–${Math.min(page * res.pageSize, res.total)} of ${res.total}` : "Try changing your search or filters."}</p></div></div>
        {res.items.length === 0 ? <Empty title={t("catalog.empty")} /> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{res.items.map((c: any) => <CourseCard key={c.id} course={c} />)}</div>}
      </section>
      {pages > 1 && <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => <Link key={p} href={qs({ page: String(p) })} aria-current={p === page ? "page" : undefined} className={p === page ? "btn-primary" : "btn-outline"}>{p}</Link>)}</nav>}
    </div>
  );
}
