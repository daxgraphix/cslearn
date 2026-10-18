-- =====================================================================
-- 0004 Seed: roles, permissions, role_permissions, categories
-- =====================================================================
insert into roles(key, name, description, is_privileged, scope) values
 ('owner','Platform Owner','Highest privilege',true,'platform'),
 ('admin','Platform Administrator','Operations and configuration',true,'platform'),
 ('reviewer','Academic Manager / Reviewer','Course quality review and approval',false,'platform'),
 ('instructor','Instructor / Course Author','Creates and maintains assigned courses',false,'platform'),
 ('learner','Learner','Studies courses',false,'platform'),
 ('support','Support Agent','Handles support requests',false,'platform'),
 ('org_manager','Organization Manager','Manages one institution',false,'organization'),
 ('finance','Finance Officer','Payments, refunds, invoices',false,'platform'),
 ('certificate_officer','Certificate Officer','Controlled certificate lifecycle',false,'platform'),
 ('assessment_moderator','Assessment Moderator','Grading disputes and exam incidents',false,'platform'),
 ('auditor','Compliance / Auditor','Read-only audit and reports',false,'platform'),
 ('enrollment_manager','Enrollment Manager','Bulk imports and cohort setup',false,'platform');

insert into permissions(key, description) values
 ('course.create','Create courses'),('course.update.own','Edit own/assigned draft courses'),('course.update.any','Edit any course draft'),
 ('course.read.any','Read any course and draft'),('course.submit','Submit a version for review'),
 ('course.review.assigned','Review assigned submissions'),('course.review.any','Review any submission and assign reviewers'),
 ('course.publish','Publish approved versions'),('course.publish.own_override','Publish own revisions (emergency only)'),
 ('course.unpublish','Retire a course'),
 ('grade.write.assigned','Grade assignments in own courses'),('grade.write.any','Grade any assignment'),('grade.override','Change finalized grades'),
 ('user.read','Read user directory'),('user.suspend','Suspend and reinstate accounts'),
 ('role.read','Read role assignments'),('role.assign','Assign non-privileged roles'),('role.assign.privileged','Assign privileged roles'),
 ('owner.manage','Manage owner-level controls'),
 ('enrollment.read.any','Read all enrollments'),('enrollment.manage','Manage enrollments and bulk import'),
 ('certificate.issue','Issue certificates on behalf of learners'),('certificate.revoke','Revoke certificates'),('certificate.read.any','Read all certificates'),
 ('finance.read','Read orders and payments'),('finance.refund','Issue refunds'),
 ('support.read','Read support tickets'),('support.reply','Reply to support tickets'),('support.read_learner','Read minimal learner info for support'),
 ('audit.read','Read audit log'),('report.read','Read platform reports'),('ops.read','Read operations and job status'),
 ('settings.read','Read settings'),('settings.write','Change platform settings'),
 ('org.read.any','Read any organization'),('org.manage','Create and manage organizations'),
 ('category.manage','Manage categories');

create or replace function _grant(role_key text, perms text[]) returns void language sql as $$
  insert into role_permissions(role_id, permission_key) select r.id, p from roles r, unnest(perms) p where r.key = role_key
  on conflict do nothing; $$;

select _grant('learner', array[]::text[]);
select _grant('instructor', array['course.create','course.update.own','course.submit','grade.write.assigned']);
select _grant('reviewer', array['course.read.any','course.review.assigned','course.review.any','course.publish']);
select _grant('support', array['support.read','support.reply','support.read_learner']);
select _grant('org_manager', array[]::text[]);  -- org scope enforced via organization_memberships
select _grant('finance', array['finance.read','finance.refund','report.read']);
select _grant('certificate_officer', array['certificate.issue','certificate.revoke','certificate.read.any']);
select _grant('assessment_moderator', array['grade.write.any','grade.override']);
select _grant('auditor', array['audit.read','report.read']);
select _grant('enrollment_manager', array['enrollment.manage','enrollment.read.any']);
select _grant('admin', array['course.create','course.update.any','course.read.any','course.publish','course.unpublish','user.read','user.suspend',
  'role.read','role.assign','enrollment.read.any','enrollment.manage','certificate.read.any','support.read','support.reply','report.read','ops.read',
  'org.read.any','org.manage','category.manage','settings.read','audit.read','finance.read']);
select _grant('owner', array(select key from permissions));
drop function _grant(text, text[]);

insert into categories(slug, name, name_sw, position) values
 ('cybersecurity','Cybersecurity','Usalama wa mtandao',1),
 ('software-development','Software development','Uundaji wa programu',2),
 ('data','Data and analytics','Data na uchambuzi',3),
 ('digital-literacy','Digital literacy','Ujuzi wa kidijitali',4),
 ('business','Business and entrepreneurship','Biashara na ujasiriamali',5);

insert into settings(key, value) values
 ('platform', '{"name":"CSGO","default_locale":"en","support_email":"support@example.com","maintenance_mode":false}'),
 ('security', '{"require_mfa_for_privileged":true,"max_signed_url_ttl":300}');
