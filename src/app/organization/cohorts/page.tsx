import { orgOverview } from "@/services/organization";
import { currentOrgId } from "@/lib/org-context";
import { createSupabase } from "@/lib/supabase/server";
import { PageHeader, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { createCohortAction, assignCourseAction } from "@/app/actions";
export const metadata = { title: "Cohorts" };
export default async function Cohorts({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams; const orgId = await currentOrgId(); const d = await orgOverview(orgId);
  const { data: courses } = await (await createSupabase()).from("courses").select("id, slug, course_versions!fk_courses_published_version(title)").not("published_version_id", "is", null).is("archived_at", null);
  return (<><PageHeader title="Cohorts" /><Flash error={sp.error} />
    <form action={createCohortAction} className="card mb-6 flex max-w-xl gap-2 p-4"><input type="hidden" name="orgId" value={orgId} /><input name="name" className="input" placeholder="Cohort name" required aria-label="Cohort name" /><button className="btn-primary">Create cohort</button></form>
    {d.cohorts.length === 0 ? <Empty title="No cohorts yet" /> : <div className="grid gap-4 md:grid-cols-2">{(d.cohorts as any[]).map((c) => (
      <section key={c.id} className="card p-5"><h2 className="font-semibold">{c.name}</h2><p className="text-sm text-ink-soft">{c.cohort_memberships?.[0]?.count ?? 0} learners</p>
        <ul className="mt-2 text-sm">{c.cohort_course_assignments.map((a: any) => <li key={a.course_id}>{a.courses?.slug}</li>)}</ul>
        <form action={assignCourseAction} className="mt-3 flex gap-2"><input type="hidden" name="orgId" value={orgId} /><input type="hidden" name="cohortId" value={c.id} />
          <select name="courseId" className="input" aria-label="Course">{(courses as any[] ?? []).map((x) => <option key={x.id} value={x.id}>{x.course_versions?.title}</option>)}</select><button className="btn-outline">Assign</button></form></section>))}</div>}</>);
}
