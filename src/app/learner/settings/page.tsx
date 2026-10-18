import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { updateProfileAction, requestDataAction } from "@/app/actions";
export const metadata = { title: "Settings" };
export default async function Settings({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await requireUser(); const sp = await searchParams;
  const { data: p } = await (await createSupabase()).from("profiles").select("full_name, bio").eq("id", u.id).single();
  return (<><PageHeader title="Settings" /><Flash error={sp.error} />
    <form action={updateProfileAction} className="card max-w-xl space-y-4 p-6"><h2 className="font-semibold">Profile</h2>
      <div><label className="label" htmlFor="fullName">Full name</label><input id="fullName" name="fullName" defaultValue={p?.full_name} className="input" required /></div>
      <div><label className="label" htmlFor="bio">Bio</label><textarea id="bio" name="bio" defaultValue={p?.bio ?? ""} rows={3} className="input" /></div>
      <button className="btn-primary">Save changes</button></form>
    <form action={requestDataAction} className="card mt-6 max-w-xl space-y-3 p-6"><h2 className="font-semibold">Your data</h2><p className="text-sm text-ink-soft">Request a copy of your data, or ask us to delete your account. Records we must keep for legal reasons are retained.</p>
      <div className="flex gap-2"><button name="kind" value="export" className="btn-outline">Request data export</button><button name="kind" value="deletion" className="btn-danger">Request deletion</button></div></form></>);
}
