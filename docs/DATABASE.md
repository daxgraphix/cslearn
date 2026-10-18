# Database

Logical domains in one PostgreSQL database (`supabase/migrations`):

* **Identity and access**: profiles, roles, permissions, role_permissions, user_roles, permission_denials, organizations, organization_memberships
* **Catalog and content**: categories, tags, courses, course_versions, course_instructors, course_tags, modules, lessons, lesson_resources, learning_paths, learning_path_courses
* **Review and publishing**: course_submissions, course_reviews, review_comments, publication_events, audit_logs (append-only trigger)
* **Learning and assessment**: enrollments, lesson_progress, course_completions, quizzes, questions, answer_options, **answer_keys**, short_answer_keys, quiz_attempts, quiz_responses, assignments, submissions, grades, grade_events, course_evaluations
* **Certificates**: certificates, certificate_events
* **Operations**: notifications, notification_preferences, support_tickets, support_messages, cohorts, cohort_memberships, cohort_course_assignments, data_export_requests, jobs, settings

## Integrity rules implemented
1. UUID keys, foreign keys, unique constraints, check constraints, timestamps.
2. `unique (learner_id, course_id)` on enrollments (repeat enrollment is not a feature).
3. Deferrable unique ordering: `(version_id, position)` for modules, `(module_id, position)` for lessons (safe swaps).
4. Content belongs to a **version**; `enrollments.version_id` and `certificates.version_id` keep history interpretable.
5. Answer keys in separate tables, no browser grants.
6. Transactions in SQL functions for submit, review, publish, enroll, grade, issue and suspend.
7. Certificates are never deleted: `revoked` status plus `certificate_events`.
8. Selective deletion: `on delete restrict` on enrollments → courses and certificates → enrollments.
9. Indexes on enrollment lookups, user roles, review queue, audit access patterns; add more from `pg_stat_statements` after launch.

Legacy finance tables are retained for historical records only. Migration `0007_remove_payments.sql` removes browser access, payment RPC access, and paid enrollment behavior.

## Storage buckets
`course-public` (thumbnails), `course-private` (materials, signed URLs only), `assignments` (learner folder `{user_id}/…`), `certificates`, `admin-docs`. MIME and size limits are set on the bucket and re-validated in `validateUpload`.
