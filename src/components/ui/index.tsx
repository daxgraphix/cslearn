import Link from "next/link";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS: Record<string, string> = {
  draft: "bg-amber-50 text-draft", in_review: "bg-blue-50 text-brand", changes_requested: "bg-orange-50 text-orange-700",
  approved: "bg-emerald-50 text-ok", published: "bg-emerald-50 text-ok", archived: "bg-surface-muted text-ink-soft",
  active: "bg-emerald-50 text-ok", suspended: "bg-red-50 text-danger", completed: "bg-emerald-50 text-ok",
  valid: "bg-emerald-50 text-ok", revoked: "bg-red-50 text-danger", pending: "bg-amber-50 text-draft",
  open: "bg-blue-50 text-brand", escalated: "bg-red-50 text-danger", dead: "bg-red-50 text-danger", queued: "bg-surface-muted text-ink-soft",
};
export function StatusDot({ status, label }: { status: string; label?: string }) {
  const color = status === "draft" ? "bg-draft" : status === "published" || status === "approved" ? "bg-ok" : status === "in_review" ? "bg-brand" : "bg-ink-faint";
  return <span className="inline-flex items-center gap-2 text-sm font-medium"><span className={cn("h-2.5 w-2.5 rounded-full", color)} />{label ?? status.replace(/_/g, " ")}</span>;
}
export function Badge({ status, children }: { status: string; children?: React.ReactNode }) {
  return <span className={cn("chip", STATUS[status] ?? "bg-surface-muted text-ink-soft")}>{children ?? status.replace(/_/g, " ")}</span>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-surface-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0"><h1 className="break-words text-2xl font-semibold leading-tight tracking-tight sm:text-[1.75rem]">{title}</h1>{subtitle && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-ink-soft">{subtitle}</p>}</div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div>}
    </div>
  );
}
export function Empty({ title, hint, href, cta }: { title: string; hint?: string; href?: string; cta?: string }) {
  return (
    <div className="card grid min-h-52 place-items-center border border-surface-line px-5 py-8 text-center sm:px-8">
      <div className="max-w-md">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand"><Inbox size={20} aria-hidden="true" /></span>
        <p className="mt-3 font-semibold text-ink">{title}</p>
        {hint && <p className="mt-1.5 text-sm leading-6 text-ink-soft">{hint}</p>}
        {href && <Link href={href} className="btn-primary mt-4">{cta}</Link>}
      </div>
    </div>
  );
}
export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="card min-w-0 overflow-hidden border border-surface-line p-4 sm:p-5"><div className="-mx-4 -mt-4 mb-4 h-1 bg-brand/70 sm:-mx-5 sm:-mt-5" /><p className="break-words text-xs font-medium leading-5 text-ink-soft sm:text-sm">{label}</p><p className="mt-2 break-words text-2xl font-semibold tabular-nums text-ink sm:text-3xl">{value}</p></div>;
}
export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-x-auto border border-surface-line focus-visible:outline-offset-2" role="region" aria-label="Scrollable data table" tabIndex={0}>
      <table className="w-full min-w-[640px]"><thead className="bg-surface-muted/70"><tr>{head.map((h) => <th key={h} scope="col" className="table-th">{h}</th>)}</tr></thead><tbody>{children}</tbody></table>
    </div>
  );
}
export function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string[]; hint?: string; children: React.ReactNode }) {
  return (
    <div><label htmlFor={name} className="label">{label}</label>{children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
      {error?.map((e) => <p key={e} role="alert" className="mt-1 text-xs text-danger">{e}</p>)}
    </div>
  );
}
