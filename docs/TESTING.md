# Testing

| Layer | Tooling | What is covered now |
|---|---|---|
| Unit | Vitest `tests/unit` | permission policy, self-review block, grading, completion idempotency, certificate eligibility, zod schemas, uploads, CSV injection, PDF |
| RLS / DB | pgTAP `supabase/tests/rls.test.sql` (`npx supabase test db`) | profile isolation, column grants, role self-grant, answer-key privacy, course creation, suspension, audit privacy |
| E2E | Playwright `tests/e2e` | public pages, anonymous redirects, learner blocked from admin (with seeded users) |

Add next (listed in the definition of done): cross-organization isolation, instructor-vs-instructor edits, full journey register → enroll → complete → certificate, concurrent enrollment/certificate issuance (idempotency), upload abuse, performance (catalog search, concurrent lesson access, large imports), recovery drills.

E2E env: `E2E_LEARNER_EMAIL`, `E2E_LEARNER_PASSWORD` (use `learner@demo.test` after running the seed).
