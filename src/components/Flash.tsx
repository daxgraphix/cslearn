import { CircleAlert, CircleCheck } from "lucide-react";

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <div role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} aria-atomic="true" className={`mb-4 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm leading-5 ${error ? "border-red-200 bg-red-50 text-danger" : "border-emerald-200 bg-emerald-50 text-ok"}`}>
      {error ? <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" /> : <CircleCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />}
      <span>{error ?? notice}</span>
    </div>
  );
}
