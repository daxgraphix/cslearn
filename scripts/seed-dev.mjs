// Dev seed: creates demo users (one per role), a reviewed & published demo course and a draft like the studio screenshot.
// Usage: node --env-file=.env.local scripts/seed-dev.mjs     (needs `supabase start` and SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
if (!/127\.0\.0\.1|localhost/.test(url)) throw new Error("Refusing to seed a non-local database");
const db = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = "Passw0rd!demo";

const users = [
  ["owner@demo.test", "Olivia Owner", ["owner"]], ["admin@demo.test", "Adam Admin", ["admin"]],
  ["reviewer@demo.test", "Rita Reviewer", ["reviewer"]], ["instructor@demo.test", "Ismail Instructor", ["instructor"]],
  ["learner@demo.test", "Lulu Learner", []], ["support@demo.test", "Sara Support", ["support"]], ["orgmanager@demo.test", "Omari Org", []],
];
const ids = {};
for (const [email, name, roles] of users) {
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name } });
  let id = data?.user?.id;
  if (error) { const { data: list } = await db.auth.admin.listUsers({ perPage: 200 }); id = list.users.find((u) => u.email === email)?.id; }
  ids[email] = id;
  for (const r of roles) {
    const { data: role } = await db.from("roles").select("id").eq("key", r).single();
    await db.from("user_roles").insert({ user_id: id, role_id: role.id }); // duplicate rows are rejected by the unique index; ignore
  }
}

async function makeCourse(slug, title, ownerEmail, publish) {
  const owner = ids[ownerEmail];
  const { data: course } = await db.from("courses").insert({ slug, owner_id: owner }).select("id").single();
  const { data: v } = await db.from("course_versions").insert({
    course_id: course.id, version_number: 1, title, subtitle: "A hands-on introduction", created_by: owner,
    description: "Learn the basics with short lessons and a knowledge check after each module.", objectives: ["Explain core concepts", "Apply them in a practical scenario"],
    estimated_minutes: 90, price_cents: 0, status: publish ? "published" : "draft", published_at: publish ? new Date().toISOString() : null,
  }).select("id").single();
  await db.from("course_instructors").insert({ course_id: course.id, user_id: owner, role: "lead" });
  const { data: m } = await db.from("modules").insert({ version_id: v.id, position: 0, title: "Getting Started" }).select("id").single();
  const lessons = [["Welcome", "text", { html: "Welcome to the course." }, { mode: "manual" }], ["Intro video", "video", { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }, { mode: "watch_percent", threshold: 90 }], ["Module 1 Knowledge Check", "quiz", {}, { mode: "quiz_pass" }]];
  for (const [i, [t, type, body, rule]] of lessons.entries()) {
    const { data: l } = await db.from("lessons").insert({ module_id: m.id, position: i, title: t, type, body, completion_rule: rule }).select("id").single();
    if (type === "quiz") {
      const { data: q } = await db.from("quizzes").insert({ lesson_id: l.id, pass_mark: 70 }).select("id").single();
      const { data: qq } = await db.from("questions").insert({ quiz_id: q.id, position: 0, type: "single", prompt: "What does MFA stand for?", points: 1 }).select("id").single();
      for (const [j, [label, ok]] of [["Multi-factor authentication", true], ["Main firewall access", false], ["Managed file archive", false]].entries()) {
        const { data: o } = await db.from("answer_options").insert({ question_id: qq.id, position: j, label }).select("id").single();
        await db.from("answer_keys").insert({ option_id: o.id, is_correct: ok });
      }
    }
  }
  if (publish) await db.from("courses").update({ published_version_id: v.id }).eq("id", course.id);
  return course.id;
}
await makeCourse("cyber-hygiene-basics", "Cyber Hygiene Basics", "instructor@demo.test", true);
await makeCourse("demo-course-242034", "Demo Course 242034", "instructor@demo.test", false);

const { data: org } = await db.from("organizations").insert({ name: "Demo University", slug: "demo-university" }).select("id").single();
await db.from("organization_memberships").insert([{ organization_id: org.id, user_id: ids["orgmanager@demo.test"], member_type: "manager" }, { organization_id: org.id, user_id: ids["learner@demo.test"], member_type: "learner" }]);
console.log("Seed complete. All demo accounts use password:", PASSWORD);
