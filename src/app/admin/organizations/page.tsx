import { createSupabase } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Table, Badge } from "@/components/ui";
import { slugify } from "@/lib/utils";
import { revalidatePath } from "next/cache";
export const metadata = { title: "Organizations" };
async function create(f: FormData) {
  "use server";
  const { requirePermission: rp } = await import("@/lib/auth"); const { createAdminSupabase } = await import("@/lib/supabase/server");
  await rp("org.manage");
  const name = String(f.get("name") ?? "").trim().slice(0, 120); if (name.length < 2) return;
  const admin = createAdminSupabase();
  const { data: org } = await admin.from("organizations").insert({ name, slug: slugify(name), contact_email: String(f.get("email") ?? "") || null }).select("id").single();
  const email = String(f.get("managerEmail") ?? "").trim();
  if (org && email) { const { data: uid } = await admin.rpc("user_id_by_email", { p_email: email }); if (uid) await admin.from("organization_memberships").insert({ organization_id: org.id, user_id: uid as string, member_type: "manager" }); }
  await admin.rpc("write_audit", { p_actor: null, p_action: "org.created", p_type: "organization", p_id: org?.id ?? "", p_meta: { name } }).then(() => undefined, () => undefined);
  revalidatePath("/admin/organizations");
}
export default async function Orgs() {
  await requirePermission("org.read.any");
  const { data } = await (await createSupabase()).from("organizations").select("id, name, slug, status, organization_memberships(count)").order("created_at", { ascending: false });
  return (<><PageHeader title="Organizations" />
    <form action={create} className="card mb-6 grid max-w-3xl gap-3 p-5 sm:grid-cols-2"><input name="name" className="input" placeholder="Institution name" required aria-label="Name" /><input name="email" type="email" className="input" placeholder="Contact email" aria-label="Contact email" /><input name="managerEmail" type="email" className="input sm:col-span-2" placeholder="Manager's account email (must be registered)" aria-label="Manager email" /><button className="btn-primary sm:col-span-2">Create organization</button></form>
    <Table head={["Name", "Slug", "Members", "Status"]}>{(data as any[] ?? []).map((o) => <tr key={o.id}><td className="table-td font-medium">{o.name}</td><td className="table-td">{o.slug}</td><td className="table-td">{o.organization_memberships?.[0]?.count ?? 0}</td><td className="table-td"><Badge status={o.status} /></td></tr>)}</Table></>);
}
