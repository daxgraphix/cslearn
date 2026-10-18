import { listCategories } from "@/services/catalog";
import { createCourseAction } from "@/app/actions";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { SlugInput } from "@/components/SlugInput";
export const metadata = { title: "New course" };
export default async function NewCourse({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const cats = await listCategories(); const sp = await searchParams;
  return (<><PageHeader title="New course" subtitle="You can change everything except the web address later." /><Flash error={sp.error} />
    <form action={createCourseAction} className="card max-w-xl space-y-4 p-6"><SlugInput />
      <div><label className="label" htmlFor="categoryId">Category</label><select id="categoryId" name="categoryId" className="input"><option value="">Choose later</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <button className="btn-primary">Create draft</button></form></>);
}
