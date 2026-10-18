import { describe, expect, it } from "vitest";
import { questionSchema, registerSchema, safeFileName, validateUpload } from "@/lib/validation";
import { toCsv } from "@/services/reporting.csv";

describe("validation", () => {
  it("rejects weak passwords and bad emails", () => {
    expect(registerSchema.safeParse({ fullName: "Asha", email: "a@b.co", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "Asha", email: "nope", password: "longenoughpassword" }).success).toBe(false);
    expect(registerSchema.safeParse({ fullName: "Asha", email: "A@B.co", password: "longenoughpassword" }).success).toBe(true);
  });
  it("requires a correct answer on choice questions", () => {
    const base = { quizId: "7b1f6a0e-6a8c-4a5e-9d4b-0f3f2d1c9b11", prompt: "What is MFA?", points: 1 };
    expect(questionSchema.safeParse({ ...base, type: "single", options: [{ label: "x", correct: false }, { label: "y", correct: false }] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, type: "single", options: [{ label: "x", correct: true }, { label: "y", correct: false }] }).success).toBe(true);
    expect(questionSchema.safeParse({ ...base, type: "single", options: [{ label: "x", correct: true }, { label: "y", correct: true }] }).success).toBe(false);
    expect(questionSchema.safeParse({ ...base, type: "short_text", accepted: [] }).success).toBe(false);
  });
  it("restricts uploads by type, extension and size", () => {
    expect(validateUpload("assignments", { name: "a.pdf", type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateUpload("assignments", { name: "a.exe", type: "application/pdf", size: 1000 })).not.toBeNull();
    expect(validateUpload("assignments", { name: "a.pdf", type: "application/x-msdownload", size: 1000 })).not.toBeNull();
    expect(validateUpload("assignments", { name: "a.pdf", type: "application/pdf", size: 50 * 1024 * 1024 })).not.toBeNull();
    expect(validateUpload("course-public", { name: "x.svg", type: "image/svg+xml", size: 10 })).not.toBeNull();
  });
  it("sanitizes file names", () => expect(safeFileName("../../etc/pass wd.pdf")).not.toMatch(/[\/ ]/));
  it("neutralizes CSV formula injection", () => expect(toCsv([{ a: "=SUM(A1)" }])).toContain("'=SUM(A1)"));
});
