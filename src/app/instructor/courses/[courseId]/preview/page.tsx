import Link from "next/link";
import { getBuilderData } from "@/services/authoring";
import { notFound } from "next/navigation";
export const metadata = { title: "Preview" };
export default async function Preview({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params; const d = await getBuilderData(courseId); if (!d) notFound();
  const modules = [...d.modules].sort((a: any, b: any) => a.position - b.position);
  return (<div className="mx-auto max-w-3xl space-y-4">
    <div className="flex items-center justify-between"><p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Preview mode: this is how learners will see the outline. Progress is not recorded.</p><Link className="btn-outline" href={`/instructor/courses/${courseId}/builder`}>Back to studio</Link></div>
    <h1 className="text-3xl font-semibold">{d.version.title}</h1><p className="text-ink-soft">{d.version.subtitle}</p>
    {modules.map((m: any) => (<section key={m.id} className="card p-5"><h2 className="font-semibold">{m.title}</h2>
      <ul className="mt-3 space-y-2 text-sm">{[...m.lessons].sort((a: any, b: any) => a.position - b.position).map((l: any) => <li key={l.id} className="flex justify-between rounded-lg bg-surface-muted px-3 py-2"><span>{l.title}</span><span className="text-ink-faint">{l.type}{l.is_required ? "" : " · optional"}</span></li>)}</ul></section>))}
  </div>);
}
