import "server-only";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
/** First organization the user manages (extend with an org switcher via a cookie when users manage several). */
export async function currentOrgId() { const u = await requireUser(); const id = u.orgManagerOf[0]; if (!id) redirect("/forbidden"); return id; }
