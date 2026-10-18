"use client";
import { useState } from "react";

function toRoleKey(value: string) {
  const key = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const validStart = /^[a-z]/.test(key) ? key : key ? `role_${key}` : "";
  return validStart && validStart.length < 3 ? `${validStart}_role`.slice(0, 48) : validStart.slice(0, 48);
}

export function RoleIdentityFields() {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const updateName = (value: string) => {
    setName(value);
    if (!keyEdited) setKey(toRoleKey(value));
  };
  return <div className="space-y-4">
    <input type="hidden" name="key" value={key} />
    <div>
      <label className="label" htmlFor="role-name">Role name</label>
      <input id="role-name" name="name" className="input" minLength={2} maxLength={100} required placeholder="Content coordinator" value={name} onChange={(event) => updateName(event.target.value)} />
      <p className="mt-1 text-xs text-ink-faint">Use a name people will recognize when assigning access.</p>
    </div>
    <div>
      <label className="label" htmlFor="role-description">What is this role for?</label>
      <textarea id="role-description" name="description" className="input min-h-20 resize-y" maxLength={300} placeholder="Describe the work this person will do" />
    </div>
    <details className="rounded-xl border border-surface-line bg-surface-muted/40 p-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">Advanced: system ID</summary>
      <div className="mt-3">
        <label className="label" htmlFor="role-key">System ID</label>
        <input id="role-key" className="input font-mono" minLength={3} maxLength={48} pattern="[a-z][a-z0-9_]*" placeholder="content_coordinator" value={key} onChange={(event) => { setKeyEdited(true); setKey(event.target.value); }} aria-describedby="role-key-help" />
        <p id="role-key-help" className="mt-1 text-xs text-ink-faint">Generated from the role name. It is fixed after the role is created.</p>
        {keyEdited && <button type="button" className="mt-1 text-xs font-medium text-brand hover:underline" onClick={() => { setKey(toRoleKey(name)); setKeyEdited(false); }}>Use generated ID</button>}
      </div>
    </details>
  </div>;
}
