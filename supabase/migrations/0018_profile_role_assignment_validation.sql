-- Keep profile role edits on the normalized user_roles table and validate
-- targets consistently before granting or revoking an assignment.
create or replace function assign_role(p_user uuid, p_role_key text, p_org uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r roles%rowtype;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_user is null or not exists (select 1 from profiles where id = p_user) then raise exception 'user profile not found'; end if;
  if p_role_key is null or length(trim(p_role_key)) = 0 then raise exception 'role key is required'; end if;
  select * into r from roles where key = p_role_key;
  if not found then raise exception 'unknown role'; end if;
  if r.is_privileged then
    if not has_permission(uid, 'role.assign.privileged') then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not has_permission(uid, 'role.assign') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into user_roles(user_id, role_id, organization_id, granted_by)
  values (p_user, r.id, p_org, uid) on conflict do nothing;
end $$;

create or replace function remove_role(p_user uuid, p_role_key text, p_org uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r roles%rowtype;
begin
  if uid is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if p_user is null or not exists (select 1 from profiles where id = p_user) then raise exception 'user profile not found'; end if;
  if p_role_key is null or length(trim(p_role_key)) = 0 then raise exception 'role key is required'; end if;
  select * into r from roles where key = p_role_key;
  if not found then raise exception 'unknown role'; end if;
  if r.is_privileged then
    if not has_permission(uid, 'role.assign.privileged') then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not has_permission(uid, 'role.assign') then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from user_roles
  where user_id = p_user
    and role_id = r.id
    and coalesce(organization_id, '00000000-0000-0000-0000-000000000000')
      = coalesce(p_org, '00000000-0000-0000-0000-000000000000');
end $$;

revoke all on function assign_role(uuid, text, uuid) from public, anon;
revoke all on function remove_role(uuid, text, uuid) from public, anon;
grant execute on function assign_role(uuid, text, uuid) to authenticated;
grant execute on function remove_role(uuid, text, uuid) to authenticated;
