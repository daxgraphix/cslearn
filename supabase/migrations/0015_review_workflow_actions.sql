-- Race-safe review actions exposed as permission-checked RPCs. These avoid
-- direct service-role table writes for routine reviewer operations.

create or replace function claim_course_review(p_submission uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s course_submissions%rowtype; v course_versions%rowtype;
begin
  if not has_permission(uid, 'course.review.assigned') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into s from course_submissions where id = p_submission for update;
  if not found or s.status = 'closed' then raise exception 'This review is no longer open.'; end if;
  if s.assigned_reviewer_id is not null then raise exception 'This review has already been assigned.'; end if;
  if s.submitted_by = uid then raise exception 'You cannot review a course you submitted.'; end if;
  select * into v from course_versions where id = s.version_id;
  if not found then raise exception 'This course version could not be found.'; end if;
  if is_course_instructor(uid, v.course_id) then raise exception 'You cannot review a course you authored.'; end if;
  update course_submissions set assigned_reviewer_id = uid, status = 'in_review' where id = p_submission;
  perform write_audit(uid, 'course.review_claimed', 'course_submission', p_submission::text,
    jsonb_build_object('course_id', v.course_id));
  return p_submission;
end $$;

create or replace function assign_course_reviewer(p_submission uuid, p_reviewer uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s course_submissions%rowtype; v course_versions%rowtype;
begin
  if not has_permission(uid, 'course.review.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not has_permission(p_reviewer, 'course.review.assigned') then
    raise exception 'Choose an active account with reviewer access.';
  end if;
  select * into s from course_submissions where id = p_submission for update;
  if not found or s.status = 'closed' then raise exception 'This review is no longer open.'; end if;
  if s.submitted_by = p_reviewer then raise exception 'The course author cannot review their own submission.'; end if;
  select * into v from course_versions where id = s.version_id;
  if not found then raise exception 'This course version could not be found.'; end if;
  if is_course_instructor(p_reviewer, v.course_id) then
    raise exception 'Choose a reviewer who is not on the course team.';
  end if;
  update course_submissions set assigned_reviewer_id = p_reviewer, status = 'in_review'
    where id = p_submission;
  perform write_audit(uid, 'course.review_assigned', 'course_submission', p_submission::text,
    jsonb_build_object('reviewer_id', p_reviewer, 'course_id', v.course_id));
end $$;

create or replace function add_course_review_comment(p_submission uuid, p_lesson uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s course_submissions%rowtype; v course_versions%rowtype; comment_id uuid; content text;
begin
  if not has_permission(uid, 'course.review.assigned') and not has_permission(uid, 'course.review.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  content := btrim(coalesce(p_body, ''));
  if length(content) < 1 or length(content) > 4000 then
    raise exception 'Comments must contain between 1 and 4000 characters.';
  end if;
  select * into s from course_submissions where id = p_submission for update;
  if not found or s.status = 'closed' then raise exception 'This review is no longer open.'; end if;
  if has_permission(uid, 'course.review.assigned') and not has_permission(uid, 'course.review.any')
     and s.assigned_reviewer_id is distinct from uid then
    raise exception 'Claim or receive this review before commenting.' using errcode = '42501';
  end if;
  if s.submitted_by = uid then raise exception 'You cannot review your own submission.' using errcode = '42501'; end if;
  select * into v from course_versions where id = s.version_id;
  if not found then raise exception 'This course version could not be found.'; end if;
  if is_course_instructor(uid, v.course_id) then raise exception 'Course authors cannot review their own course.' using errcode = '42501'; end if;
  if p_lesson is not null and not exists (
    select 1 from lessons l join modules m on m.id = l.module_id
    where l.id = p_lesson and m.version_id = s.version_id
  ) then raise exception 'Choose a lesson from this course version.'; end if;
  insert into review_comments(submission_id, lesson_id, author_id, body)
    values (p_submission, p_lesson, uid, content) returning id into comment_id;
  perform write_audit(uid, 'course.review_comment_added', 'course_submission', p_submission::text,
    jsonb_build_object('comment_id', comment_id, 'lesson_id', p_lesson));
  return comment_id;
end $$;

revoke all on function claim_course_review(uuid) from public, anon;
grant execute on function claim_course_review(uuid) to authenticated;
revoke all on function assign_course_reviewer(uuid,uuid) from public, anon;
grant execute on function assign_course_reviewer(uuid,uuid) to authenticated;
revoke all on function add_course_review_comment(uuid,uuid,text) from public, anon;
grant execute on function add_course_review_comment(uuid,uuid,text) to authenticated;
