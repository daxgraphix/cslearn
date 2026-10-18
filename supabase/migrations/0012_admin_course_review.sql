-- Platform administrators need to review and assign course submissions so
-- approved versions can move through the existing publish flow.
insert into role_permissions(role_id, permission_key)
select r.id, 'course.review.any'
from roles r
where r.key = 'admin'
on conflict do nothing;
