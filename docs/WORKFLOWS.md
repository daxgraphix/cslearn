# Workflows (implementation map)

**A. Author → review → publish.** Instructor creates draft (`create_course`) → builds modules/lessons/quizzes (RLS allows edits only on `draft`/`changes_requested`) → `validate_version` blocks incomplete versions → `submit_version` → assignment (`assignReviewer`) → `review_submission` (approve / request changes / reject, comments, notification) → authorized publisher `publish_version` → `publication_events` + audit. Controls: no self-approval, no publishing incomplete or unapproved versions, no silent overwrite (revisions are new versions), full decision history.

**B. Registration and enrollment.** Supabase Auth sign-up with email verification → trigger `handle_new_user` creates profile, learner role, notification preferences → `enroll_self` checks published, not retired, availability window, org visibility and enrollment policy → idempotent free enrollment bound to the published version. Cohort assignment: `org_assign_course`.

**C. Learning and progress.** Player re-verifies enrollment (`getPlayer`) → `complete_lesson` validates the lesson belongs to the enrolled version and its completion rule (`manual`, `watch_percent`, `quiz_pass`, `submission`, `attendance`) → idempotent upsert → `recalc_completion` writes `course_completions` and sets enrollment `completed`.

**D. Assessment.** `start_quiz_attempt` (limits, timer, resume) → `submit_quiz_attempt` grades on the server from `answer_keys`/`short_answer_keys` (no browser grants) → results released per `show_results`. Assignments: private bucket upload → instructor queue → `grade_submission` with `grade_events` history; finalized grades need `grade.override`.

**E. Certificates.** `issue_certificate` checks completion, pass mark and flag, is idempotent (unique valid cert per enrollment), snapshots name/title, enqueues PDF job. `revoke_certificate` keeps the row and adds `certificate_events`. Public `/verify/[serial]` exposes only name, course, date, status.

**F. Suspension.** `suspend_user` (reason, audit, notification, enrollments suspended) + app layer revokes sessions via `auth.admin.signOut`. Learning history, legacy financial records and certificates are retained. `reinstate_user` logs separately.
