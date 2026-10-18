import { orgOverview } from "@/services/organization";
import { currentOrgId } from "@/lib/org-context";
import { PageHeader, Stat } from "@/components/ui";
export const metadata = { title: "Organization" };
export default async function Dash() {
  const d = await orgOverview(await currentOrgId());
  const total = d.report.reduce((a, r) => a + Number(r.learners), 0), done = d.report.reduce((a, r) => a + Number(r.completed), 0);
  return (<><PageHeader title={d.org?.name ?? "Organization"} /><div className="grid gap-4 sm:grid-cols-4"><Stat label="Members" value={d.members.filter((m: any) => m.status === "active").length} /><Stat label="Cohorts" value={d.cohorts.length} /><Stat label="Assignments" value={total} /><Stat label="Completed" value={done} /></div></>);
}
