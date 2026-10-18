-- Run with: supabase test db   (pgTAP). Verifies isolation and privilege rules.
begin;
select plan(11);

insert into auth.users(id, email, instance_id, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1','learner1@test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000a2','learner2@test','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
  ('00000000-0000-0000-0000-0000000000b1','instr1@test','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
insert into user_roles(user_id, role_id) select '00000000-0000-0000-0000-0000000000b1', id from roles where key = 'instructor';
insert into organizations(id, name, slug) values ('00000000-0000-0000-0000-0000000000c1', 'RLS Test Organization', 'rls-test-organization');
insert into cohorts(id, organization_id, name, created_by) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000c1', 'RLS Test Cohort', '00000000-0000-0000-0000-0000000000a1');
insert into cohort_memberships(cohort_id, user_id) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000a1');

-- act as learner1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select is((select count(*)::int from profiles), 1, 'learner sees only own profile');
select lives_ok($$select * from cohorts$$, 'cohort member can read cohorts without recursive RLS');
select lives_ok($$select * from cohort_memberships$$, 'cohort member can read membership without recursive RLS');
select throws_ok($$select create_platform_role('custom_role','Custom Role','Test role',array['role.assign'])$$, '42501', null, 'learner cannot create platform roles');
select throws_ok($$update profiles set status = 'active' where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'learner cannot edit status column');
select throws_ok($$insert into user_roles(user_id, role_id) select auth.uid(), id from roles where key = 'owner'$$, '42501', null, 'learner cannot grant self a role');
select throws_ok($$select * from answer_keys$$, '42501', null, 'answer keys are not readable from the browser');
select throws_ok($$select create_course('x','x-course')$$, '42501', null, 'learner cannot create a course');
select throws_ok($$select suspend_user('00000000-0000-0000-0000-0000000000a2','because')$$, '42501', null, 'learner cannot suspend');
select is((select count(*)::int from audit_logs), 0, 'learner cannot read audit logs');
select throws_ok($$delete from audit_logs$$, '42501', null, 'audit log is not deletable by app users');

select * from finish();
rollback;
