import Link from "next/link";
import { myNotifications } from "@/services/notifications";
import { PageHeader, Empty } from "@/components/ui";
import { markNotificationReadAction } from "@/app/actions";
import { fmtDate } from "@/lib/utils";
export const metadata = { title: "Notifications" };
export default async function Notifications() {
  const items = await myNotifications();
  return (<><PageHeader title="Notifications" />{items.length === 0 ? <Empty title="You are all caught up" /> :
    <ul className="card divide-y divide-surface-line">{items.map((n) => (
      <li key={n.id} className="flex items-start justify-between gap-4 p-4"><div><p className={n.read_at ? "text-ink-soft" : "font-medium"}>{n.href ? <Link className="hover:underline" href={n.href}>{n.title}</Link> : n.title}</p>{n.body && <p className="text-sm text-ink-soft">{n.body}</p>}<p className="mt-1 text-xs text-ink-faint">{fmtDate(n.created_at)}</p></div>
        {!n.read_at && <form action={markNotificationReadAction}><input type="hidden" name="id" value={n.id} /><button className="btn-ghost text-sm">Mark read</button></form>}</li>))}</ul>}</>);
}
