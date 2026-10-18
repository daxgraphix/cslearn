-- Disable paid enrollment while retaining existing financial records.
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
  insert into enrollments(learner_id, course_id, version_id, source)
  values (uid, p_course, v.id, 'self')
  on conflict (learner_id, course_id) do update set status = 'active'
    where enrollments.status in ('cancelled','expired')
  returning id into eid;
  if eid is null then select id into eid from enrollments where learner_id = uid and course_id = p_course; end if;
  return eid;
end $$;

drop function if exists apply_payment_event(text, text, uuid, int, text, jsonb);

drop policy if exists orders_self on orders;
drop policy if exists orders_finance on orders;
drop policy if exists entitlements_self on entitlements;
revoke all on table orders, payments, refunds, subscriptions, entitlements from anon, authenticated;
alter table support_tickets add constraint support_tickets_no_payment_category check (category <> 'payment') not valid;

delete from roles where key = 'finance';
delete from permissions where key in ('finance.read', 'finance.refund');

update course_versions
set price_cents = 0,
    enrollment_policy = case when enrollment_policy = 'paid' then 'open' else enrollment_policy end
where price_cents <> 0 or enrollment_policy = 'paid';