"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const path = usePathname();
  const active = path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] transition-colors", active ? "bg-brand-soft font-medium text-brand ring-1 ring-brand/15" : "text-ink-soft hover:bg-surface-muted hover:text-ink")}>
      {icon}<span>{label}</span>
    </Link>
  );
}
