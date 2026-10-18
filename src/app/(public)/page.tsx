import Link from "next/link";
import { listCatalog, listCategories } from "@/services/catalog";
import { CourseCard } from "@/components/CourseCard";
import { getT } from "@/i18n";
import { ArrowRight, Award, BookOpenCheck, BriefcaseBusiness, Compass, Gauge, ShieldCheck, Sparkles, Target, Users } from "lucide-react";

export default async function Home() {
  const t = await getT();
  const [catalogResult, categoriesResult] = await Promise.allSettled([
    listCatalog({ limit: 6, includeCount: false }),
    listCategories(),
  ]);
  const items = catalogResult.status === "fulfilled" ? catalogResult.value.items : [];
  const cats = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const trustStats = [
    { label: "Learners supported", value: "12k+" },
    { label: "Average completion", value: "87%" },
    { label: "Credentials issued", value: "3.4k" },
  ];
  const featureCards = [
    { icon: Compass, title: "Guided pathways", description: "Move from short wins to senior-level skills with clear milestones and structured progression." },
    { icon: BriefcaseBusiness, title: "Work-ready learning", description: "Courses map to daily workplace tasks so learners can apply knowledge quickly and confidently." },
    { icon: ShieldCheck, title: "Trusted assessment", description: "Fair review processes and verifiable outcomes keep the learning experience credible and transparent." },
    { icon: Users, title: "Team growth", description: "Organizations can onboard, manage cohorts, and track progress without losing the human touch." },
    { icon: Target, title: "Clear outcomes", description: "Every course is tied to a learning objective, assessment standard, and final proof of capability." },
    { icon: Gauge, title: "Operational clarity", description: "A reliable admin workflow keeps content quality, queue health, and learner access running smoothly." },
  ];
  const audienceCards = [
    { title: "For learners", description: "Learn at your own pace with structured lessons, guided progress, and real proof of achievement." },
    { title: "For teams", description: "Upskill staff quickly with consistent learning pathways and measurable outcomes across departments." },
    { title: "For institutions", description: "Deliver high-quality digital learning with admin controls, review workflows, and operational visibility." },
  ];

  return (
    <div className="space-y-16 pb-10">
      <section className="grid overflow-hidden rounded-[28px] border border-[#dfe9e6] bg-[#17443e] text-white shadow-[0_24px_80px_rgba(15,39,35,0.14)] md:min-h-[500px] md:grid-cols-[1.08fr_.92fr]">
        <div className="flex flex-col items-start justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.16em] text-[#f0c77a]">{t("home.eyebrow")}</p>
          <h1 className="max-w-xl font-serif text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">Turn skill-building into momentum.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80">{t("home.description")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/courses" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#f0c77a] px-5 py-2.5 text-sm font-semibold text-[#173a35] transition-colors hover:bg-[#f6d99e]">{t("nav.catalog")}<ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10">{t("nav.register")}</Link>
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
            sizes="(min-width: 768px) 46vw, 100vw"
            width={1400}
            height={933}
            alt={t("home.imageAlt")}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1d1b]/55 via-transparent to-transparent" />
          <figcaption className="absolute bottom-4 left-4 rounded-xl bg-white/95 p-4 text-sm text-ink shadow-card sm:bottom-6 sm:left-6">
            <span className="block font-semibold">{t("home.imageCaption")}</span>
            <span className="mt-0.5 block text-ink-soft">{t("home.imageSubcaption")}</span>
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {trustStats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="text-sm text-ink-soft">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[24px] border border-surface-line bg-white p-5">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-brand">Trusted by teams, institutions, and public programs</p>
        <div className="mt-4 grid gap-3 text-center text-sm font-medium text-ink-soft sm:grid-cols-3 lg:grid-cols-6">
          {['Learning teams', 'NGOs', 'Schools', 'Enterprises', 'Agencies', 'Growth programs'].map((item) => (
            <div key={item} className="rounded-xl border border-surface-line bg-surface-muted/40 px-3 py-3">{item}</div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {audienceCards.map((card) => (
          <div key={card.title} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Audience</p>
            <h3 className="mt-3 text-xl font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{card.description}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-8 md:grid-cols-[0.75fr_1.25fr]" aria-labelledby="categories-heading">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t("home.categoryEyebrow")}</p>
          <h2 id="categories-heading" className="mt-2 text-2xl font-semibold">{t("home.categoryHeading")}</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">{t("home.categoryDescription")}</p>
        </div>
        {cats.length > 0 ? (
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {cats.map((c, index) => (
              <li key={c.id} className="border-t border-surface-line">
                <Link className="group flex min-h-14 items-center justify-between gap-4 py-3 text-sm font-medium transition-colors hover:text-brand" href={`/courses?category=${c.slug}`}>
                  <span className="flex items-center gap-3"><span className="font-mono text-xs text-ink-faint">{String(index + 1).padStart(2, "0")}</span>{c.name}</span>
                  <ArrowRight size={16} className="text-ink-faint transition-transform group-hover:translate-x-1 group-hover:text-brand" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="border-t border-surface-line py-4 text-sm text-ink-soft">{t("home.categoryEmpty")}</p>}
      </section>

      <section className="rounded-[28px] border border-surface-line bg-surface-muted/50 p-6 sm:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Why teams choose CSGO</p>
            <h2 className="mt-2 text-2xl font-semibold">A learning platform built for momentum</h2>
          </div>
          <Sparkles className="hidden text-brand sm:block" size={26} aria-hidden="true" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureCards.map(({ icon: Icon, title, description }) => (
            <article key={title} className="rounded-2xl border border-surface-line bg-white p-5 shadow-sm">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={20} aria-hidden="true" /></div>
              <h3 className="text-lg font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="latest">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{t("home.coursesEyebrow")}</p><h2 id="latest" className="mt-2 text-2xl font-semibold">{t("home.coursesHeading")}</h2></div>
          <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline">{t("home.browseCourses")}<ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        {items.length === 0 ? <p className="border-y border-surface-line py-8 text-sm text-ink-soft">{t("home.coursesEmpty")}</p> :
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((c: any) => <CourseCard key={c.id} course={c} />)}</div>}
      </section>

      <section className="grid gap-6 rounded-[28px] border border-surface-line bg-white p-6 lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Built for high-performing learners</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">From first lesson to recognisable proof</h2>
          <div className="mt-6 space-y-5">
            <div className="flex items-start gap-3"><BookOpenCheck className="mt-0.5 shrink-0 text-brand" size={20} aria-hidden="true" /><div><h3 className="font-semibold">{t("home.learnHeading")}</h3><p className="mt-1 text-sm leading-6 text-ink-soft">{t("home.learnDescription")}</p></div></div>
            <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-brand" size={20} aria-hidden="true" /><div><h3 className="font-semibold">{t("home.assessHeading")}</h3><p className="mt-1 text-sm leading-6 text-ink-soft">{t("home.assessDescription")}</p></div></div>
            <div className="flex items-start gap-3"><Award className="mt-0.5 shrink-0 text-brand" size={20} aria-hidden="true" /><div><h3 className="font-semibold">{t("home.proofHeading")}</h3><p className="mt-1 text-sm leading-6 text-ink-soft">{t("home.proofDescription")}</p></div></div>
          </div>
        </div>
        <div className="rounded-2xl bg-[#17443e] p-5 text-white shadow-card">
          <p className="text-xs uppercase tracking-[0.14em] text-[#f0c77a]">Performance snapshot</p>
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-3xl font-semibold">4.9/5</p>
              <p className="mt-1 text-sm text-white/75">Average learner satisfaction</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-white/8 p-3">
                <p className="text-sm text-white/70">Assessment pass rate</p>
                <p className="mt-2 text-2xl font-semibold">91%</p>
              </div>
              <div className="rounded-xl bg-white/8 p-3">
                <p className="text-sm text-white/70">On-time delivery</p>
                <p className="mt-2 text-2xl font-semibold">99.2%</p>
              </div>
            </div>
            <Link href="/register" className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#f0c77a] px-5 py-2.5 text-sm font-semibold text-[#173a35] hover:bg-[#f6d99e]">Start learning <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
