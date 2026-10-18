create or replace function create_platform_role(
  p_key text,
  p_name text,
  p_description text,
  p_permissions text[]
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_role uuid;
  privileged_role boolean;
begin
  if not has_permission(uid, 'role.assign') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[a-z][a-z0-9_]{1,47}$' or p_name is null or length(trim(p_name)) not between 2 and 100 then
    raise exception 'invalid role details';
  end if;
  if p_description is not null and length(p_description) > 300 then
    raise exception 'role description is too long';
  end if;
  if p_permissions is null or cardinality(p_permissions) = 0 then
    raise exception 'select at least one permission';
  end if;
  if exists (
    select 1 from unnest(p_permissions) as requested(permission_key)
    where not has_permission(uid, requested.permission_key)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  privileged_role := has_permission(uid, 'role.assign.privileged');
  insert into roles(key, name, description, is_privileged, scope)
  values (p_key, trim(p_name), nullif(trim(p_description), ''), privileged_role, 'platform')
  returning id into new_role;

  insert into role_permissions(role_id, permission_key)
  select new_role, requested.permission_key
  from unnest(p_permissions) as requested(permission_key)
  on conflict do nothing;

  perform write_audit(uid, 'role.created', 'role', new_role::text,
    jsonb_build_object('key', p_key, 'permissions', p_permissions));
  return new_role;
end $$;

revoke all on function create_platform_role(text, text, text, text[]) from public, anon;
grant execute on function create_platform_role(text, text, text, text[]) to authenticated;