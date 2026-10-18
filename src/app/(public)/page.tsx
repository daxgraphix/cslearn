import Link from "next/link";
import { listCatalog, listCategories } from "@/services/catalog";
import { CourseCard } from "@/components/CourseCard";
import { getT } from "@/i18n";
import { getSessionUser } from "@/lib/auth";
import { defaultWorkspacePath, portalsFor } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ArrowRight, Award, BookOpenCheck, BriefcaseBusiness, Compass, ShieldCheck, Users } from "lucide-react";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(defaultWorkspacePath(portalsFor(user.roles, user.permissions, user.orgManagerOf.length > 0)));
  const t = await getT();
  const [catalogResult, categoriesResult] = await Promise.allSettled([
    listCatalog({ limit: 6, includeCount: false }),
    listCategories(),
  ]);
  const items = catalogResult.status === "fulfilled" ? catalogResult.value.items : [];
  const cats = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const steps = [
    { icon: Compass, title: "Choose a direction", description: "Browse practical courses and learning paths built around clear subjects and goals." },
    { icon: BookOpenCheck, title: "Learn at your pace", description: "Work through structured lessons, practice what you learn, and track your progress." },
    { icon: Award, title: "Show what you know", description: "Complete assessments and earn a certificate that can be verified online." },
  ];
  const features = [
    { icon: BriefcaseBusiness, title: "Practical course content", description: "Lessons are organized around useful skills and clear learning objectives." },
    { icon: ShieldCheck, title: "Reviewed learning", description: "Course submissions pass through an approval workflow before publication." },
    { icon: Users, title: "Learning for teams", description: "Organizations can coordinate members, cohorts, and course assignments." },
  ];

  return (
    <div className="space-y-16 pb-10">
      <section className="grid overflow-hidden rounded-[28px] border border-[#dfe9e6] bg-[#17443e] text-white shadow-[0_24px_80px_rgba(15,39,35,0.14)] md:min-h-[480px] md:grid-cols-[1.08fr_.92fr]">
        <div className="flex flex-col items-start justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f0c77a]">{t("home.eyebrow")}</p>
          <h1 className="max-w-xl font-serif text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">Turn skill-building into momentum.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80">{t("home.description")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/courses" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#f0c77a] px-5 py-2.5 text-sm font-semibold text-[#173a35] transition-colors hover:bg-[#f6d99e]">{t("nav.catalog")}<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/learning-paths" className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10">Explore learning paths</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/75">
            <span className="inline-flex items-center gap-2"><BookOpenCheck size={16} aria-hidden="true" />{t("home.reviewed")}</span>
            <span className="inline-flex items-center gap-2"><ShieldCheck size={16} aria-hidden="true" />{t("home.verified")}</span>
          </div>
        </div>
        <figure className="relative min-h-[280px] bg-[#d8c7a6] md:min-h-full">
          <img
            src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=960&q=75"
            srcSet="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=640&q=70 640w, https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=960&q=75 960w, https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1400&q=75 1400w"
            sizes="(min-width: 768px) 46vw, 100vw" width={1400} height={933} alt={t("home.imageAlt")}
            className="absolute inset-0 h-full w-full object-cover" loading="eager" fetchPriority="high" decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1d1b]/55 via-transparent to-transparent" />
          <figcaption className="absolute bottom-4 left-4 rounded-xl bg-white/95 p-4 text-sm text-ink shadow-card sm:bottom-6 sm:left-6">
            <span className="block font-semibold">{t("home.imageCaption")}</span>
            <span className="mt-0.5 block text-ink-soft">{t("home.imageSubcaption")}</span>
          </figcaption>
        </figure>
      </section>

      <section aria-labelledby="steps-heading">
        <div className="mb-5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">A clear way forward</p>
          <h2 id="steps-heading" className="mt-2 text-2xl font-semibold sm:text-3xl">Learn, practice, and make progress visible</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, description }, i) => <article key={title} className="card p-5 sm:p-6">
            <div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand"><Icon size={20} aria-hidden="true" /></span><span className="font-mono text-xs text-ink-faint">0{i + 1}</span></div>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
          </article>)}
        </div>
      </section>

      <section aria-labelledby="latest-courses-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t("home.coursesEyebrow")}</p><h2 id="latest-courses-heading" className="mt-2 text-2xl font-semibold">{t("home.coursesHeading")}</h2></div>
          <Link href="/courses" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-brand hover:underline">{t("home.browseCourses")}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {items.length === 0 ? <div className="rounded-2xl border border-dashed border-surface-line px-5 py-10 text-center"><p className="font-medium text-ink">{t("home.coursesEmpty")}</p><p className="mt-2 text-sm text-ink-soft">Explore learning paths or check back as new courses are published.</p><Link href="/learning-paths" className="btn-outline mt-4">Explore learning paths</Link></div> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((course: any) => <CourseCard key={course.id} course={course} />)}</div>}
      </section>

      <section className="grid gap-8 rounded-[28px] border border-surface-line bg-surface-muted/50 p-6 sm:p-8 lg:grid-cols-[0.7fr_1.3fr]" aria-labelledby="categories-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t("home.categoryEyebrow")}</p>
          <h2 id="categories-heading" className="mt-2 text-2xl font-semibold">{t("home.categoryHeading")}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">{t("home.categoryDescription")}</p>
          <Link href="/courses" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">Browse all courses<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {cats.length > 0 ? <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {cats.map((category, index) => <li key={category.id} className="border-t border-surface-line">
            <Link className="group flex min-h-14 items-center justify-between gap-4 py-3 text-sm font-medium transition-colors hover:text-brand" href={`/courses?category=${category.slug}`}>
              <span className="flex items-center gap-3"><span className="font-mono text-xs text-ink-faint">{String(index + 1).padStart(2, "0")}</span>{category.name}</span>
              <ArrowRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-brand" aria-hidden="true" />
            </Link>
          </li>)}
        </ul> : <p className="border-t border-surface-line py-4 text-sm text-ink-soft">{t("home.categoryEmpty")}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Platform features">
        {features.map(({ icon: Icon, title, description }) => <article key={title} className="rounded-2xl border border-surface-line bg-white p-5">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={19} aria-hidden="true" /></span>
          <h2 className="mt-4 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
        </article>)}
      </section>

      <section className="flex flex-col items-start justify-between gap-5 rounded-[28px] bg-[#17443e] p-6 text-white sm:p-8 md:flex-row md:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f0c77a]">Start with one step</p><h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Find a course that moves you forward.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Browse the catalog, compare learning paths, and continue when you are ready.</p></div>
        <div className="flex shrink-0 flex-wrap gap-3"><Link href="/register" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#f0c77a] px-5 py-2.5 text-sm font-semibold text-[#173a35] hover:bg-[#f6d99e]">Create an account<ArrowRight size={16} aria-hidden="true" /></Link><Link href="/courses" className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">Browse courses</Link></div>
      </section>
    </div>
  );
}
