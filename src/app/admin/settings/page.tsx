import { createSupabase } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
export const metadata = { title: "Settings" };
export default async function SettingsPage() {
  await requirePageAccess("settings.read");
  const { data } = await (await createSupabase()).from("settings").select("key, value");
  return (<><PageHeader title="Platform settings" subtitle="Read-only here. Owner-level changes go through a reviewed migration or the owner console." />
    <div className="space-y-4">{(data ?? []).map((s) => <section key={s.key} className="card p-5"><h2 className="font-semibold">{s.key}</h2><pre className="mt-2 overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs">{JSON.stringify(s.value, null, 2)}</pre></section>)}</div></>);
}
