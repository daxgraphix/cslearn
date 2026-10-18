import Link from "next/link";
import { listCategories } from "@/services/catalog";
import { createCourseAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { SlugInput } from "@/components/SlugInput";
import { requirePageAccess } from "@/lib/auth";
import { redirect } from "next/navigation";
export const metadata = { title: "New course" };
export default async function NewCourse({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requirePageAccess("course.create");
  if (!user.permissions.has("course.update.own") && !user.permissions.has("course.update.any")) redirect("/forbidden");
  const cats = await listCategories(); const sp = await searchParams;
  return (<><PageHeader title="Start a course" subtitle="Create a draft, shape the learning experience, and submit it when it is ready." /><Flash error={sp.error} />
    <div className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form action={createCourseAction} className="card space-y-6 p-5 sm:p-7">
        <div className="border-b border-surface-line pb-5"><span className="chip bg-brand-soft text-brand">New course draft</span><h2 className="mt-3 text-xl font-semibold">Start with the essentials</h2><p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink-soft">Choose a clear title and link. You can refine course details, add lessons, and preview everything in the studio.</p></div>
        <SlugInput />
        <div><label className="label" htmlFor="categoryId">Category <span className="font-normal text-ink-faint">Optional</span></label><select id="categoryId" name="categoryId" className="input"><option value="">Choose later</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{cats.length === 0 && <p className="mt-1 text-xs text-ink-faint">No categories are set up yet. You can continue and choose one later.</p>}</div>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-line pt-5"><button className="btn-primary">Create draft and open studio <span aria-hidden="true">→</span></button><Link href="/instructor/courses" className="btn-outline">Cancel</Link><p className="basis-full text-xs text-ink-faint">Your draft stays private until it passes review and is published.</p></div>
      </form>
      <aside className="card h-fit overflow-hidden" aria-labelledby="next-steps-title"><div className="bg-gradient-to-br from-brand-soft to-white p-5"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Your workflow</p><h2 id="next-steps-title" className="mt-1 text-lg font-semibold">What happens next</h2><p className="mt-1 text-sm text-ink-soft">You can save progress as you build.</p></div><ol className="space-y-0 px-5 pb-5">
        {[{ title: "Build the curriculum", detail: "Organize modules, lessons, and assessments." }, { title: "Complete course details", detail: "Add outcomes, description, level, and duration." }, { title: "Check and submit", detail: "Resolve readiness items, then send it for review." }].map((step, index) => <li key={step.title} className="relative flex gap-3 py-4 last:pb-1"><span className="relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{index + 1}</span>{index < 2 && <span className="absolute left-[13px] top-11 h-[calc(100%-1rem)] w-px bg-surface-line" />}<div><p className="text-sm font-semibold">{step.title}</p><p className="mt-1 text-xs leading-5 text-ink-soft">{step.detail}</p></div></li>)}
      </ol></aside>
    </div></>);
}
