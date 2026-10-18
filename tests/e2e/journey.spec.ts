import { expect, test } from "@playwright/test";

// Requires `supabase start`, seeded users and E2E_* env. See docs/TESTING.md.
test.describe("public", () => {
  test("catalog and verification pages render", async ({ page }) => {
    await page.goto("/courses"); await expect(page.getByRole("heading", { name: /find a course/i })).toBeVisible();
    await page.goto("/verify/CRT-0000-NOPE"); await expect(page.getByText(/not found/i)).toBeVisible();
  });
  test("anonymous users are redirected from every portal", async ({ page }) => {
    for (const p of ["/learner/dashboard", "/instructor/dashboard", "/reviewer/queue", "/admin/dashboard", "/organization/dashboard"]) {
      await page.goto(p); await expect(page).toHaveURL(/\/login/);
    }
  });
});
test.describe("access control (needs seeded users)", () => {
  test.skip(!process.env.E2E_LEARNER_EMAIL, "set E2E_LEARNER_EMAIL / E2E_LEARNER_PASSWORD");
  test("a learner cannot open the admin portal", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(process.env.E2E_LEARNER_EMAIL!); await page.getByLabel("Password").fill(process.env.E2E_LEARNER_PASSWORD!);
    await page.getByRole("button", { name: "Log in" }).click(); await expect(page).toHaveURL(/learner\/dashboard/);
    await page.goto("/admin/dashboard"); await expect(page).toHaveURL(/forbidden/);
  });
});
