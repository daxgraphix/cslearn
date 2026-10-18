import { auditLog } from "@/services/admin";
import { PageHeader, Table, Empty } from "@/components/ui";
export const metadata = { title: "Security and audit" };
export default async function Security({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Number((await searchParams).page ?? 1) || 1; const rows = await auditLog(page);
  return (<><PageHeader title="Security and audit" subtitle="Append-only record of sensitive actions" />
    {rows.length === 0 ? <Empty title="No audit events yet" hint="Sensitive platform actions will be recorded here." /> : <Table head={["When", "Action", "Entity", "Actor", "Details"]}>{rows.map((r) => <tr key={r.id}><td className="table-td whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-GB")}</td><td className="table-td font-medium">{r.action}</td><td className="table-td">{r.entity_type}<p className="font-mono text-xs text-ink-faint">{r.entity_id?.slice(0, 8)}</p></td><td className="table-td font-mono text-xs">{r.actor_id?.slice(0, 8) ?? "system"}</td><td className="table-td max-w-xs truncate font-mono text-xs text-ink-soft">{JSON.stringify(r.metadata)}</td></tr>)}</Table>}
    <div className="mt-4 flex gap-2">{page > 1 && <a className="btn-outline" href={`?page=${page - 1}`}>Newer</a>}{rows.length === 50 && <a className="btn-outline" href={`?page=${page + 1}`}>Older</a>}</div></>);
}
