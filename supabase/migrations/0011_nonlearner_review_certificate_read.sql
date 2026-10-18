create or replace function grant_nonlearner_baseline_permissions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.key <> 'learner' then
    insert into role_permissions(role_id, permission_key)
    select new.id, p.key
    from permissions p
    where p.key in ('course.review.assigned', 'certificate.read.any')
    on conflict do nothing;
  end if;
  return new;
end $$;

revoke all on function grant_nonlearner_baseline_permissions() from public, anon, authenticated;

create trigger trg_roles_nonlearner_baseline
  after insert on roles
  for each row execute function grant_nonlearner_baseline_permissions();

insert into role_permissions(role_id, permission_key)
select r.id, p.key
from roles r
cross join permissions p
where r.key <> 'learner'
  and p.key in ('course.review.assigned', 'certificate.read.any')
on conflict do nothing;