-- Reviewers need to read unpublished course content for submissions in their
-- active queue, including when they have review.any but not course.read.any.
create or replace function version_is_readable(vid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from course_versions v join courses c on c.id = v.course_id
    where v.id = vid and (
      c.published_version_id = v.id
      or is_course_instructor(auth.uid(), v.course_id)
      or has_permission(auth.uid(), 'course.read.any')
      or exists (select 1 from enrollments e where e.version_id = v.id and e.learner_id = auth.uid() and e.status in ('active','completed'))
      or exists (
        select 1 from course_submissions s
        where s.version_id = v.id and s.status <> 'closed'
          and (s.assigned_reviewer_id = auth.uid() or has_permission(auth.uid(), 'course.review.any'))
      )
    )
  );
$$;

drop policy if exists courses_team_read on courses;
create policy courses_team_read on courses for select to authenticated using (
  is_course_instructor(auth.uid(), id)
  or current_user_has('course.read.any')
  or (organization_id is not null and exists (
    select 1 from organization_memberships m
    where m.organization_id = courses.organization_id and m.user_id = auth.uid() and m.status = 'active'
  ))
  or exists (
    select 1 from course_versions v join course_submissions s on s.version_id = v.id
    where v.course_id = courses.id and s.status <> 'closed'
      and (s.assigned_reviewer_id = auth.uid() or current_user_has('course.review.any'))
  )
);

drop policy if exists cv_team_read on course_versions;
create policy cv_team_read on course_versions for select to authenticated using (
  is_course_instructor(auth.uid(), course_id)
  or current_user_has('course.read.any')
  or exists (
    select 1 from course_submissions s
    where s.version_id = course_versions.id and s.status <> 'closed'
      and (s.assigned_reviewer_id = auth.uid() or current_user_has('course.review.any'))
  )
);
