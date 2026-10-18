-- =====================================================================
-- 0003 Row Level Security and least-privilege grants
-- RLS is a second enforcement layer; the app layer verifies permissions too.
-- =====================================================================

-- Internal helpers must not be callable from the browser
revoke execute on function write_audit(uuid,text,text,text,jsonb,uuid) from public, anon, authenticated;
revoke execute on function clone_quiz_questions(uuid,uuid) from public, anon, authenticated;
revoke execute on function recalc_completion(uuid) from public, anon, authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Browser roles get only DML; policies decide rows. Sensitive tables get no browser grants at all.
revoke all on all tables in schema public from anon, authenticated;
grant select on categories, tags, courses, course_versions, modules, lessons, lesson_resources, course_tags,
                learning_paths, learning_path_courses, course_instructors to anon, authenticated;
grant select, insert, update, delete on profiles, courses, course_versions, modules, lessons, lesson_resources, quizzes, questions,
                answer_options, assignments, course_instructors to authenticated;
grant select on roles, permissions, role_permissions, user_roles, organizations, organization_memberships, enrollments,
                lesson_progress, course_completions, quiz_attempts, quiz_responses, submissions, grades, certificates,
                orders, entitlements, cohorts, cohort_memberships, cohort_course_assignments, course_submissions,
                course_reviews, review_comments, publication_events, audit_logs, support_tickets, support_messages,
                notifications, notification_preferences, data_export_requests, course_evaluations, jobs, settings to authenticated;
grant insert on submissions, support_tickets, support_messages, data_export_requests, course_evaluations to authenticated;
grant update on notifications, notification_preferences to authenticated;
-- NOTE: answer_keys, short_answer_keys, payments, refunds, grade_events, certificate_events get NO browser grants
-- (service role / security definer functions only).

-- ---------- identity ----------
create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid());
create policy profiles_staff_read on profiles for select to authenticated
  using (current_user_has('user.read') or current_user_has('support.read_learner'));
create policy profiles_instructor_read on profiles for select to authenticated using (
  exists (select 1 from enrollments e join course_instructors ci on ci.course_id = e.course_id
          where e.learner_id = profiles.id and ci.user_id = auth.uid()));
create policy profiles_org_manager_read on profiles for select to authenticated using (
  exists (select 1 from organization_memberships m where m.user_id = profiles.id and is_org_manager(auth.uid(), m.organization_id)));
-- Users may edit only harmless columns; status/suspension are protected by a column grant below.
create policy profiles_self_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (full_name, display_name, avatar_url, bio, locale, timezone) on profiles to authenticated;
revoke insert, delete on profiles from authenticated;

create policy roles_read on roles for select to authenticated using (true);
create policy permissions_read on permissions for select to authenticated using (true);
create policy role_permissions_read on role_permissions for select to authenticated using (true);
create policy user_roles_self on user_roles for select to authenticated using (user_id = auth.uid());
create policy user_roles_admin on user_roles for select to authenticated using (current_user_has('role.read'));

create policy orgs_member on organizations for select to authenticated using (
  exists (select 1 from organization_memberships m where m.organization_id = organizations.id and m.user_id = auth.uid()) or current_user_has('org.read.any'));
create policy org_members_self on organization_memberships for select to authenticated using (user_id = auth.uid());
create policy org_members_manager on organization_memberships for select to authenticated using (
  is_org_manager(auth.uid(), organization_id) or current_user_has('org.read.any'));

-- ---------- catalog (public reads of published content only) ----------
create policy categories_read on categories for select using (true);
create policy tags_read on tags for select using (true);
create policy course_tags_read on course_tags for select using (true);

create policy courses_public_read on courses for select using (
  published_version_id is not null and archived_at is null and visibility in ('public','unlisted'));
create policy courses_enrolled_read on courses for select to authenticated using (has_course_access(auth.uid(), id));
create policy courses_team_read on courses for select to authenticated using (
  is_course_instructor(auth.uid(), id) or current_user_has('course.read.any')
  or (organization_id is not null and exists (select 1 from organization_memberships m where m.organization_id = courses.organization_id and m.user_id = auth.uid() and m.status = 'active')));
create policy courses_insert on courses for insert to authenticated with check (owner_id = auth.uid() and current_user_has('course.create'));
create policy courses_update on courses for update to authenticated
  using ((is_course_instructor(auth.uid(), id) and current_user_has('course.update.own')) or current_user_has('course.update.any'));

-- Versions: published ones are public; drafts only to the team/reviewers; learners see the version they enrolled in.
create policy cv_published_read on course_versions for select using (
  exists (select 1 from courses c where c.published_version_id = course_versions.id and c.archived_at is null));
create policy cv_enrolled_read on course_versions for select to authenticated using (
  exists (select 1 from enrollments e where e.version_id = course_versions.id and e.learner_id = auth.uid() and e.status in ('active','completed')));
create policy cv_team_read on course_versions for select to authenticated using (
  is_course_instructor(auth.uid(), course_id) or current_user_has('course.read.any')
  or (current_user_has('course.review.assigned') and exists (select 1 from course_submissions s where s.version_id = course_versions.id and s.assigned_reviewer_id = auth.uid())));
-- Only drafts / changes_requested are writable by authors, never in_review/approved/published.
create policy cv_author_write on course_versions for update to authenticated
  using (status in ('draft','changes_requested') and is_course_instructor(auth.uid(), course_id) and current_user_has('course.update.own'))
  with check (status in ('draft','changes_requested'));
-- status transitions only through SECURITY DEFINER functions:
revoke update (status, approved_at, published_at, submitted_at, created_by, course_id, version_number) on course_versions from authenticated;
revoke insert, delete on course_versions from authenticated;

create or replace function version_is_editable(vid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_versions v where v.id = vid and v.status in ('draft','changes_requested')
     and (is_course_instructor(auth.uid(), v.course_id) and has_permission(auth.uid(),'course.update.own')));
$$;
create or replace function version_is_readable(vid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_versions v join courses c on c.id = v.course_id where v.id = vid and (
     c.published_version_id = v.id
     or is_course_instructor(auth.uid(), v.course_id) or has_permission(auth.uid(),'course.read.any')
     or exists (select 1 from enrollments e where e.version_id = v.id and e.learner_id = auth.uid() and e.status in ('active','completed'))
     or exists (select 1 from course_submissions s where s.version_id = v.id and s.assigned_reviewer_id = auth.uid())));
$$;
create or replace function module_version(mid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select version_id from modules where id = mid; $$;
create or replace function lesson_version(lid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select m.version_id from lessons l join modules m on m.id = l.module_id where l.id = lid; $$;

create policy modules_read on modules for select using (version_is_readable(version_id));
create policy modules_write on modules for all to authenticated using (version_is_editable(version_id)) with check (version_is_editable(version_id));
create policy lessons_read on lessons for select using (version_is_readable(module_version(module_id)));
create policy lessons_write on lessons for all to authenticated using (version_is_editable(module_version(module_id))) with check (version_is_editable(module_version(module_id)));
create policy resources_read on lesson_resources for select using (version_is_readable(lesson_version(lesson_id)));
create policy resources_write on lesson_resources for all to authenticated using (version_is_editable(lesson_version(lesson_id))) with check (version_is_editable(lesson_version(lesson_id)));
create policy ci_read on course_instructors for select using (true);
create policy ci_write on course_instructors for all to authenticated
  using (current_user_has('course.update.any')) with check (current_user_has('course.update.any'));

create policy paths_read on learning_paths for select using (status = 'published');
create policy path_courses_read on learning_path_courses for select using (true);

-- ---------- quizzes: structure readable, keys never ----------
create policy quizzes_read on quizzes for select to authenticated using (version_is_readable(lesson_version(lesson_id)));
create policy quizzes_write on quizzes for all to authenticated using (version_is_editable(lesson_version(lesson_id))) with check (version_is_editable(lesson_version(lesson_id)));
create policy questions_read on questions for select to authenticated using (exists (select 1 from quizzes q where q.id = quiz_id and version_is_readable(lesson_version(q.lesson_id))));
create policy questions_write on questions for all to authenticated using (exists (select 1 from quizzes q where q.id = quiz_id and version_is_editable(lesson_version(q.lesson_id))));
create policy options_read on answer_options for select to authenticated using (exists (select 1 from questions qq join quizzes q on q.id = qq.quiz_id where qq.id = question_id and version_is_readable(lesson_version(q.lesson_id))));
create policy options_write on answer_options for all to authenticated using (exists (select 1 from questions qq join quizzes q on q.id = qq.quiz_id where qq.id = question_id and version_is_editable(lesson_version(q.lesson_id))));
create policy assignments_read on assignments for select to authenticated using (version_is_readable(lesson_version(lesson_id)));
create policy assignments_write on assignments for all to authenticated using (version_is_editable(lesson_version(lesson_id))) with check (version_is_editable(lesson_version(lesson_id)));

-- ---------- governance ----------
create policy submissions_gov_read on course_submissions for select to authenticated using (
  submitted_by = auth.uid() or assigned_reviewer_id = auth.uid() or current_user_has('course.review.any'));
create policy reviews_read on course_reviews for select to authenticated using (
  reviewer_id = auth.uid() or current_user_has('course.review.any')
  or exists (select 1 from course_submissions s where s.id = submission_id and s.submitted_by = auth.uid()));
create policy review_comments_read on review_comments for select to authenticated using (
  author_id = auth.uid() or current_user_has('course.review.any')
  or exists (select 1 from course_submissions s where s.id = submission_id and (s.submitted_by = auth.uid() or s.assigned_reviewer_id = auth.uid())));
create policy pubevents_read on publication_events for select to authenticated using (current_user_has('course.read.any') or is_course_instructor(auth.uid(), course_id));
create policy audit_read on audit_logs for select to authenticated using (current_user_has('audit.read'));
-- review_comments insert is performed through the server (service role) after authorization checks.

-- ---------- learning ----------
create policy enroll_self on enrollments for select to authenticated using (learner_id = auth.uid());
create policy enroll_instructor on enrollments for select to authenticated using (is_course_instructor(auth.uid(), course_id));
create policy enroll_admin on enrollments for select to authenticated using (current_user_has('enrollment.read.any'));
create policy enroll_org on enrollments for select to authenticated using (
  exists (select 1 from cohorts c where c.id = enrollments.cohort_id and is_org_manager(auth.uid(), c.organization_id)));
create policy progress_self on lesson_progress for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy progress_instructor on lesson_progress for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
create policy completions_self on course_completions for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy completions_staff on course_completions for select to authenticated using (current_user_has('report.read') or exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
create policy attempts_self on quiz_attempts for select to authenticated using (learner_id = auth.uid());
create policy attempts_instructor on quiz_attempts for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
-- Responses carry is_correct; only expose after the quiz policy allows it (server action filters) -> instructor/self read of own graded attempts
create policy responses_self on quiz_responses for select to authenticated using (exists (select 1 from quiz_attempts a join quizzes q on q.id = a.quiz_id where a.id = attempt_id and a.learner_id = auth.uid() and a.status = 'submitted' and q.show_results = 'immediate'));
create policy responses_instructor on quiz_responses for select to authenticated using (exists (select 1 from quiz_attempts a join enrollments e on e.id = a.enrollment_id where a.id = attempt_id and is_course_instructor(auth.uid(), e.course_id)));

create policy submissions_self on submissions for select to authenticated using (learner_id = auth.uid());
create policy submissions_instructor on submissions for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
create policy submissions_insert on submissions for insert to authenticated with check (learner_id = auth.uid() and exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid() and has_course_access(auth.uid(), e.course_id)));
create policy grades_self on grades for select to authenticated using (exists (select 1 from submissions s where s.id = submission_id and s.learner_id = auth.uid()));
create policy grades_instructor on grades for select to authenticated using (exists (select 1 from submissions s join enrollments e on e.id = s.enrollment_id where s.id = submission_id and is_course_instructor(auth.uid(), e.course_id)));
create policy evals_self on course_evaluations for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy evals_insert on course_evaluations for insert to authenticated with check (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid() and e.status = 'completed'));

create policy certs_self on certificates for select to authenticated using (learner_id = auth.uid());
create policy certs_staff on certificates for select to authenticated using (current_user_has('certificate.read.any'));
create policy orders_self on orders for select to authenticated using (learner_id = auth.uid());
create policy orders_finance on orders for select to authenticated using (current_user_has('finance.read'));
create policy entitlements_self on entitlements for select to authenticated using (user_id = auth.uid());

-- ---------- organizations ----------
create policy cohorts_member on cohorts for select to authenticated using (
  is_org_manager(auth.uid(), organization_id) or current_user_has('org.read.any')
  or exists (select 1 from cohort_memberships cm where cm.cohort_id = cohorts.id and cm.user_id = auth.uid()));
create policy cohort_members_read on cohort_memberships for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from cohorts c where c.id = cohort_id and is_org_manager(auth.uid(), c.organization_id)));
create policy cohort_assign_read on cohort_course_assignments for select to authenticated using (
  exists (select 1 from cohorts c where c.id = cohort_id and (is_org_manager(auth.uid(), c.organization_id)
     or exists (select 1 from cohort_memberships cm where cm.cohort_id = c.id and cm.user_id = auth.uid()))));

-- ---------- operations ----------
create policy notifications_self on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated; grant update (read_at) on notifications to authenticated;
create policy notif_prefs_self on notification_preferences for select to authenticated using (user_id = auth.uid());
create policy notif_prefs_update on notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tickets_self on support_tickets for select to authenticated using (requester_id = auth.uid());
create policy tickets_agent on support_tickets for select to authenticated using (current_user_has('support.read'));
create policy tickets_insert on support_tickets for insert to authenticated with check (requester_id = auth.uid());
create policy tmsg_read on support_messages for select to authenticated using (
  (not internal and exists (select 1 from support_tickets t where t.id = ticket_id and t.requester_id = auth.uid())) or current_user_has('support.read'));
create policy tmsg_insert on support_messages for insert to authenticated with check (author_id = auth.uid() and not internal
  and exists (select 1 from support_tickets t where t.id = ticket_id and t.requester_id = auth.uid()));
create policy export_self on data_export_requests for select to authenticated using (user_id = auth.uid());
create policy export_insert on data_export_requests for insert to authenticated with check (user_id = auth.uid() and status = 'requested');
create policy jobs_admin on jobs for select to authenticated using (current_user_has('ops.read'));
create policy settings_admin on settings for select to authenticated using (current_user_has('settings.read'));

-- =====================================================================
-- STORAGE: public thumbnails, private everything else (signed URLs only)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('course-public',   'course-public',   true,  5242880,  array['image/png','image/jpeg','image/webp']),
  ('course-private',  'course-private',  false, 104857600, array['application/pdf','image/png','image/jpeg','video/mp4','text/plain','application/zip']),
  ('assignments',     'assignments',     false, 10485760, array['application/pdf','image/png','image/jpeg','text/plain']),
  ('certificates',    'certificates',    false, 2097152,  array['application/pdf']),
  ('admin-docs',      'admin-docs',      false, 20971520, array['application/pdf','text/csv'])
on conflict (id) do nothing;

-- Paths: {course_id}/... for course buckets, {learner_id}/... for assignments
create policy "public thumbnails read" on storage.objects for select using (bucket_id = 'course-public');
create policy "authors upload thumbnails" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-public' and is_course_instructor(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "authors manage private materials" on storage.objects for all to authenticated
  using (bucket_id = 'course-private' and is_course_instructor(auth.uid(), ((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'course-private' and is_course_instructor(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "learners upload own assignments" on storage.objects for insert to authenticated
  with check (bucket_id = 'assignments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "learners read own assignments" on storage.objects for select to authenticated
  using (bucket_id = 'assignments' and (storage.foldername(name))[1] = auth.uid()::text);
-- Reads of private course files and instructor access to submissions are done by the server via short-lived
-- signed URLs AFTER app-level authorization (see src/services/storage.ts). No broad browser read policy exists.
