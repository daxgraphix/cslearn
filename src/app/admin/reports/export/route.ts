import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createSupabase, createAdminSupabase } from "@/lib/supabase/server";
import { toCsv } from "@/services/reporting";
export async function GET() {
  const user = await requirePermission("report.read");
  const { data } = await (await createSupabase()).from("enrollments").select("status, source, enrolled_at, completed_at, courses(slug)").limit(20000);
  const rows = ((data ?? []) as any[]).map((e) => ({ course: e.courses?.slug, status: e.status, source: e.source, enrolled_at: e.enrolled_at, completed_at: e.completed_at }));
  await createAdminSupabase().rpc("write_audit", { p_actor: user.id, p_action: "report.exported", p_type: "report", p_id: "enrollments", p_meta: { rows: rows.length } }).then(() => undefined, () => undefined);
  return new NextResponse(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="enrollments.csv"' } });
}
