"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = { id: string; name: string; autoComplete: string; minLength?: number; maxLength?: number; required?: boolean; placeholder?: string; describedBy?: string };

export function PasswordField({ id, name, autoComplete, minLength, maxLength, required = true, placeholder, describedBy }: Props) {
  const [visible, setVisible] = useState(false);
  return <div className="relative">
    <input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete} minLength={minLength} maxLength={maxLength} required={required} placeholder={placeholder} aria-describedby={describedBy} className="input pr-12" />
    <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-r-lg text-ink-faint hover:bg-surface-muted hover:text-ink">
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>;
}
