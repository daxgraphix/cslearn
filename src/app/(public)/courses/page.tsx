import Link from "next/link";
import { listCatalog, listCategories } from "@/services/catalog";
import { CourseCard } from "@/components/CourseCard";
import { Empty } from "@/components/ui";
import { getT } from "@/i18n";

export const metadata = { title: "Course catalog" };

export default async function Catalog({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams; const t = await getT();
  const page = Number(sp.page ?? 1) || 1;
  const [res, cats] = await Promise.all([
    listCatalog({ q: sp.q, category: sp.category, level: sp.level, language: sp.language, page }), listCategories()]);
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const qs = (o: Record<string, string | undefined>) => "?" + new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("catalog.title")}</h1>
      <form className="card mt-5 grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]" role="search">
        <input className="input" name="q" defaultValue={sp.q} placeholder="Search by title" aria-label="Search" />
        <select className="input" name="category" defaultValue={sp.category ?? ""} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
        <select className="input" name="level" defaultValue={sp.level ?? ""} aria-label="Level"><option value="">Any level</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select>
        <select className="input" name="language" defaultValue={sp.language ?? "en"} aria-label="Language"><option value="en">English</option></select>
        <button className="btn-primary">Filter</button>
      </form>
      <div className="mt-6">
        {res.items.length === 0 ? <Empty title={t("catalog.empty")} /> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{res.items.map((c: any) => <CourseCard key={c.id} course={c} />)}</div>}
      </div>
      {pages > 1 && <nav className="mt-8 flex justify-center gap-2" aria-label="Pagination">
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => <Link key={p} href={qs({ page: String(p) })} aria-current={p === page ? "page" : undefined} className={p === page ? "btn-primary" : "btn-outline"}>{p}</Link>)}</nav>}
    </div>
  );
}
