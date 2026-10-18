import { notFound, redirect } from "next/navigation";
import { getPlayer } from "@/services/learning";
import { Player } from "@/components/Player";
import { Flash } from "@/components/Flash";

export const metadata = { title: "Course player" };
export default async function Learn({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<{ lesson?: string; error?: string }> }) {
  const { courseId } = await params; const sp = await searchParams;
  const data = await getPlayer(courseId);
  if (!data) redirect("/courses"); // not enrolled or access expired
  if (!data.version) notFound();
  const modules = [...(data.version as any).modules].sort((a: any, b: any) => a.position - b.position)
    .map((m: any) => ({ ...m, lessons: [...m.lessons].sort((a: any, b: any) => a.position - b.position) }));
  const flat = modules.flatMap((m: any) => m.lessons);
  const done = new Set(data.progress.filter((p) => p.status === "completed").map((p) => p.lesson_id));
  // Resume: requested lesson, else first incomplete, else first
  const currentId = sp.lesson ?? flat.find((l: any) => !done.has(l.id))?.id ?? flat[0]?.id;
  return (<><Flash error={sp.error} />
    <Player courseId={courseId} title={(data.version as any).title} enrollmentId={data.enrollment.id} modules={modules} completed={[...done]} currentId={currentId} /></>);
}
