import Link from "next/link";
import { reviewQueue } from "@/services/governance";
import { PageHeader, Stat } from "@/components/ui";
export const metadata = { title: "Reviewer dashboard" };
export default async function Dash() {
  const q = await reviewQueue();
  return (<><PageHeader title="Reviewer dashboard" /><div className="grid gap-4 sm:grid-cols-2"><Stat label="Open reviews" value={q.length} /><Stat label="Oldest waiting (days)" value={q[0] ? Math.floor((Date.now() - new Date(q[0].created_at).getTime()) / 86400000) : 0} /></div><Link className="btn-primary mt-6" href="/reviewer/queue">Open the queue</Link></>);
}
