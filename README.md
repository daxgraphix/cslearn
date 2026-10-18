# CSGO

A production-oriented learning management system built as a **modular monolith**: one Next.js application, one authoritative PostgreSQL database (Supabase), strict server-side authorization, versioned courses, server-side grading and verifiable certificates.

* **Learning platform**: catalog, enrollment, course player, quizzes, assignments, completion, certificates
* **Governance platform**: roles, review and approval workflow, publishing, audit trail
* **Operations platform**: notifications, support desk, reports, job queue, monitoring hooks
* **Institutional platform**: organizations, cohorts, assigned training, org-scoped reports, bulk enrollment

English and Kiswahili interface (`src/i18n`). Visual design follows the instructor-studio reference (white surfaces, one blue action color, purple quiz chips, amber drafts).

## Quick start

```bash
npm install
npx supabase start                  # local Postgres, Auth, Storage (needs Docker)
cp .env.example .env.local          # fill keys printed by `supabase start`
npx supabase db reset               # applies supabase/migrations/0001..0008
node --env-file=.env.local scripts/seed-dev.mjs   # demo users, published course, a draft like the studio screenshot
npm run dev                         # http://localhost:3000
```

Demo logins (password `Passw0rd!demo`): `owner@`, `admin@`, `reviewer@`, `instructor@`, `learner@`, `support@`, `orgmanager@demo.test`.
Set `enable_confirmations = false` in `supabase/config.toml` for local sign-up without email, or use the seed users.

## Deploy to Vercel

For a new hosted Supabase project, import [`supabase/schema.sql`](supabase/schema.sql) in the Supabase SQL Editor, then follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) to configure Supabase Auth and Vercel environment variables.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Run the app |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest unit tests (permissions, grading, completion, certificates, validation, webhooks) |
| `npm run test:e2e` | Playwright journeys (see `docs/TESTING.md`) |
| `npx supabase test db` | pgTAP RLS and privilege tests (`supabase/tests`) |

## Project map

```
supabase/migrations   0001 schema · 0002 functions (transactions, grading, certificates) · 0003 RLS + storage · 0004 seed · 0005 org/report/helpers · 0006 branding · 0007 payment removal · 0008 audited dead-job retry
src/lib               auth guards, permission policy, zod validation, grading rules, rate limit, certificate PDF
src/services          one module per domain: catalog, authoring, governance, learning, certification, payments, admin, organization, support, ...
src/app               (public) · (auth) · learner · instructor · reviewer · admin · organization · support · api
src/components        Shell (sidebar), Player, QuizRunner, UI kit
docs                  ARCHITECTURE, ROLES_PERMISSIONS, WORKFLOWS, DATABASE, SECURITY, OPERATIONS, TESTING, ROADMAP, DEFINITION_OF_DONE
tests, scripts        unit and e2e tests, dev seed
```

## Ground rules baked into the code

1. Route groups and middleware are **navigation only**. Every server action and query re-checks identity, active status, permission, resource scope and business state.
2. Roles never override ownership, organization boundaries, enrollment or explicit denials (`permission_denials`).
3. Course content lives in **versions**; learners keep the version they enrolled in; published versions are never edited in place.
4. Answer keys live in tables with **no browser grants**; grading happens in `submit_quiz_attempt()`.
5. Status transitions (submit, review, publish, suspend, certificate issue/revoke) happen only in `SECURITY DEFINER` functions that re-check permissions and write the audit log.
6. Payments are granted only from verified, idempotent webhook events.

Before production read `docs/OPERATIONS.md` (RPO/RTO, backups, monitoring) and complete `docs/DEFINITION_OF_DONE.md`.
