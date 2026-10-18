import { Shell } from "@/components/Shell";
import { enterPortal } from "@/lib/portal";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { user, portals } = await enterPortal("admin");
  return <Shell portal="admin" portals={portals} name={user.fullName || user.email}>{children}</Shell>;
}
