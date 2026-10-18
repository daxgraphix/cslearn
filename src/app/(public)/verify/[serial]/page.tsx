import { verify } from "@/services/certification";
import { fmtDate } from "@/lib/utils";
import { Badge } from "@/components/ui";
export const metadata = { title: "Certificate verification", robots: { index: false } };
export default async function Verify({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params; const c = await verify(decodeURIComponent(serial));
  return (
    <div className="mx-auto max-w-lg">
      {!c ? <div className="card p-6"><h1 className="text-xl font-semibold">Certificate not found</h1><p className="mt-2 text-ink-soft">Check the serial number and try again.</p></div> : (
        <div className="card space-y-3 p-6">
          <Badge status={c.status}>{c.status === "valid" ? "Valid certificate" : "Revoked"}</Badge>
          <h1 className="text-2xl font-semibold">{c.learner_name}</h1>
          <p>completed <strong>{c.course_title}</strong></p>
          <p className="text-sm text-ink-soft">Issued {fmtDate(c.issued_at)} · Serial {c.serial}</p>
          {c.status === "revoked" && <p className="text-sm text-danger">This certificate has been revoked and is no longer valid.</p>}
        </div>)}
    </div>
  );
}
