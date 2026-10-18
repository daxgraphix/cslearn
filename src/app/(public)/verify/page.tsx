import { redirect } from "next/navigation";
export const metadata = { title: "Verify a certificate" };
export default function VerifyIndex() {
  async function go(f: FormData) { "use server"; const s = String(f.get("serial") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, ""); if (s) redirect(`/verify/${s}`); }
  return (<div className="mx-auto max-w-md"><h1 className="text-2xl font-semibold">Verify a certificate</h1><form action={go} className="mt-5 flex gap-2"><input name="serial" className="input" placeholder="CRT-2026-XXXXXXXXXX" aria-label="Certificate serial" required /><button className="btn-primary">Verify</button></form></div>);
}
