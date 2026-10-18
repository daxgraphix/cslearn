import { describe, expect, it } from "vitest";
import { certificateEligible, courseProgress, gradeAttempt } from "@/lib/grading";

const qs = [
  { id: "q1", type: "single" as const, points: 2, correctOptionIds: ["a"] },
  { id: "q2", type: "multiple" as const, points: 2, correctOptionIds: ["b", "c"] },
  { id: "q3", type: "short_text" as const, points: 1, accepted: ["Phishing"] },
];
describe("gradeAttempt", () => {
  it("scores a perfect attempt", () => {
    const r = gradeAttempt(qs, [{ questionId: "q1", optionIds: ["a"] }, { questionId: "q2", optionIds: ["c", "b"] }, { questionId: "q3", text: " phishing " }], 70);
    expect(r).toMatchObject({ score: 100, passed: true });
  });
  it("gives no partial credit on multiple choice", () => {
    const r = gradeAttempt(qs, [{ questionId: "q1", optionIds: ["a"] }, { questionId: "q2", optionIds: ["b"] }], 70);
    expect(r.earned).toBe(2); expect(r.score).toBe(40); expect(r.passed).toBe(false);
  });
  it("ignores duplicated option ids and unanswered questions", () => {
    const r = gradeAttempt(qs, [{ questionId: "q1", optionIds: ["a", "a"] }], 0);
    expect(r.earned).toBe(2);
  });
  it("never passes a quiz with no key", () => {
    expect(gradeAttempt([{ id: "x", type: "single", points: 1, correctOptionIds: [] }], [{ questionId: "x", optionIds: [] }], 50).earned).toBe(0);
  });
});
describe("completion rules", () => {
  it("is complete only when every required lesson is done", () => {
    expect(courseProgress(["1", "2"], new Set(["1"]))).toMatchObject({ pct: 50, complete: false });
    expect(courseProgress(["1", "2"], new Set(["1", "2"]))).toMatchObject({ pct: 100, complete: true });
    expect(courseProgress([], new Set()).complete).toBe(false);
  });
  it("completing a lesson twice does not change progress (idempotent)", () => {
    expect(courseProgress(["1"], new Set(["1", "1"])).done).toBe(1);
  });
});
describe("certificate eligibility", () => {
  const ok = { completed: true, finalScore: 85, passMark: 70, enabled: true, alreadyValid: false };
  it("issues when complete and passing", () => expect(certificateEligible(ok)).toBe(true));
  it("blocks below pass mark, incomplete, disabled or duplicate", () => {
    expect(certificateEligible({ ...ok, finalScore: 50 })).toBe(false);
    expect(certificateEligible({ ...ok, completed: false })).toBe(false);
    expect(certificateEligible({ ...ok, enabled: false })).toBe(false);
    expect(certificateEligible({ ...ok, alreadyValid: true })).toBe(false);
  });
});
