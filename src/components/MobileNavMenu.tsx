"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function MobileNavMenu({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.key === "Tab" && panelRef.current) {
        const controls = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (controls.length === 0) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLElement>("a[href], button:not([disabled])")?.focus();
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" aria-expanded={open} aria-controls="mobile-workspace-menu" aria-label={open ? "Close navigation menu" : `Open ${title} navigation`} onClick={() => setOpen((value) => !value)} className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}<span>{open ? "Close" : "Menu"}</span>
    </button>
    {open && <>
      <button type="button" aria-label="Close navigation menu" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} className="fixed inset-0 z-40 bg-ink/25 md:hidden" />
      <div ref={panelRef} id="mobile-workspace-menu" aria-label={`${title} navigation`} className="fixed right-3 top-14 z-50 max-h-[calc(100dvh-4.5rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-surface-line bg-white p-4 shadow-[0_24px_70px_rgba(15,39,35,0.22)] md:hidden" onClick={(event) => { if ((event.target as HTMLElement).closest("a, button")) setOpen(false); }}>
        <div className="mb-3 flex items-center justify-between border-b border-surface-line pb-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Workspace</p><p className="mt-1 text-sm font-semibold text-ink">{title}</p></div>
          <button type="button" onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Close navigation" className="grid h-9 w-9 place-items-center rounded-lg text-ink-soft hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><X size={18} aria-hidden="true" /></button>
        </div>
        {children}
      </div>
    </>}
  </>;
}
