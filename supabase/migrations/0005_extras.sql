-- 0005 Extras: ordering, organization operations, bulk enrollment, reporting views

create or replace function swap_positions(p_table text, p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare vid uuid; pa int; pb int;
begin
  if p_table = 'modules' then
    select version_id, position into vid, pa from modules where id = p_a;
    select position into pb from modules where id = p_b and version_id = vid;
  elsif p_table = 'lessons' then
    select module_version(module_id), position into vid, pa from lessons where id = p_a;
    select position into pb from lessons where id = p_b and module_id = (select module_id from lessons where id = p_a);
  else raise exception 'invalid table'; end if;
  if pb is null or not version_is_editable(vid) then raise exception 'forbidden' using errcode = '42501'; end if;
  set constraints all deferred;
  if p_table = 'modules' then
    update modules set position = pb where id = p_a; update modules set position = pa where id = p_b;
  else
    update lessons set position = pb where id = p_a; update lessons set position = pa where id = p_b;
  end if;
end $$;

-- Organization manager: create cohort, add members, assign approved (published) courses.
create or replace function org_assign_course(p_cohort uuid, p_course uuid, p_due date default null) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); org uuid; c courses%rowtype; n int := 0; m record; vid uuid;
begin
  select organization_id into org from cohorts where id = p_cohort;
  if org is null or not is_org_manager(uid, org) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from courses where id = p_course;
  if c.published_version_id is null or c.archived_at is not null then raise exception 'course is not approved for assignment'; end if;
  if c.organization_id is not null and c.organization_id <> org then raise exception 'course belongs to another organization' using errcode = '42501'; end if;
  insert into cohort_course_assignments(cohort_id, course_id, due_on, assigned_by) values (p_cohort, p_course, p_due, uid)
    on conflict (cohort_id, course_id) do update set due_on = excluded.due_on;
  vid := c.published_version_id;
  for m in select cm.user_id from cohort_memberships cm join profiles p on p.id = cm.user_id and p.status = 'active' where cm.cohort_id = p_cohort loop
    insert into enrollments(learner_id, course_id, version_id, source, cohort_id) values (m.user_id, p_course, vid, 'cohort', p_cohort)
      on conflict (learner_id, course_id) do nothing;
    n := n + 1;
  end loop;
  perform write_audit(uid, 'org.course_assigned', 'cohort', p_cohort::text, jsonb_build_object('course_id', p_course, 'learners', n), org);
  return n;
end $$;

create or replace function org_add_member(p_org uuid, p_email text, p_cohort uuid default null, p_type text default 'learner') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid;
begin
  if not is_org_manager(uid, p_org) then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into target from auth.users where lower(email) = lower(p_email);
  if target is null then raise exception 'No account with that email. Ask the person to register first.'; end if;
  if p_type = 'manager' then raise exception 'only platform admins can add managers' using errcode = '42501'; end if;
  insert into organization_memberships(organization_id, user_id, member_type) values (p_org, target, p_type)
    on conflict (organization_id, user_id) do update set status = 'active';
  if p_cohort is not null then
    if not exists (select 1 from cohorts where id = p_cohort and organization_id = p_org) then raise exception 'cohort is in another organization' using errcode = '42501'; end if;
    insert into cohort_memberships(cohort_id, user_id) values (p_cohort, target) on conflict do nothing;
  end if;
  return target;
end $$;

create or replace function org_create_cohort(p_org uuid, p_name text, p_starts date default null, p_ends date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if not is_org_manager(uid, p_org) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into cohorts(organization_id, name, starts_on, ends_on, created_by) values (p_org, p_name, p_starts, p_ends, uid) returning id into cid;
  return cid;
end $$;

-- Organization-scoped completion report (never crosses tenants)
create or replace function org_completion_report(p_org uuid)
returns table(cohort text, course_title text, learners bigint, completed bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_org_manager(auth.uid(), p_org) or has_permission(auth.uid(), 'org.read.any')) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select c.name, v.title, count(e.id), count(e.id) filter (where e.status = 'completed')
  from cohorts c join enrollments e on e.cohort_id = c.id
  join course_versions v on v.id = e.version_id
  where c.organization_id = p_org group by c.name, v.title order by c.name, v.title;
end $$;

-- Platform reports (admins)
create or replace function platform_overview()
returns table(users bigint, learners_30d bigint, published_courses bigint, enrollments bigint, completions bigint, certificates bigint, open_reviews bigint, dead_jobs bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission(auth.uid(), 'report.read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select
    (select count(*) from profiles),
    (select count(distinct learner_id) from enrollments where enrolled_at > now() - interval '30 days'),
    (select count(*) from courses where published_version_id is not null and archived_at is null),
    (select count(*) from enrollments),
    (select count(*) from course_completions),
    (select count(*) from certificates where status = 'valid'),
    (select count(*) from course_submissions where status <> 'closed'),
    (select count(*) from jobs where status = 'dead');
end $$;

-- Scheduled publication hook (call from cron via the job runner)
create or replace function release_scheduled_versions() returns int
language plpgsql security definer set search_path = public as $$
declare v record; n int := 0; old uuid;
begin
  for v in select * from course_versions where status = 'approved' and scheduled_publish_at <= now() for update skip locked loop
    select published_version_id into old from courses where id = v.course_id;
    if old is not null then update course_versions set status = 'archived' where id = old; end if;
    update course_versions set status = 'published', published_at = now() where id = v.id;
    update courses set published_version_id = v.id where id = v.course_id;
    insert into publication_events(course_id, version_id, action) values (v.course_id, v.id, 'published');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function release_scheduled_versions() from public, anon, authenticated;

create or replace function user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1; $$;
revoke execute on function user_id_by_email(text) from public, anon, authenticated;
