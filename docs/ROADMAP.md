# Roadmap and feature inventory

| Phase | Scope | Status in this package |
|---|---|---|
| 1 Foundation | migrations, auth, profiles, role assignment, RLS, layouts, audit | implemented |
| 2 Studio and governance | metadata, builder, quizzes, drafts, revisions, reviewer queue, approval, publish | implemented (rich-text editor and file upload UI are the next increment) |
| 3 Learner and assessment | catalog, enrollment, player, progress, quizzes, assignments, grading, completion | implemented |
| 4 Certificates and operations | verification, PDF job, notifications, analytics, support desk, admin reports, job monitor | implemented (email provider and error tracker need keys) |
| 5 Advanced and launch | organizations, cohorts, free enrollment, bulk CSV import, scheduled publication, Swahili UI | implemented; performance tests and hardening remain |

## Known gaps to close before production
Rich-text lesson editor and drag-and-drop (reorder uses accessible up/down buttons), resource upload UI for authors (storage service and policies exist), live-session attendance entry, learning-path admin UI, virus scanning, MFA enforcement UI, CSP, Redis rate limiter, full i18n of every string (shell, catalog and player are translated first), real email provider.
