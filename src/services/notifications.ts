import "server-only";
import { createSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function myNotifications() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { data } = await supabase.from("notifications").select("id, kind, title, body, href, read_at, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
  return data ?? [];
}
export async function markRead(id: string) {
  await requireUser();
  const supabase = await createSupabase();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}
export async function unreadCount() {
  const user = await requireUser();
  const supabase = await createSupabase();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return count ?? 0;
}
