import { listCategories } from "@/services/catalog";
import { requirePageAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PageHeader, Table, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { slugify } from "@/lib/utils";
export const metadata = { title: "Categories" };
async function add(f: FormData) {
  "use server";
  const { requirePermission } = await import("@/lib/auth"); const { createAdminSupabase } = await import("@/lib/supabase/server");
  await requirePermission("category.manage");
  const name = String(f.get("name") ?? "").trim().slice(0, 80); if (name.length < 2) return;
  const { error } = await createAdminSupabase().from("categories").insert({ name, name_sw: String(f.get("name_sw") ?? "").trim().slice(0, 80) || null, slug: slugify(name) });
  if (error) redirect(`/admin/categories?error=${encodeURIComponent(error.code === "23505" ? "A category with that name already exists." : "The category could not be added. Please try again.")}`);
  revalidatePath("/admin/categories");
}
export default async function Categories({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  await requirePageAccess("category.manage"); const cats = await listCategories();
  return (<><PageHeader title="Categories" subtitle="Keep course discovery clear with consistent category names." /><Flash error={sp.error} />
    <form action={add} className="card mb-6 grid max-w-2xl gap-3 p-4 sm:grid-cols-[1fr_1fr_auto]"><input name="name" className="input" placeholder="Category name" required aria-label="Category name" /><input name="name_sw" className="input" placeholder="Swahili name (optional)" aria-label="Swahili category name" /><button className="btn-primary">Add category</button></form>
    {cats.length === 0 ? <Empty title="No categories yet" hint="Add a category to help learners browse the course catalog." /> : <Table head={["Name", "Swahili name", "Slug"]}>{cats.map((c) => <tr key={c.id}><td className="table-td">{c.name}</td><td className="table-td">{(c as any).name_sw || "—"}</td><td className="table-td font-mono text-xs">{c.slug}</td></tr>)}</Table>}</>);
}
