import { createSupabase } from "@/lib/supabase/server";
import { requirePageAccess } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
export const metadata = { title: "Settings" };
export default async function SettingsPage() {
  await requirePageAccess("settings.read");
  const { data } = await (await createSupabase()).from("settings").select("key, value");
  return (<><PageHeader title="Platform settings" subtitle="Review active platform configuration. Owner-level changes go through a reviewed migration or the owner console." />
    {(data ?? []).length === 0 ? <Empty title="No settings configured" hint="Platform configuration will appear here when settings are added." /> : <div className="grid gap-4 xl:grid-cols-2">{(data ?? []).map((s) => <section key={s.key} className="card min-w-0 p-5"><h2 className="break-words font-semibold">{s.key}</h2><pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-surface-muted p-3 text-xs">{JSON.stringify(s.value, null, 2)}</pre></section>)}</div>}</>);
}
