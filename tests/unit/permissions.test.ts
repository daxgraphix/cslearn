import { describe, expect, it } from "vitest";
import { can, canEditVersion, canReviewVersion, portalsFor } from "@/lib/permissions";

describe("permission policy", () => {
  it("grants only listed permissions", () => {
    expect(can(["course.create"], [], "course.create")).toBe(true);
    expect(can(["course.create"], [], "course.publish")).toBe(false);
  });
  it("explicit denial beats a grant", () => {
    expect(can(["course.publish"], ["course.publish"], "course.publish")).toBe(false);
  });
  it("authors edit only open versions of their own course", () => {
    expect(canEditVersion({ isAuthor: true, hasOwn: true, hasAny: false, status: "draft" })).toBe(true);
    expect(canEditVersion({ isAuthor: true, hasOwn: true, hasAny: false, status: "changes_requested" })).toBe(true);
    expect(canEditVersion({ isAuthor: true, hasOwn: true, hasAny: false, status: "in_review" })).toBe(false);
    expect(canEditVersion({ isAuthor: true, hasOwn: true, hasAny: false, status: "published" })).toBe(false);
    expect(canEditVersion({ isAuthor: false, hasOwn: true, hasAny: false, status: "draft" })).toBe(false);
  });
  it("blocks self-approval and unassigned reviewers", () => {
    const base = { reviewerId: "r", submittedBy: "a", isCourseInstructor: false, assignedTo: "r", hasAny: false };
    expect(canReviewVersion(base)).toBe(true);
    expect(canReviewVersion({ ...base, submittedBy: "r" })).toBe(false);
    expect(canReviewVersion({ ...base, isCourseInstructor: true })).toBe(false);
    expect(canReviewVersion({ ...base, assignedTo: "x" })).toBe(false);
    expect(canReviewVersion({ ...base, assignedTo: "x", hasAny: true })).toBe(true);
  });
  it("an instructor is not automatically an admin or reviewer", () => {
    const p = portalsFor(["instructor"], new Set(["course.create", "course.update.own", "course.submit"]), false);
    expect(p).toContain("instructor"); expect(p).not.toContain("admin"); expect(p).not.toContain("reviewer");
  });
  it("custom roles reach the admin portal only with an admin-capable permission", () => {
    expect(portalsFor(["custom_role"], new Set(["role.assign"]), false)).toContain("admin");
    expect(portalsFor(["custom_role"], new Set(["support.reply"]), false)).not.toContain("admin");
  });
});
