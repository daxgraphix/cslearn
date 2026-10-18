"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { Portal } from "@/lib/permissions";

const PORTAL_NAMES: Record<Portal, string> = { learner: "Learner", instructor: "Instructor studio", reviewer: "Reviewer", admin: "Administration", organization: "Organization", support: "Support desk" };
const LABELS: Record<string, string> = {
  dashboard: "Dashboard", "my-learning": "My learning", assessments: "Assessments", certificates: "Certificates", notifications: "Notifications", settings: "Settings", support: "Support",
  courses: "Courses", submissions: "Submissions", assignments: "Grading", analytics: "Analytics", queue: "Queue", reviews: "Reviews", users: "Users", categories: "Categories", enrollments: "Enrollments",
  organizations: "Organizations", reports: "Reports", roles: "Roles and access", security: "Security and audit", operations: "Operations", members: "Members", cohorts: "Cohorts", builder: "Course builder", quiz: "Quiz editor", new: "Create course",
};

export function WorkspaceBreadcrumbs({ portal }: { portal: Portal }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2 || segments[0] !== portal) return null;
  let href = `/${segments[0]}`;
  const crumbs = [{ label: PORTAL_NAMES[portal], href: `/${portal === "support" ? "support/queue" : `${portal}/dashboard`}` }];
  for (const segment of segments.slice(1)) {
    href += `/${segment}`;
    if (/^[0-9a-f-]{20,}$/i.test(segment)) continue;
    crumbs.push({ label: LABELS[segment] ?? segment.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), href });
  }
  return <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-1.5 overflow-x-auto text-xs text-ink-faint sm:text-sm">
    {crumbs.map((crumb, index) => <span key={`${crumb.href}-${index}`} className="inline-flex shrink-0 items-center gap-1.5">
      {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
      {index === crumbs.length - 1 ? <span aria-current="page" className="max-w-48 truncate font-medium capitalize text-ink">{crumb.label}</span> : <Link href={crumb.href} className="max-w-48 truncate capitalize transition-colors hover:text-brand">{crumb.label}</Link>}
    </span>)}
  </nav>;
}
