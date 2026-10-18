import { z } from "zod";

const slug = z.string().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");
export const uuid = z.string().uuid();

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10, "Use at least 10 characters").max(128),
  locale: z.literal("en").default("en"),
});
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
export const createPlatformRoleSchema = z.object({
  key: z.string().trim().min(3).max(48).regex(/^[a-z][a-z0-9_]*$/, "Use lowercase letters, numbers, and underscores"),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().min(1).max(100)).min(1).max(50),
});
export const updatePlatformRoleSchema = z.object({
  key: z.string().trim().min(2).max(48).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string().min(1).max(100)).min(1).max(50),
});
export const inviteUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  roleKey: z.string().trim().min(2).max(48).regex(/^[a-z][a-z0-9_]*$/),
});

export const createCourseSchema = z.object({ title: z.string().trim().min(3).max(140), slug, categoryId: uuid.optional().or(z.literal("")) });
export const courseMetaSchema = z.object({
  courseId: uuid, versionId: uuid,
  title: z.string().trim().min(3).max(140),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(10000).optional(),
  objectives: z.array(z.string().trim().min(3).max(200)).max(20),
  prerequisites: z.string().trim().max(2000).optional(),
  language: z.literal("en"),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.coerce.number().int().min(0).max(100000).optional(),
  enrollmentPolicy: z.enum(["open", "approval", "invite_only"]),
  passMark: z.coerce.number().int().min(0).max(100),
  certificateEnabled: z.coerce.boolean(),
  seoTitle: z.string().max(70).optional(), seoDescription: z.string().max(160).optional(),
});
export const moduleSchema = z.object({ versionId: uuid, title: z.string().trim().min(2).max(140), description: z.string().max(1000).optional() });
export const lessonSchema = z.object({
  moduleId: uuid, title: z.string().trim().min(2).max(160),
  type: z.enum(["video", "text", "document", "external", "quiz", "assignment", "practical", "live", "survey"]),
  durationMinutes: z.coerce.number().int().min(0).max(1000).optional(),
  isRequired: z.coerce.boolean().default(true),
  url: z.string().url().optional().or(z.literal("")),
  text: z.string().max(50000).optional(),
}).superRefine((lesson, ctx) => {
  if (lesson.type === "video" && !lesson.url) ctx.addIssue({ code: "custom", path: ["url"], message: "Add a video URL or upload an MP4 video." });
});
export const questionSchema = z.object({
  quizId: uuid, type: z.enum(["single", "multiple", "true_false", "short_text"]), prompt: z.string().trim().min(3).max(2000),
  points: z.coerce.number().int().min(1).max(100).default(1),
  options: z.array(z.object({ label: z.string().trim().min(1).max(400), correct: z.boolean() })).max(10).default([]),
  accepted: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
}).superRefine((q, ctx) => {
  if (q.type !== "short_text" && !q.options.some((o) => o.correct)) ctx.addIssue({ code: "custom", message: "Mark at least one correct answer" });
  if (q.type === "single" && q.options.filter((o) => o.correct).length !== 1) ctx.addIssue({ code: "custom", message: "Single choice needs exactly one correct answer" });
  if (q.type === "short_text" && q.accepted.length === 0) ctx.addIssue({ code: "custom", message: "Add accepted answers" });
});
export const reviewSchema = z.object({ submissionId: uuid, decision: z.enum(["approved", "rejected", "changes_requested"]), summary: z.string().trim().min(3).max(4000) });
export const reviewAssignmentSchema = z.object({ submissionId: uuid, reviewerId: uuid });
export const reviewCommentSchema = z.object({ submissionId: uuid, lessonId: uuid.nullable(), body: z.string().trim().min(1).max(4000) });
export const suspendSchema = z.object({ userId: uuid, reason: z.string().trim().min(5).max(500) });
export const answersSchema = z.array(z.object({ question_id: uuid, option_ids: z.array(uuid).max(10).optional(), text: z.string().max(2000).optional() })).max(200);
export const ticketSchema = z.object({ subject: z.string().trim().min(3).max(160), category: z.enum(["general", "access", "academic", "security", "privacy"]), body: z.string().trim().min(5).max(5000) });

export const ALLOWED_UPLOADS: Record<string, { mimes: string[]; maxBytes: number }> = {
  assignments: { mimes: ["application/pdf", "image/png", "image/jpeg", "text/plain"], maxBytes: 10 * 1024 * 1024 },
  "course-private": { mimes: ["application/pdf", "image/png", "image/jpeg", "video/mp4", "text/plain", "application/zip"], maxBytes: 100 * 1024 * 1024 },
  "course-public": { mimes: ["image/png", "image/jpeg", "image/webp"], maxBytes: 5 * 1024 * 1024 },
};
const BLOCKED_EXT = /\.(exe|bat|cmd|sh|js|mjs|html?|svg|php|jar|msi|dll|scr|ps1)$/i;
export function validateUpload(bucket: keyof typeof ALLOWED_UPLOADS, file: { name: string; type: string; size: number }) {
  const rule = ALLOWED_UPLOADS[bucket];
  if (!rule) return "Unknown bucket";
  if (BLOCKED_EXT.test(file.name)) return "This file type is not allowed";
  if (!rule.mimes.includes(file.type)) return "Unsupported file type";
  if (file.size > rule.maxBytes) return "File is too large";
  return null;
}
export function safeFileName(name: string) { return name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-100); }
