"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const STORAGE_KEY = "csgot-sidebar-collapsed";

export function SidebarFrame({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true"); }
    catch { /* Sidebar still works when browser storage is unavailable. */ }
  }, []);

  function toggle() {
    setCollapsed((current) => {
      const next = !current;
      try { window.localStorage.setItem(STORAGE_KEY, String(next)); }
      catch { /* Keep the current preference for this page session. */ }
      return next;
    });
  }

  return <aside data-collapsed={collapsed} aria-label="Workspace sidebar" className={`group/sidebar sticky top-0 hidden h-screen shrink-0 flex-col overflow-y-auto border-r border-surface-line bg-white px-3 py-4 transition-[width] duration-200 md:flex ${collapsed ? "w-[4.75rem]" : "w-64"}`}>
    <div className={`sticky top-0 z-10 -mx-3 mb-3 flex items-center bg-white px-3 pb-1 ${collapsed ? "justify-center" : "justify-end"}`}>
      <button type="button" onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"} aria-expanded={!collapsed} aria-controls="workspace-sidebar-content" title={collapsed ? "Expand sidebar" : "Minimize sidebar"} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-muted hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
      </button>
    </div>
    <div id="workspace-sidebar-content" className="flex min-h-0 flex-1 flex-col">{children}</div>
  </aside>;
}
