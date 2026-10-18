# Architecture

## Principle
Separate the **public learning experience**, **internal administration**, **course governance** and **core learning records**, while keeping one coherent platform: a **modular monolith** with a single authoritative PostgreSQL database. Extract workers or services only when operational needs justify it (video transcoding, heavy exports, email volume).

| Layer | Technology | Responsibility |
|---|---|---|
| Web | Next.js 15 (App Router) + React 19 + TypeScript | Public site, dashboards, course player |
| Styling | Tailwind CSS, accessible patterns (skip link, focus rings, aria) | Responsive, consistent UI |
| Backend | Server Actions + Route Handlers (`src/app/actions.ts`, `src/app/api`) | Secure operations and APIs |
| Database | PostgreSQL via Supabase | Relational records, transactions, constraints, RLS |
| Auth | Supabase Auth | Sign-in, recovery, sessions |
| Authorization | Service guards (`src/lib/auth.ts`) + RLS + SECURITY DEFINER functions | Role and resource access |
| Storage | Supabase Storage (5 buckets) | Public thumbnails, private materials, assignments, certificates |
| Tests | Vitest, Playwright, pgTAP | Unit, e2e, RLS |

## Domain modules (`src/services`)
`catalog` · `authoring` · `governance` · `learning` · `certification` · `notifications` · `reporting` · `admin` · `organization` · `support` · `storage` · `jobs`.
Route handlers and actions do four things only: **authenticate, validate (zod), authorize, call a service, return a consistent envelope** (`run()` in `src/lib/action.ts`). Business rules that must be atomic live in SQL functions (`supabase/migrations/0002_functions.sql`).

## Request flow
```
Browser → middleware (session refresh, redirect anonymous)   [UX only]
        → layout gate  enterPortal(portal)                    [navigation only]
        → page / server action
             1 identity        getSessionUser() → auth.getUser() validates JWT
             2 account active  profiles.status
             3 permission      requirePermission(...)
             4 scope           course team / org manager / enrollment (RLS repeats this)
             5 business state  version status, attempt limits, enrollment policy, etc. (SQL functions)
             6 version/enroll  learner studies the version they enrolled in
        → Supabase (RLS as the user) or service role after explicit checks
```

## Course versioning
`courses` is the stable catalog identity; `course_versions` holds each revision (metadata, modules, lessons, quizzes). A partial unique index allows **one open revision** per course. `create_draft_revision()` clones the published version; `submit_version()` validates; `review_submission()` records the decision (no self-review); `publish_version()` archives the previous version and flips `courses.published_version_id` atomically. `enrollments.version_id` keeps each learner's content stable; certificates snapshot learner name and course title.

## Background work
`jobs` table with `claim_jobs()` (`FOR UPDATE SKIP LOCKED`), exponential backoff, `dead` state. `POST /api/jobs/run` (bearer secret) is called by cron. Handlers: email and certificate PDF. Scheduled publication runs in the same tick (`release_scheduled_versions()`).

## UI structure
Shared public site; separate workspaces per portal (learner, instructor studio, reviewer, admin, organization, support) with one sidebar `Shell`. The instructor builder (`/instructor/courses/[id]/builder`) follows the studio reference: breadcrumb card, status dot, Submit for review, Admin feedback, Preview as student, Quick actions, Curriculum / Settings tabs, module cards with ordered lesson rows and quiz chips.
