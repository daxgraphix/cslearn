import { listCategories } from "@/services/catalog";
import { requirePageAccess } from "@/lib/auth";
import { createSupabase } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { PageHeader, Table } from "@/components/ui";
import { slugify } from "@/lib/utils";
export const metadata = { title: "Categories" };
async function add(f: FormData) {
  "use server";
  const { requirePermission } = await import("@/lib/auth"); const { createAdminSupabase } = await import("@/lib/supabase/server");
  await requirePermission("category.manage");
  const name = String(f.get("name") ?? "").trim().slice(0, 80); if (name.length < 2) return;
  await createAdminSupabase().from("categories").insert({ name, name_sw: String(f.get("name_sw") ?? "").trim().slice(0, 80) || null, slug: slugify(name) });
  revalidatePath("/admin/categories");
}
export default async function Categories() {
  await requirePageAccess("category.manage"); void createSupabase; const cats = await listCategories();
  return (<><PageHeader title="Categories" />
    <form action={add} className="card mb-6 flex max-w-xl flex-wrap gap-2 p-4"><input name="name" className="input flex-1" placeholder="Category name" required aria-label="Name" /><button className="btn-primary">Add</button></form>
    <Table head={["Name", "Slug"]}>{cats.map((c) => <tr key={c.id}><td className="table-td">{c.name}</td><td className="table-td font-mono text-xs">{c.slug}</td></tr>)}</Table></>);
}
