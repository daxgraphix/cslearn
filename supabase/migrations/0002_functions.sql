-- =====================================================================
-- 0002 Functions: authorization helpers and transactional business rules
-- =====================================================================

-- ---------- authorization ----------
create or replace function is_active_user(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and status = 'active');
$$;

-- has_permission: explicit denial > role grant. Optionally scoped to an organization.
create or replace function has_permission(uid uuid, perm text, org uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_active_user(uid)
    and not exists (select 1 from permission_denials d where d.user_id = uid and d.permission_key = perm)
    and exists (
      select 1
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = uid
        and rp.permission_key = perm
        and (ur.organization_id is null or ur.organization_id = org)
    );
$$;

create or replace function current_user_has(perm text, org uuid default null) returns boolean
language sql stable as $$ select has_permission(auth.uid(), perm, org); $$;

create or replace function is_course_instructor(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_instructors where course_id = cid and user_id = uid)
      or exists (select 1 from courses where id = cid and owner_id = uid);
$$;

create or replace function is_org_manager(uid uuid, org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_user(uid) and exists (
    select 1 from organization_memberships m
    where m.organization_id = org and m.user_id = uid and m.member_type = 'manager' and m.status = 'active'
  );
$$;

-- Active enrollment (and not expired/suspended) for a given course version content
create or replace function has_course_access(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_user(uid) and exists (
    select 1 from enrollments e
    where e.learner_id = uid and e.course_id = cid
      and e.status in ('active','completed')
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ---------- audit ----------
create or replace function write_audit(p_actor uuid, p_action text, p_type text, p_id text, p_meta jsonb default '{}', p_org uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs(actor_id, action, entity_type, entity_id, organization_id, metadata)
  values (p_actor, p_action, p_type, p_id, p_org, coalesce(p_meta,'{}'::jsonb));
$$;

create or replace function trg_audit_user_roles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(auth.uid(), 'role.granted', 'user_role', new.user_id::text,
      jsonb_build_object('role_id', new.role_id, 'organization_id', new.organization_id));
    return new;
  else
    perform write_audit(auth.uid(), 'role.revoked', 'user_role', old.user_id::text,
      jsonb_build_object('role_id', old.role_id, 'organization_id', old.organization_id));
    return old;
  end if;
end $$;
create trigger trg_user_roles_audit after insert or delete on user_roles
  for each row execute function trg_audit_user_roles();

-- Block updates/deletes on audit rows for everybody except the table owner's migrations.
create or replace function trg_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_logs is append-only'; end $$;
create trigger trg_audit_no_update before update or delete on audit_logs
  for each row execute function trg_audit_immutable();

-- ---------- new user bootstrap ----------
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare learner uuid;
begin
  insert into profiles(id, full_name, locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
          case when new.raw_user_meta_data->>'locale' in ('en','sw') then new.raw_user_meta_data->>'locale' else 'en' end);
  select id into learner from roles where key = 'learner';
  if learner is not null then insert into user_roles(user_id, role_id) values (new.id, learner); end if;
  insert into notification_preferences(user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- course authoring and governance ----------
-- Create a new course with its first draft (v1)
create or replace function create_course(p_title text, p_slug text, p_category uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; vid uuid;
begin
  if not has_permission(uid, 'course.create') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into courses(slug, category_id, owner_id) values (p_slug, p_category, uid) returning id into cid;
  insert into course_versions(course_id, version_number, title, created_by) values (cid, 1, p_title, uid) returning id into vid;
  insert into course_instructors(course_id, user_id, role) values (cid, uid, 'lead');
  perform write_audit(uid, 'course.created', 'course', cid::text, jsonb_build_object('slug', p_slug));
  return cid;
end $$;

-- Clone the published version into a new draft revision (never edits the published one)
create or replace function create_draft_revision(p_course uuid, p_summary text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); src uuid; nv uuid; n int; m record; nm uuid; l record; nl uuid;
begin
  if not (is_course_instructor(uid, p_course) and has_permission(uid, 'course.update.own')) and not has_permission(uid, 'course.update.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from course_versions where course_id = p_course and status in ('draft','in_review','changes_requested','approved')) then
    raise exception 'an open revision already exists';
  end if;
  select published_version_id into src from courses where id = p_course;
  if src is null then raise exception 'course has no published version'; end if;
  select coalesce(max(version_number),0)+1 into n from course_versions where course_id = p_course;

  insert into course_versions(course_id, version_number, status, title, subtitle, description, objectives, prerequisites,
      thumbnail_path, promo_video_url, language, level, estimated_minutes, accessibility_notes, enrollment_policy,
      price_cents, currency, pass_mark, certificate_enabled, seo_title, seo_description, change_summary, created_by)
  select course_id, n, 'draft', title, subtitle, description, objectives, prerequisites,
      thumbnail_path, promo_video_url, language, level, estimated_minutes, accessibility_notes, enrollment_policy,
      price_cents, currency, pass_mark, certificate_enabled, seo_title, seo_description, p_summary, uid
  from course_versions where id = src returning id into nv;

  for m in select * from modules where version_id = src order by position loop
    insert into modules(version_id, position, title, description) values (nv, m.position, m.title, m.description) returning id into nm;
    for l in select * from lessons where module_id = m.id order by position loop
      insert into lessons(module_id, position, type, title, body, duration_minutes, is_required, completion_rule)
      values (nm, l.position, l.type, l.title, l.body, l.duration_minutes, l.is_required, l.completion_rule) returning id into nl;
      insert into lesson_resources(lesson_id, title, kind, storage_path, url, mime_type, size_bytes)
        select nl, title, kind, storage_path, url, mime_type, size_bytes from lesson_resources where lesson_id = l.id;
      insert into quizzes(lesson_id, instructions, pass_mark, max_attempts, time_limit_seconds, shuffle_questions, show_results)
        select nl, instructions, pass_mark, max_attempts, time_limit_seconds, shuffle_questions, show_results from quizzes where lesson_id = l.id;
      insert into assignments(lesson_id, instructions, max_points, due_offset_days, allowed_mime_types, max_file_bytes)
        select nl, instructions, max_points, due_offset_days, allowed_mime_types, max_file_bytes from assignments where lesson_id = l.id;
      perform clone_quiz_questions(l.id, nl);
    end loop;
  end loop;
  perform write_audit(uid, 'course.revision_created', 'course_version', nv::text, jsonb_build_object('course_id', p_course, 'from', src));
  return nv;
end $$;

create or replace function clone_quiz_questions(p_old_lesson uuid, p_new_lesson uuid) returns void
language plpgsql security definer set search_path = public as $$
declare oq uuid; nq uuid; q record; o record; no uuid;
begin
  select id into oq from quizzes where lesson_id = p_old_lesson;
  select id into nq from quizzes where lesson_id = p_new_lesson;
  if oq is null or nq is null then return; end if;
  for q in select * from questions where quiz_id = oq order by position loop
    declare nqq uuid; begin
      insert into questions(quiz_id, position, type, prompt, points, explanation)
        values (nq, q.position, q.type, q.prompt, q.points, q.explanation) returning id into nqq;
      for o in select * from answer_options where question_id = q.id order by position loop
        insert into answer_options(question_id, position, label) values (nqq, o.position, o.label) returning id into no;
        insert into answer_keys(option_id, is_correct) select no, is_correct from answer_keys where option_id = o.id;
      end loop;
      insert into short_answer_keys(question_id, accepted) select nqq, accepted from short_answer_keys where question_id = q.id;
    end;
  end loop;
end $$;

-- Validation used before submission (no incomplete versions reach review)
create or replace function validate_version(p_version uuid) returns table(code text, message text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query select 'title'::text, 'Title is required'::text from course_versions where id = p_version and length(trim(title)) = 0;
  return query select 'description', 'Description is required' from course_versions where id = p_version and coalesce(length(trim(description)),0) = 0;
  return query select 'objectives', 'Add at least one learning objective' from course_versions where id = p_version and cardinality(objectives) = 0;
  return query select 'modules', 'Add at least one module' where not exists (select 1 from modules where version_id = p_version);
  return query select 'empty_module', 'Module "' || m.title || '" has no lessons'
    from modules m where m.version_id = p_version and not exists (select 1 from lessons l where l.module_id = m.id);
  return query select 'quiz_empty', 'Quiz "' || l.title || '" has no questions'
    from lessons l join modules m on m.id = l.module_id
    where m.version_id = p_version and l.type = 'quiz'
      and not exists (select 1 from quizzes q join questions qq on qq.quiz_id = q.id where q.lesson_id = l.id);
  return query select 'quiz_key', 'A question in "' || l.title || '" has no correct answer'
    from lessons l join modules m on m.id = l.module_id
    join quizzes q on q.lesson_id = l.id join questions qq on qq.quiz_id = q.id
    where m.version_id = p_version and qq.type in ('single','multiple','true_false')
      and not exists (select 1 from answer_options ao join answer_keys ak on ak.option_id = ao.id where ao.question_id = qq.id and ak.is_correct);
end $$;

create or replace function submit_version(p_version uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v course_versions%rowtype; sid uuid;
begin
  select * into v from course_versions where id = p_version for update;
  if not found then raise exception 'not found'; end if;
  if not is_course_instructor(uid, v.course_id) or not has_permission(uid, 'course.submit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status not in ('draft','changes_requested') then raise exception 'version is not editable (status %)', v.status; end if;
  if exists (select 1 from validate_version(p_version)) then raise exception 'version failed validation'; end if;
  update course_versions set status = 'in_review', submitted_at = now() where id = p_version;
  insert into course_submissions(version_id, submitted_by, note) values (p_version, uid, p_note) returning id into sid;
  perform write_audit(uid, 'course.submitted', 'course_version', p_version::text, jsonb_build_object('submission_id', sid));
  return sid;
end $$;

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
  -- no self-approval, ever
  if s.submitted_by = uid or is_course_instructor(uid, v.course_id) then
    raise exception 'authors cannot review their own course' using errcode = '42501';
  end if;
  insert into course_reviews(submission_id, reviewer_id, decision, summary) values (p_submission, uid, p_decision, p_summary) returning id into rid;
  update course_submissions set status = 'closed', closed_at = now() where id = p_submission;
  update course_versions set
    status = case p_decision when 'approved' then 'approved'::version_status else 'changes_requested'::version_status end,
    approved_at = case when p_decision = 'approved' then now() else null end
  where id = v.id;
  perform write_audit(uid, 'course.review_' || p_decision::text, 'course_version', v.id::text, jsonb_build_object('review_id', rid));
  insert into notifications(user_id, kind, title, body, href)
    values (s.submitted_by, 'review', 'Review: ' || p_decision::text, left(coalesce(p_summary,''), 280), '/instructor/courses/' || v.course_id || '/builder');
  return rid;
end $$;

create or replace function publish_version(p_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v course_versions%rowtype; old uuid;
begin
  select * into v from course_versions where id = p_version for update;
  if not found then raise exception 'not found'; end if;
  if not has_permission(uid, 'course.publish') then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status <> 'approved' then raise exception 'only approved versions can be published'; end if;
  if v.created_by = uid and not has_permission(uid, 'course.publish.own_override') then
    raise exception 'authors cannot publish their own revision' using errcode = '42501';
  end if;
  select published_version_id into old from courses where id = v.course_id for update;
  if old is not null then update course_versions set status = 'archived' where id = old; end if;
  update course_versions set status = 'published', published_at = now() where id = p_version;
  update courses set published_version_id = p_version, archived_at = null where id = v.course_id;
  insert into publication_events(course_id, version_id, action, actor_id) values (v.course_id, p_version, 'published', uid);
  perform write_audit(uid, 'course.published', 'course_version', p_version::text, jsonb_build_object('course_id', v.course_id, 'replaced', old));
end $$;

create or replace function unpublish_course(p_course uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v uuid;
begin
  if not has_permission(uid, 'course.unpublish') then raise exception 'forbidden' using errcode = '42501'; end if;
  select published_version_id into v from courses where id = p_course for update;
  update courses set archived_at = now() where id = p_course;   -- retire: no new enrollments, existing kept
  if v is not null then insert into publication_events(course_id, version_id, action, actor_id) values (p_course, v, 'archived', uid); end if;
  perform write_audit(uid, 'course.retired', 'course', p_course::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------- enrollment ----------
create or replace function enroll_self(p_course uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c courses%rowtype; v course_versions%rowtype; eid uuid;
begin
  if not is_active_user(uid) then raise exception 'account not active' using errcode = '42501'; end if;
  select * into c from courses where id = p_course;
  if not found or c.published_version_id is null or c.archived_at is not null then raise exception 'course unavailable'; end if;
  select * into v from course_versions where id = c.published_version_id;
  if v.available_from is not null and v.available_from > now() then raise exception 'course not yet available'; end if;
  if v.available_until is not null and v.available_until < now() then raise exception 'course no longer available'; end if;
  if c.visibility = 'organization' and not exists (
       select 1 from organization_memberships m where m.organization_id = c.organization_id and m.user_id = uid and m.status = 'active')
  then raise exception 'organization members only' using errcode = '42501'; end if;
  if v.enrollment_policy in ('invite_only','approval') then raise exception 'enrollment requires approval or invitation'; end if;
  if v.enrollment_policy = 'paid' or v.price_cents > 0 then
    if not exists (select 1 from entitlements e where e.user_id = uid and e.course_id = p_course and e.revoked_at is null
                   and (e.expires_at is null or e.expires_at > now())) then
      raise exception 'payment required' using errcode = '42501';
    end if;
  end if;
  insert into enrollments(learner_id, course_id, version_id, source)
  values (uid, p_course, v.id, case when v.price_cents > 0 then 'paid' else 'self' end)
  on conflict (learner_id, course_id) do update set status = 'active'
    where enrollments.status in ('cancelled','expired')
  returning id into eid;
  if eid is null then select id into eid from enrollments where learner_id = uid and course_id = p_course; end if;
  return eid;   -- idempotent: repeated calls return the same enrollment
end $$;

-- ---------- progress and completion ----------
create or replace function complete_lesson(p_enrollment uuid, p_lesson uuid, p_percent int default 100) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e enrollments%rowtype; l lessons%rowtype; rule text; ok boolean := true;
begin
  select * into e from enrollments where id = p_enrollment;
  if not found or e.learner_id <> uid or not has_course_access(uid, e.course_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select l2.* into l from lessons l2 join modules m on m.id = l2.module_id where l2.id = p_lesson and m.version_id = e.version_id;
  if not found then raise exception 'lesson not in enrolled version'; end if;
  rule := l.completion_rule->>'mode';
  if rule = 'watch_percent' then ok := p_percent >= coalesce((l.completion_rule->>'threshold')::int, 90);
  elsif rule = 'quiz_pass' then
    ok := exists (select 1 from quiz_attempts a join quizzes q on q.id = a.quiz_id where q.lesson_id = p_lesson and a.enrollment_id = p_enrollment and a.passed);
  elsif rule = 'submission' then
    ok := exists (select 1 from submissions s join assignments a on a.id = s.assignment_id where a.lesson_id = p_lesson and s.enrollment_id = p_enrollment);
  elsif rule = 'attendance' then ok := false;   -- recorded by instructors only
  end if;
  if not ok then
    insert into lesson_progress(enrollment_id, lesson_id, status, watched_percent) values (p_enrollment, p_lesson, 'in_progress', p_percent)
    on conflict (enrollment_id, lesson_id) do update set watched_percent = greatest(lesson_progress.watched_percent, excluded.watched_percent), updated_at = now()
      where lesson_progress.status <> 'completed';
    return;
  end if;
  insert into lesson_progress(enrollment_id, lesson_id, status, watched_percent, completed_at)
  values (p_enrollment, p_lesson, 'completed', 100, now())
  on conflict (enrollment_id, lesson_id) do update set status = 'completed', watched_percent = 100,
      completed_at = coalesce(lesson_progress.completed_at, now()), updated_at = now();   -- idempotent
  perform recalc_completion(p_enrollment);
end $$;

create or replace function recalc_completion(p_enrollment uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare e enrollments%rowtype; required_total int; required_done int; score numeric;
begin
  select * into e from enrollments where id = p_enrollment for update;
  select count(*) into required_total from lessons l join modules m on m.id = l.module_id where m.version_id = e.version_id and l.is_required;
  select count(*) into required_done from lesson_progress p join lessons l on l.id = p.lesson_id join modules m on m.id = l.module_id
    where p.enrollment_id = p_enrollment and p.status = 'completed' and m.version_id = e.version_id and l.is_required;
  if required_total > 0 and required_done >= required_total then
    select avg(best) into score from (
      select max(a.score) as best from quiz_attempts a where a.enrollment_id = p_enrollment and a.status = 'submitted' group by a.quiz_id) t;
    insert into course_completions(enrollment_id, version_id, final_score) values (p_enrollment, e.version_id, score)
      on conflict (enrollment_id) do nothing;
    update enrollments set status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_enrollment and status = 'active';
    return true;
  end if;
  return false;
end $$;

-- ---------- assessment: server-side attempts and grading ----------
create or replace function start_quiz_attempt(p_enrollment uuid, p_quiz uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e enrollments%rowtype; q quizzes%rowtype; n int; aid uuid; ord uuid[];
begin
  select * into e from enrollments where id = p_enrollment;
  if not found or e.learner_id <> uid or not has_course_access(uid, e.course_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select qz.* into q from quizzes qz join lessons l on l.id = qz.lesson_id join modules m on m.id = l.module_id
    where qz.id = p_quiz and m.version_id = e.version_id;
  if not found then raise exception 'quiz not in enrolled version'; end if;
  -- resume an unexpired in-progress attempt rather than burning attempts
  select id into aid from quiz_attempts where quiz_id = p_quiz and learner_id = uid and status = 'in_progress'
     and (expires_at is null or expires_at > now());
  if aid is not null then return aid; end if;
  update quiz_attempts set status = 'expired' where quiz_id = p_quiz and learner_id = uid and status = 'in_progress';
  select coalesce(max(attempt_number),0)+1 into n from quiz_attempts where quiz_id = p_quiz and learner_id = uid;
  if q.max_attempts is not null and n > q.max_attempts then raise exception 'attempt limit reached'; end if;
  select array_agg(id order by case when q.shuffle_questions then random() else position end) into ord from questions where quiz_id = p_quiz;
  insert into quiz_attempts(quiz_id, enrollment_id, learner_id, attempt_number, expires_at, question_order)
  values (p_quiz, p_enrollment, uid, n, case when q.time_limit_seconds is not null then now() + make_interval(secs => q.time_limit_seconds + 5) end, coalesce(ord,'{}'))
  returning id into aid;
  return aid;
end $$;

-- p_answers: [{"question_id": "...", "option_ids": ["..."], "text": "..."}]
create or replace function submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns table(score numeric, passed boolean, show_results text) language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a quiz_attempts%rowtype; q quizzes%rowtype; ans jsonb; qq questions%rowtype;
        sel uuid[]; correct uuid[]; ok boolean; pts numeric; total numeric := 0; earned numeric := 0; sc numeric; pass boolean;
begin
  select * into a from quiz_attempts where id = p_attempt for update;
  if not found or a.learner_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt already closed'; end if;
  if a.expires_at is not null and a.expires_at < now() then
    update quiz_attempts set status = 'expired' where id = p_attempt; raise exception 'attempt expired';
  end if;
  select * into q from quizzes where id = a.quiz_id;
  for qq in select * from questions where quiz_id = a.quiz_id loop
    total := total + qq.points;
    select x into ans from jsonb_array_elements(p_answers) x where (x->>'question_id')::uuid = qq.id limit 1;
    sel := coalesce(array(select (jsonb_array_elements_text(ans->'option_ids'))::uuid), '{}');
    -- restrict selections to this question's own options
    sel := coalesce(array(select o.id from answer_options o where o.question_id = qq.id and o.id = any(sel)), '{}');
    ok := false;
    if qq.type in ('single','multiple','true_false') then
      select coalesce(array_agg(o.id order by o.id), '{}') into correct from answer_options o join answer_keys k on k.option_id = o.id
        where o.question_id = qq.id and k.is_correct;
      ok := (select coalesce(array_agg(s order by s), '{}') from unnest(sel) s) = correct and cardinality(correct) > 0;
    else
      ok := exists (select 1 from short_answer_keys k where k.question_id = qq.id
                    and lower(trim(ans->>'text')) = any (select lower(trim(v)) from unnest(k.accepted) v));
    end if;
    pts := case when ok then qq.points else 0 end;
    earned := earned + pts;
    insert into quiz_responses(attempt_id, question_id, selected_option_ids, text_answer, is_correct, points_awarded)
    values (p_attempt, qq.id, sel, left(ans->>'text', 2000), ok, pts)
    on conflict (attempt_id, question_id) do update set selected_option_ids = excluded.selected_option_ids,
       text_answer = excluded.text_answer, is_correct = excluded.is_correct, points_awarded = excluded.points_awarded;
  end loop;
  sc := case when total = 0 then 0 else round(earned / total * 100, 2) end;
  pass := sc >= q.pass_mark;
  update quiz_attempts set status = 'submitted', submitted_at = now(), score = sc, passed = pass where id = p_attempt;
  return query select sc, pass, q.show_results;
end $$;

create or replace function grade_submission(p_submission uuid, p_points numeric, p_feedback text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s submissions%rowtype; cid uuid; g grades%rowtype; maxp int;
begin
  select * into s from submissions where id = p_submission;
  select m.version_id into cid from assignments a join lessons l on l.id = a.lesson_id join modules m on m.id = l.module_id where a.id = s.assignment_id;
  select c.course_id, a.max_points into cid, maxp from course_versions c, assignments a
    where c.id = cid and a.id = s.assignment_id;
  if not (is_course_instructor(uid, cid) and has_permission(uid, 'grade.write.assigned')) and not has_permission(uid, 'grade.write.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_points > maxp then raise exception 'points exceed maximum'; end if;
  select * into g from grades where submission_id = p_submission;
  if found and g.finalized and not has_permission(uid, 'grade.override') then raise exception 'grade is finalized' using errcode = '42501'; end if;
  insert into grades(submission_id, grader_id, points, feedback) values (p_submission, uid, p_points, p_feedback)
  on conflict (submission_id) do update set grader_id = uid, points = p_points, feedback = p_feedback, updated_at = now();
  insert into grade_events(submission_id, actor_id, old_points, new_points, reason) values (p_submission, uid, g.points, p_points, p_reason);
  update submissions set status = 'graded' where id = p_submission;
  perform write_audit(uid, 'grade.changed', 'submission', p_submission::text, jsonb_build_object('old', g.points, 'new', p_points));
end $$;

-- ---------- certificates ----------
create or replace function issue_certificate(p_enrollment uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e enrollments%rowtype; v course_versions%rowtype; cid uuid; serial text; nm text; comp course_completions%rowtype;
begin
  select * into e from enrollments where id = p_enrollment for update;
  if not found then raise exception 'not found'; end if;
  if e.learner_id <> uid and not has_permission(uid, 'certificate.issue') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into comp from course_completions where enrollment_id = p_enrollment;
  if not found then raise exception 'course not completed'; end if;
  select * into v from course_versions where id = e.version_id;
  if not v.certificate_enabled then raise exception 'certificates disabled for this course'; end if;
  if comp.final_score is not null and comp.final_score < v.pass_mark then raise exception 'pass mark not met'; end if;
  select id into cid from certificates where enrollment_id = p_enrollment and status = 'valid';
  if cid is not null then return cid; end if;   -- idempotent
  select full_name into nm from profiles where id = e.learner_id;
  serial := 'CRT-' || to_char(now(),'YYYY') || '-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10));
  insert into certificates(serial, enrollment_id, learner_id, course_id, version_id, learner_name, course_title)
  values (serial, p_enrollment, e.learner_id, e.course_id, e.version_id, nm, v.title) returning id into cid;
  insert into certificate_events(certificate_id, action, actor_id) values (cid, 'issued', uid);
  perform write_audit(uid, 'certificate.issued', 'certificate', cid::text, jsonb_build_object('serial', serial));
  insert into jobs(kind, payload) values ('generate_certificate_pdf', jsonb_build_object('certificate_id', cid));
  return cid;
end $$;

create or replace function revoke_certificate(p_certificate uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not has_permission(uid, 'certificate.revoke') then raise exception 'forbidden' using errcode = '42501'; end if;
  update certificates set status = 'revoked', revoked_at = now() where id = p_certificate and status = 'valid';
  insert into certificate_events(certificate_id, action, actor_id, reason) values (p_certificate, 'revoked', uid, p_reason);
  perform write_audit(uid, 'certificate.revoked', 'certificate', p_certificate::text, jsonb_build_object('reason', p_reason));
end $$;

-- Public verification: exposes only what a verifier needs
create or replace function verify_certificate(p_serial text)
returns table(serial text, learner_name text, course_title text, issued_at timestamptz, status cert_status)
language sql stable security definer set search_path = public as $$
  select c.serial, c.learner_name, c.course_title, c.issued_at, c.status from certificates c where c.serial = upper(p_serial);
$$;
grant execute on function verify_certificate(text) to anon, authenticated;

-- ---------- account suspension ----------
create or replace function suspend_user(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not has_permission(uid, 'user.suspend') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = uid then raise exception 'cannot suspend yourself'; end if;
  if exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = p_user and r.key = 'owner')
     and not has_permission(uid, 'owner.manage') then raise exception 'cannot suspend an owner' using errcode = '42501'; end if;
  update profiles set status = 'suspended', suspended_reason = p_reason, suspended_at = now() where id = p_user;
  update enrollments set status = 'suspended' where learner_id = p_user and status = 'active';
  perform write_audit(uid, 'user.suspended', 'user', p_user::text, jsonb_build_object('reason', p_reason));
  insert into notifications(user_id, kind, title, body) values (p_user, 'security', 'Your account was suspended', p_reason);
  -- Session revocation happens in the app layer with the service role (auth.admin.signOut); see services/admin.ts
end $$;

create or replace function reinstate_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not has_permission(uid, 'user.suspend') then raise exception 'forbidden' using errcode = '42501'; end if;
  update profiles set status = 'active', suspended_reason = null, suspended_at = null where id = p_user;
  update enrollments set status = 'active' where learner_id = p_user and status = 'suspended';
  perform write_audit(uid, 'user.reinstated', 'user', p_user::text);
end $$;

create or replace function assign_role(p_user uuid, p_role_key text, p_org uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r roles%rowtype;
begin
  select * into r from roles where key = p_role_key;
  if not found then raise exception 'unknown role'; end if;
  if r.is_privileged then
    if not has_permission(uid, 'role.assign.privileged') then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not has_permission(uid, 'role.assign') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into user_roles(user_id, role_id, organization_id, granted_by) values (p_user, r.id, p_org, uid) on conflict do nothing;
end $$;

create or replace function remove_role(p_user uuid, p_role_key text, p_org uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r roles%rowtype;
begin
  select * into r from roles where key = p_role_key;
  if r.is_privileged and not has_permission(uid, 'role.assign.privileged') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not r.is_privileged and not has_permission(uid, 'role.assign') then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from user_roles where user_id = p_user and role_id = r.id and coalesce(organization_id,'00000000-0000-0000-0000-000000000000') = coalesce(p_org,'00000000-0000-0000-0000-000000000000');
end $$;

-- ---------- payments (called by the verified webhook handler with the service role) ----------
create or replace function apply_payment_event(p_provider text, p_event_id text, p_order uuid, p_amount int, p_status text, p_raw jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; inserted int;
begin
  insert into payments(order_id, provider, provider_event_id, amount_cents, status, raw)
  values (p_order, p_provider, p_event_id, p_amount, p_status, coalesce(p_raw,'{}'))
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate'; end if;           -- duplicate delivery
  select * into o from orders where id = p_order for update;
  if not found then return 'unknown_order'; end if;
  if p_status = 'paid' and o.status in ('pending','failed') then
    if p_amount < o.amount_cents then return 'amount_mismatch'; end if;
    update orders set status = 'paid' where id = o.id;
    insert into entitlements(user_id, course_id, source, source_id) values (o.learner_id, o.course_id, 'order', o.id)
      on conflict (user_id, course_id) do update set revoked_at = null, source_id = o.id;
    insert into notifications(user_id, kind, title, href) values (o.learner_id, 'payment', 'Payment received', '/courses');
    return 'applied';
  elsif p_status = 'failed' and o.status = 'pending' then
    update orders set status = 'failed' where id = o.id; return 'applied';
  elsif p_status = 'refunded' and o.status in ('paid','partially_refunded') then   -- out-of-order tolerant
    update orders set status = 'refunded' where id = o.id;
    update entitlements set revoked_at = now() where source_id = o.id;
    return 'applied';
  end if;
  return 'ignored';
end $$;
revoke execute on function apply_payment_event(text,text,uuid,int,text,jsonb) from public, anon, authenticated;

-- ---------- jobs queue ----------
create or replace function claim_jobs(p_limit int default 10) returns setof jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
  where id in (select id from jobs where status = 'queued' and run_at <= now() order by run_at for update skip locked limit p_limit)
  returning *;
end $$;
revoke execute on function claim_jobs(int) from public, anon, authenticated;

create or replace function finish_job(p_job uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs%rowtype;
begin
  select * into j from jobs where id = p_job;
  if p_ok then update jobs set status = 'succeeded', locked_at = null where id = p_job;
  elsif j.attempts >= j.max_attempts then update jobs set status = 'dead', last_error = p_error, locked_at = null where id = p_job;
  else update jobs set status = 'queued', last_error = p_error, locked_at = null, run_at = now() + (power(2, j.attempts) * interval '30 seconds') where id = p_job;
  end if;
end $$;
revoke execute on function finish_job(uuid,boolean,text) from public, anon, authenticated;
