"use client";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";

export function SubmitButton({ children, pendingLabel, className = "", name, value }: { children: React.ReactNode; pendingLabel: string; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} aria-busy={pending} className={`${className} disabled:cursor-wait disabled:opacity-70`}>
      {pending && <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />}
      <span>{pending ? pendingLabel : children}</span>
    </button>
  );
}
