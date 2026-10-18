-- Account deletion policy:
-- * Remove account-owned access, learning progress, certificates, and inbox data.
-- * Keep shared course content, reviews, support history, settings, and financial
--   records, while clearing their references to the deleted profile.
-- Apply account deletion through Supabase Auth Admin API so auth.users and the
-- cascading profiles row are removed in one operation.

alter table user_roles
  drop constraint user_roles_granted_by_fkey,
  add constraint user_roles_granted_by_fkey foreign key (granted_by)
    references profiles(id) on delete set null;

alter table courses alter column owner_id drop not null;
alter table courses
  drop constraint courses_owner_id_fkey,
  add constraint courses_owner_id_fkey foreign key (owner_id)
    references profiles(id) on delete set null;

alter table course_versions alter column created_by drop not null;
alter table course_versions
  drop constraint course_versions_created_by_fkey,
  add constraint course_versions_created_by_fkey foreign key (created_by)
    references profiles(id) on delete set null;

alter table learning_paths
  drop constraint learning_paths_created_by_fkey,
  add constraint learning_paths_created_by_fkey foreign key (created_by)
    references profiles(id) on delete set null;

alter table course_submissions
  alter column submitted_by drop not null,
  drop constraint course_submissions_submitted_by_fkey,
  add constraint course_submissions_submitted_by_fkey foreign key (submitted_by)
    references profiles(id) on delete set null,
  drop constraint course_submissions_assigned_reviewer_id_fkey,
  add constraint course_submissions_assigned_reviewer_id_fkey foreign key (assigned_reviewer_id)
    references profiles(id) on delete set null;

alter table course_reviews
  alter column reviewer_id drop not null,
  drop constraint course_reviews_reviewer_id_fkey,
  add constraint course_reviews_reviewer_id_fkey foreign key (reviewer_id)
    references profiles(id) on delete set null;

alter table review_comments
  alter column author_id drop not null,
  drop constraint review_comments_author_id_fkey,
  add constraint review_comments_author_id_fkey foreign key (author_id)
    references profiles(id) on delete set null;

alter table publication_events
  drop constraint publication_events_actor_id_fkey,
  add constraint publication_events_actor_id_fkey foreign key (actor_id)
    references profiles(id) on delete set null;

alter table cohorts
  drop constraint cohorts_created_by_fkey,
  add constraint cohorts_created_by_fkey foreign key (created_by)
    references profiles(id) on delete set null;

alter table cohort_course_assignments
  drop constraint cohort_course_assignments_assigned_by_fkey,
  add constraint cohort_course_assignments_assigned_by_fkey foreign key (assigned_by)
    references profiles(id) on delete set null;

alter table grades
  alter column grader_id drop not null,
  drop constraint grades_grader_id_fkey,
  add constraint grades_grader_id_fkey foreign key (grader_id)
    references profiles(id) on delete set null;

alter table grade_events
  alter column actor_id drop not null,
  drop constraint grade_events_actor_id_fkey,
  add constraint grade_events_actor_id_fkey foreign key (actor_id)
    references profiles(id) on delete set null;

alter table certificates
  drop constraint certificates_enrollment_id_fkey,
  add constraint certificates_enrollment_id_fkey foreign key (enrollment_id)
    references enrollments(id) on delete cascade,
  drop constraint certificates_learner_id_fkey,
  add constraint certificates_learner_id_fkey foreign key (learner_id)
    references profiles(id) on delete cascade;

alter table orders alter column learner_id drop not null;
alter table orders
  drop constraint orders_learner_id_fkey,
  add constraint orders_learner_id_fkey foreign key (learner_id)
    references profiles(id) on delete set null;

alter table refunds
  drop constraint refunds_requested_by_fkey,
  add constraint refunds_requested_by_fkey foreign key (requested_by)
    references profiles(id) on delete set null,
  drop constraint refunds_approved_by_fkey,
  add constraint refunds_approved_by_fkey foreign key (approved_by)
    references profiles(id) on delete set null;

alter table subscriptions
  drop constraint subscriptions_user_id_fkey,
  add constraint subscriptions_user_id_fkey foreign key (user_id)
    references profiles(id) on delete cascade;

alter table support_tickets
  drop constraint support_tickets_assignee_id_fkey,
  add constraint support_tickets_assignee_id_fkey foreign key (assignee_id)
    references profiles(id) on delete set null;

alter table support_messages
  alter column author_id drop not null,
  drop constraint support_messages_author_id_fkey,
  add constraint support_messages_author_id_fkey foreign key (author_id)
    references profiles(id) on delete set null;

alter table settings
  drop constraint settings_updated_by_fkey,
  add constraint settings_updated_by_fkey foreign key (updated_by)
    references profiles(id) on delete set null;

create or replace function review_submission(p_submission uuid, p_decision review_decision, p_summary text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s course_submissions%rowtype; v course_versions%rowtype; rid uuid;
begin
  select * into s from course_submissions where id = p_submission for update;
  if not found or s.status = 'closed' then raise exception 'submission not open'; end if;
  select * into v from course_versions where id = s.version_id for update;
  if not has_permission(uid, 'course.review.assigned') and not has_permission(uid, 'course.review.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if has_permission(uid, 'course.review.assigned') and not has_permission(uid, 'course.review.any')
     and s.assigned_reviewer_id is distinct from uid then
    raise exception 'not assigned to this review' using errcode = '42501';
  end if;
  if s.submitted_by = uid or is_course_instructor(uid, v.course_id) then
    raise exception 'authors cannot review their own course' using errcode = '42501';
  end if;
  insert into course_reviews(submission_id, reviewer_id, decision, summary)
    values (p_submission, uid, p_decision, p_summary) returning id into rid;
  update course_submissions set status = 'closed', closed_at = now() where id = p_submission;
  update course_versions set
    status = case p_decision when 'approved' then 'approved'::version_status else 'changes_requested'::version_status end,
    approved_at = case when p_decision = 'approved' then now() else null end
  where id = v.id;
  perform write_audit(uid, 'course.review_' || p_decision::text, 'course_version', v.id::text,
    jsonb_build_object('review_id', rid));
  if s.submitted_by is not null then
    insert into notifications(user_id, kind, title, body, href)
      values (s.submitted_by, 'review', 'Review: ' || p_decision::text,
        left(coalesce(p_summary,''), 280), '/instructor/courses/' || v.course_id || '/builder');
  end if;
  return rid;
end $$;
