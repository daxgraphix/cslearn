-- Make approved courses discoverable immediately when the reviewer can also
-- publish. If they cannot publish, the version stays approved for a publisher.
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
  if p_decision = 'approved' and has_permission(uid, 'course.publish') then
    perform publish_version(v.id);
  end if;
  perform write_audit(uid, 'course.review_' || p_decision::text, 'course_version', v.id::text,
    jsonb_build_object('review_id', rid));
  if s.submitted_by is not null then
    insert into notifications(user_id, kind, title, body, href)
      values (s.submitted_by, 'review', 'Review: ' || p_decision::text,
        left(coalesce(p_summary,''), 280), '/instructor/courses/' || v.course_id || '/builder');
  end if;
  return rid;
end $$;

revoke all on function review_submission(uuid, review_decision, text) from public, anon;
grant execute on function review_submission(uuid, review_decision, text) to authenticated;
