import { redirect } from "next/navigation";

export const metadata = { title: "Password support", robots: { index: false, follow: false } };

export default function PasswordSupport() {
  redirect(`/login?notice=${encodeURIComponent("For password help, contact your platform administrator.")}`);
}
