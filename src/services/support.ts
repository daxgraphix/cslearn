import "server-only";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { requireUser, requirePermission } from "@/lib/auth";
import { ticketSchema } from "@/lib/validation";
import type { z } from "zod";

export async function openTicket(input: z.input<typeof ticketSchema>) {
  const user = await requireUser();
  const v = ticketSchema.parse(input);
  const supabase = await createSupabase();
  const { data: t, error } = await supabase.from("support_tickets").insert({ requester_id: user.id, subject: v.subject, category: v.category }).select("id").single();
  if (error) throw error;
  const { error: me } = await supabase.from("support_messages").insert({ ticket_id: t.id, author_id: user.id, body: v.body });
  if (me) throw me;
  return t.id as string;
}
export async function agentQueue() {
  await requirePermission("support.read");
  const supabase = await createSupabase();
  const { data } = await supabase.from("support_tickets").select("id, subject, category, status, created_at").neq("status", "closed").order("created_at");
  return data ?? [];
}
export async function reply(ticketId: string, body: string, internal = false) {
  const user = await requirePermission("support.reply");
  const { error } = await createAdminSupabase().from("support_messages").insert({ ticket_id: ticketId, author_id: user.id, body: body.slice(0, 5000), internal });
  if (error) throw error;
}
/** Support may escalate, but cannot change grades, issue certificates or grant course access (no such permissions). */
export async function escalate(ticketId: string, category: "security" | "academic" | "privacy") {
  await requirePermission("support.reply");
  await createAdminSupabase().from("support_tickets").update({ status: "escalated", category }).eq("id", ticketId);
}
