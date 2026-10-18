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
  return (<><PageHeader title="Start a course" subtitle="Set up a draft, build its curriculum, then submit it for review." /><Flash error={sp.error} />
    <div className="grid max-w-4xl gap-5 lg:grid-cols-[1fr_280px]">
      <form action={createCourseAction} className="card space-y-5 p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold">Course basics</h2><p className="mt-1 text-sm text-ink-soft">Start with a clear title and a short web address. You can add the description and learning content in the studio.</p></div>
        <SlugInput />
        <div><label className="label" htmlFor="categoryId">Category <span className="font-normal text-ink-faint">(optional)</span></label><select id="categoryId" name="categoryId" className="input"><option value="">Choose later</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{cats.length === 0 && <p className="mt-1 text-xs text-ink-faint">No categories are set up yet. You can continue and choose one later.</p>}</div>
        <div className="flex flex-wrap items-center gap-3 border-t border-surface-line pt-4"><button className="btn-primary">Create draft and open studio</button><Link href="/instructor/courses" className="btn-outline">Cancel</Link></div>
      </form>
      <aside className="card h-fit p-5"><h2 className="font-semibold">What happens next</h2><ol className="mt-3 space-y-3 text-sm text-ink-soft"><li><span className="font-medium text-ink">1. Build</span><br />Add modules, lessons, and assessments.</li><li><span className="font-medium text-ink">2. Check</span><br />Fix the readiness checklist in the studio.</li><li><span className="font-medium text-ink">3. Submit</span><br />A reviewer checks the course before it can be published.</li></ol></aside>
    </div></>);
}
