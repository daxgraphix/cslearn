"use server";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabase } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { run } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema, registerSchema, createCourseSchema, courseMetaSchema, reviewSchema, answersSchema } from "@/lib/validation";
import { requireUser } from "@/lib/auth";
import * as authoring from "@/services/authoring";
import * as governance from "@/services/governance";
import * as learning from "@/services/learning";
import * as cert from "@/services/certification";
import * as admin from "@/services/admin";
import * as org from "@/services/organization";
import * as support from "@/services/support";
import * as storage from "@/services/storage";
import * as notifications from "@/services/notifications";

/** Runs a service call; on failure redirects back with a safe message, on success revalidates and optionally redirects. */
async function exec(path: string, fn: () => Promise<unknown>, after?: string | ((r: any) => string)) {
  const res = await run(fn);
  if (!res.ok) redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(res.error)}`);
  revalidatePath(path);
  if (after) redirect(typeof after === "function" ? after(res.data) : after);
}
const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

// ---------- auth ----------
export async function registerAction(formData: FormData) {
  const rl = rateLimit(`register:${await clientIp()}`, 5, 10 * 60_000);
  if (!rl.ok) redirect(`/register?error=${encodeURIComponent("For your security, signup is temporarily paused. Wait a few minutes and try again.")}`);
  const parsed = registerSchema.safeParse({ fullName: s(formData, "fullName"), email: s(formData, "email"), password: s(formData, "password"), locale: s(formData, "locale") || "en" });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    const message = field === "email" ? "Enter a valid email address." : field === "password" ? "Use a password between 10 and 128 characters." : "Enter your name using at least 2 characters.";
    redirect(`/register?error=${encodeURIComponent(message)}`);
  }
  let failed = false;
  let signedIn = false;
  try {
    const supabase = await createSupabase();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email, password: parsed.data.password,
      options: { data: { full_name: parsed.data.fullName, locale: parsed.data.locale }, emailRedirectTo: new URL("/auth/callback", getSiteUrl()).toString() },
    });
    failed = Boolean(error);
    signedIn = Boolean(data.session);
  } catch {
    failed = true;
  }
  if (failed) redirect(`/register?error=${encodeURIComponent("We couldn’t submit your signup right now. Check your connection and try again. If you already signed up, try logging in or resetting your password.")}`);
  if (signedIn) redirect("/learner/dashboard");
  redirect(`/register?notice=${encodeURIComponent("Your signup request was received. Check your inbox and spam folder for a verification link before logging in.")}`);
}

export async function loginAction(formData: FormData) {
  const ip = await clientIp();
  const parsed = loginSchema.safeParse({ email: s(formData, "email"), password: s(formData, "password") });
  if (!parsed.success) redirect(`/login?error=${encodeURIComponent("Enter a valid email address and password.")}`);
  const rl = rateLimit(`login:${ip}:${parsed.data.email}`, 8, 10 * 60_000);
  if (!rl.ok) redirect(`/login?error=${encodeURIComponent("Too many sign-in attempts. Wait a few minutes before trying again.")}`);
  let failed = false;
  try {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirect(`/login?error=${encodeURIComponent("We couldn’t sign you in. Check your email and password, and make sure your email is verified.")}`);
  const next = s(formData, "next");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/learner/dashboard");
}

export async function logoutAction() {
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
export async function requestPasswordResetAction(formData: FormData) {
  const rl = rateLimit(`reset:${await clientIp()}`, 3, 15 * 60_000);
  if (rl.ok) {
    try {
      const redirectTo = new URL("/auth/callback?next=/reset-password", getSiteUrl()).toString();
      await (await createSupabase()).auth.resetPasswordForEmail(s(formData, "email"), { redirectTo });
    } catch { /* Keep recovery responses neutral when the auth service is unavailable. */ }
  }
  redirect(`/login?notice=${encodeURIComponent("If an account matches that email, recovery instructions will be sent. Check your inbox and spam folder.")}`);
}
export async function updatePasswordAction(formData: FormData) {
  const password = s(formData, "password");
  if (password.length < 10 || password.length > 128) {
    redirect(`/reset-password?error=${encodeURIComponent("Use a password between 10 and 128 characters.")}`);
  }
  try {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
  } catch {
    redirect(`/reset-password?error=${encodeURIComponent("This reset link may have expired. Request a new one and try again.")}`);
  }
  redirect(`/login?notice=${encodeURIComponent("Your password has been updated. Log in with your new password.")}`);
}
export async function setLocaleAction(formData: FormData) {
  const l = "en";
  (await cookies()).set("locale", l, { path: "/", maxAge: 31536000, sameSite: "lax" });
  try { const u = await requireUser(); await (await createSupabase()).from("profiles").update({ locale: l }).eq("id", u.id); } catch { /* anonymous */ }
  revalidatePath("/", "layout");
}

// ---------- learner ----------
export async function enrollAction(formData: FormData) {
  const slug = s(formData, "slug");
  await exec(`/courses/${slug}`, () => learning.enroll(s(formData, "courseId")), (id) => `/learner/learn/${s(formData, "courseId")}?enrollment=${id}`);
}
export async function completeLessonAction(formData: FormData) {
  const path = `/learner/learn/${s(formData, "courseId")}`;
  await exec(`${path}?lesson=${s(formData, "lessonId")}`, () => learning.markComplete(s(formData, "enrollmentId"), s(formData, "lessonId"), Number(s(formData, "percent") || 100)));
}
export async function startQuizAction(enrollmentId: string, quizId: string) { return run(() => learning.startAttempt(enrollmentId, quizId)); }
export async function submitQuizAction(attemptId: string, answers: unknown) {
  return run(async () => { const a = answersSchema.parse(answers); return learning.submitAttempt(attemptId, a); });
}
export async function claimCertificateAction(formData: FormData) {
  await exec("/learner/certificates", () => cert.claimCertificate(s(formData, "enrollmentId")));
}
export async function submitAssignmentAction(formData: FormData) {
  const path = `/learner/learn/${s(formData, "courseId")}`;
  await exec(`${path}?lesson=${s(formData, "lessonId")}`, async () => {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Choose a file to upload");
    await storage.uploadAssignment(s(formData, "assignmentId"), s(formData, "enrollmentId"), file);
  });
}
export async function markNotificationReadAction(formData: FormData) { await notifications.markRead(s(formData, "id")); revalidatePath("/learner/notifications"); }
export async function updateProfileAction(formData: FormData) {
  await exec("/learner/settings", async () => {
    const u = await requireUser();
    const { error } = await (await createSupabase()).from("profiles").update({ full_name: s(formData, "fullName").slice(0, 120), bio: s(formData, "bio").slice(0, 600) }).eq("id", u.id);
    if (error) throw error;
  });
}
export async function requestDataAction(formData: FormData) {
  await exec("/learner/settings", async () => {
    const u = await requireUser(); const kind = s(formData, "kind") === "deletion" ? "deletion" : "export";
    const { error } = await (await createSupabase()).from("data_export_requests").insert({ user_id: u.id, kind, status: "requested" });
    if (error) throw error;
  });
}
export async function openTicketAction(formData: FormData) {
  await exec("/learner/support", () => support.openTicket({ subject: s(formData, "subject"), category: s(formData, "category") as any, body: s(formData, "body") }));
}

// ---------- instructor ----------
export async function createCourseAction(formData: FormData) {
  await exec("/instructor/courses/new", () => authoring.createCourse(createCourseSchema.parse({ title: s(formData, "title"), slug: s(formData, "slug"), categoryId: s(formData, "categoryId") })),
    (id) => `/instructor/courses/${id}/builder`);
}
export async function saveMetaAction(formData: FormData) {
  const courseId = s(formData, "courseId");
  await exec(`/instructor/courses/${courseId}/builder?tab=settings`, () => authoring.updateMeta(courseMetaSchema.parse({
    courseId, versionId: s(formData, "versionId"), title: s(formData, "title"), subtitle: s(formData, "subtitle") || undefined,
    description: s(formData, "description") || undefined, objectives: s(formData, "objectives").split("\n").map((x) => x.trim()).filter(Boolean),
    prerequisites: s(formData, "prerequisites") || undefined, language: s(formData, "language"), level: s(formData, "level"),
    estimatedMinutes: s(formData, "estimatedMinutes") || undefined, enrollmentPolicy: s(formData, "enrollmentPolicy"),
    priceCents: Math.round(Number(s(formData, "price") || 0) * 100), passMark: s(formData, "passMark") || 70,
    certificateEnabled: formData.get("certificateEnabled") === "on", seoTitle: s(formData, "seoTitle") || undefined, seoDescription: s(formData, "seoDescription") || undefined,
  })));
}
export async function addModuleAction(formData: FormData) {
  await exec(`/instructor/courses/${s(formData, "courseId")}/builder`, () => authoring.addModule({ versionId: s(formData, "versionId"), title: s(formData, "title") }));
}
export async function deleteModuleAction(formData: FormData) {
  await exec(`/instructor/courses/${s(formData, "courseId")}/builder`, () => authoring.deleteModule(s(formData, "moduleId")));
}
export async function addLessonAction(formData: FormData) {
  await exec(`/instructor/courses/${s(formData, "courseId")}/builder`, () => authoring.addLesson({
    moduleId: s(formData, "moduleId"), title: s(formData, "title"), type: s(formData, "type") as any,
    durationMinutes: (s(formData, "durationMinutes") || undefined) as any, isRequired: formData.get("isRequired") !== "off", url: s(formData, "url") || undefined, text: s(formData, "text") || undefined,
  }));
}
export async function deleteLessonAction(formData: FormData) {
  await exec(`/instructor/courses/${s(formData, "courseId")}/builder`, () => authoring.deleteLesson(s(formData, "lessonId")));
}
export async function moveAction(formData: FormData) {
  await exec(`/instructor/courses/${s(formData, "courseId")}/builder`, () => authoring.moveItem(s(formData, "table") as any, s(formData, "id"), s(formData, "dir") as any));
}
export async function addQuestionAction(formData: FormData) {
  const path = `/instructor/courses/${s(formData, "courseId")}/quiz/${s(formData, "quizId")}`;
  const type = s(formData, "type") as any;
  const correct = new Set(formData.getAll("correct").map(String));
  const options = type === "short_text" ? [] : [0, 1, 2, 3, 4, 5].map((i) => ({ label: s(formData, `opt${i}`).trim(), correct: correct.has(String(i)) })).filter((o) => o.label);
  await exec(path, () => authoring.addQuestion({
    quizId: s(formData, "quizId"), type, prompt: s(formData, "prompt"), points: Number(s(formData, "points") || 1), options,
    accepted: s(formData, "accepted").split("\n").map((x) => x.trim()).filter(Boolean),
  }));
}
export async function submitReviewAction(formData: FormData) {
  const courseId = s(formData, "courseId");
  await exec(`/instructor/courses/${courseId}/builder`, () => governance.submitForReview(s(formData, "versionId"), s(formData, "note") || undefined));
}
export async function createRevisionAction(formData: FormData) {
  const courseId = s(formData, "courseId");
  await exec(`/instructor/courses/${courseId}/builder`, () => governance.createRevision(courseId, s(formData, "summary") || undefined), `/instructor/courses/${courseId}/builder`);
}
export async function gradeAction(formData: FormData) {
  await exec("/instructor/assignments", async () => {
    const { error } = await (await createSupabase()).rpc("grade_submission", { p_submission: s(formData, "submissionId"), p_points: Number(s(formData, "points")), p_feedback: s(formData, "feedback").slice(0, 4000), p_reason: s(formData, "reason") || null });
    if (error) throw error;
  });
}

// ---------- reviewer / governance ----------
export async function decideAction(formData: FormData) {
  const id = s(formData, "submissionId");
  await exec(`/reviewer/reviews/${id}`, () => governance.decide(reviewSchema.parse({ submissionId: id, decision: s(formData, "decision"), summary: s(formData, "summary") })), "/reviewer/queue");
}
export async function commentAction(formData: FormData) {
  const id = s(formData, "submissionId");
  await exec(`/reviewer/reviews/${id}`, () => governance.addReviewComment(id, s(formData, "lessonId") || null, s(formData, "body")));
}
export async function assignReviewerAction(formData: FormData) {
  await exec("/admin/reviews", () => governance.assignReviewer(s(formData, "submissionId"), s(formData, "reviewerId")));
}
export async function publishAction(formData: FormData) {
  await exec("/admin/courses", () => governance.publish(s(formData, "versionId")));
}

// ---------- admin ----------
export async function suspendAction(formData: FormData) {
  await exec("/admin/users", () => admin.suspend({ userId: s(formData, "userId"), reason: s(formData, "reason") }));
}
export async function reinstateAction(formData: FormData) { await exec("/admin/users", () => admin.reinstate(s(formData, "userId"))); }
export async function roleAction(formData: FormData) {
  await exec("/admin/users", () => admin.setRole(s(formData, "userId"), s(formData, "role"), s(formData, "mode") === "grant"));
}
export async function createPlatformRoleAction(formData: FormData) {
  await exec("/admin/roles", () => admin.createPlatformRole({
    key: s(formData, "key"),
    name: s(formData, "name"),
    description: s(formData, "description"),
    permissions: formData.getAll("permissions").map(String),
  }));
}
export async function retryDeadJobAction(formData: FormData) {
  await exec("/admin/operations", () => admin.retryDeadJob(s(formData, "jobId")));
}
export async function revokeCertAction(formData: FormData) {
  await exec("/admin/certificates", () => cert.revoke(s(formData, "certificateId"), s(formData, "reason")));
}
export async function bulkEnrollAction(formData: FormData) {
  let report: any;
  await exec("/admin/enrollments", async () => { report = await admin.bulkEnroll(s(formData, "csv")); });
  redirect(`/admin/enrollments?created=${report?.created ?? 0}&dups=${report?.duplicates ?? 0}&errors=${report?.errors?.length ?? 0}`);
}
export async function unpublishAction(formData: FormData) {
  await exec("/admin/courses", async () => {
    const { error } = await (await createSupabase()).rpc("unpublish_course", { p_course: s(formData, "courseId"), p_reason: s(formData, "reason") || null });
    if (error) throw error;
  });
}
export async function replyTicketAction(formData: FormData) {
  await exec("/support/queue", () => support.reply(s(formData, "ticketId"), s(formData, "body"), formData.get("internal") === "on"));
}
export async function escalateAction(formData: FormData) {
  await exec("/support/queue", () => support.escalate(s(formData, "ticketId"), s(formData, "category") as "security" | "academic" | "privacy"));
}

// ---------- organization ----------
export async function createCohortAction(formData: FormData) { await exec("/organization/cohorts", () => org.createCohort(s(formData, "orgId"), s(formData, "name"))); }
export async function addMemberAction(formData: FormData) { await exec("/organization/members", () => org.addMember(s(formData, "orgId"), s(formData, "email"), s(formData, "cohortId") || undefined)); }
export async function assignCourseAction(formData: FormData) { await exec("/organization/cohorts", () => org.assignCourse(s(formData, "orgId"), s(formData, "cohortId"), s(formData, "courseId"))); }
