-- Add permission-checked updates for custom platform roles.
create or replace function update_platform_role(
  p_key text,
  p_name text,
  p_description text,
  p_permissions text[]
) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target roles%rowtype;
begin
  if not has_permission(uid, 'role.assign') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_key is null or p_name is null or length(trim(p_name)) not between 2 and 100 then
    raise exception 'invalid role details';
  end if;
  if p_description is not null and length(p_description) > 300 then
    raise exception 'role description is too long';
  end if;
  if p_permissions is null or cardinality(p_permissions) = 0 then
    raise exception 'select at least one permission';
  end if;
  select * into target from roles where key = p_key for update;
  if not found then raise exception 'role not found'; end if;
  if target.key = any(array['owner','admin','learner','instructor','reviewer','support','org_manager','certificate_officer','assessment_moderator','auditor','enrollment_manager','finance']) then
    raise exception 'system roles cannot be edited';
  end if;
  if target.scope <> 'platform' then
    raise exception 'organization roles must be edited from organization settings';
  end if;
  if target.is_privileged and not has_permission(uid, 'role.assign.privileged') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_permissions) as requested(permission_key)
    where not exists (select 1 from permissions p where p.key = requested.permission_key)
       or not has_permission(uid, requested.permission_key)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update roles set name = trim(p_name), description = nullif(trim(p_description), '') where id = target.id;
  delete from role_permissions where role_id = target.id;
  insert into role_permissions(role_id, permission_key)
    select target.id, requested.permission_key
    from (select distinct unnest(p_permissions) as permission_key) requested;
  perform write_audit(uid, 'role.updated', 'role', target.id::text,
    jsonb_build_object('key', p_key, 'permissions', p_permissions));
end $$;

revoke all on function update_platform_role(text, text, text, text[]) from public, anon;
grant execute on function update_platform_role(text, text, text, text[]) to authenticated;
