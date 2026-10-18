import { Shell } from "@/components/Shell";
import { enterPortal } from "@/lib/portal";
import type { Metadata } from "next";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const { user, portals } = await enterPortal("organization");
  return <Shell portal="organization" portals={portals} name={user.fullName || user.email} permissions={user.permissions}>{children}</Shell>;
}
