-- Avoid recursive RLS evaluation between cohorts and cohort_memberships.
create or replace function current_user_in_cohort(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cohort_memberships cm
    where cm.cohort_id = cid and cm.user_id = auth.uid()
  );
$$;

revoke all on function current_user_in_cohort(uuid) from public, anon;
grant execute on function current_user_in_cohort(uuid) to authenticated;

drop policy if exists cohorts_member on cohorts;
create policy cohorts_member on cohorts for select to authenticated using (
  is_org_manager(auth.uid(), organization_id)
  or current_user_has('org.read.any')
  or current_user_in_cohort(id)
);