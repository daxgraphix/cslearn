-- Every platform role can participate in course review and approve submissions.
-- The review RPC still prevents authors and instructors from reviewing their own work.
insert into role_permissions(role_id, permission_key)
select r.id, p.key
from roles r
cross join permissions p
where p.key in ('course.review.assigned', 'course.review.any')
on conflict do nothing;

create or replace function grant_nonlearner_baseline_permissions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into role_permissions(role_id, permission_key)
  select new.id, p.key
  from permissions p
  where p.key in ('course.review.assigned', 'course.review.any')
     or (new.key <> 'learner' and p.key = 'certificate.read.any')
  on conflict do nothing;
  return new;
end $$;
