-- Allow platform operators to safely replay dead-letter jobs.
insert into permissions(key, description)
values ('ops.retry', 'Retry dead-letter jobs')
on conflict (key) do nothing;

insert into role_permissions(role_id, permission_key)
select r.id, 'ops.retry'
from roles r
where r.key in ('admin', 'owner')
on conflict do nothing;

create or replace function retry_dead_job(p_job uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  j jobs%rowtype;
begin
  if not has_permission(uid, 'ops.retry') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into j from jobs where id = p_job for update;
  if not found then raise exception 'job not found'; end if;
  if j.status <> 'dead' then raise exception 'only dead jobs can be retried'; end if;

  update jobs
  set status = 'queued', attempts = 0, run_at = now(), locked_at = null, last_error = null
  where id = p_job;

  perform write_audit(uid, 'job.retry_requested', 'job', p_job::text,
    jsonb_build_object('kind', j.kind, 'previous_attempts', j.attempts, 'max_attempts', j.max_attempts));
end $$;

revoke all on function retry_dead_job(uuid) from public, anon;
grant execute on function retry_dead_job(uuid) to authenticated;