-- =====================================================================
-- Consolidated schema snapshot: migrations 0001-0011
-- Fresh Supabase projects only. Existing projects must apply pending migrations.
-- =====================================================================
-- =====================================================================
-- 0001 Schema: logical domains in one authoritative PostgreSQL database
-- =====================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------- enums ----------
create type account_status      as enum ('active','suspended');
create type version_status      as enum ('draft','in_review','changes_requested','approved','published','archived');
create type review_decision     as enum ('approved','rejected','changes_requested');
create type lesson_type         as enum ('video','text','document','external','quiz','assignment','practical','live','survey');
create type question_type       as enum ('single','multiple','true_false','short_text');
create type enrollment_status   as enum ('active','completed','suspended','cancelled','expired');
create type progress_status     as enum ('not_started','in_progress','completed');
create type attempt_status      as enum ('in_progress','submitted','expired');
create type submission_status   as enum ('submitted','graded','returned');
create type cert_status         as enum ('valid','revoked');
create type order_status        as enum ('pending','paid','failed','refunded','partially_refunded');
create type ticket_status       as enum ('open','pending','escalated','resolved','closed');
create type job_status          as enum ('queued','running','succeeded','failed','dead');

-- ---------- generic helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- =====================================================================
-- IDENTITY AND ACCESS
-- =====================================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  display_name text,
  avatar_url text,
  bio text,
  locale text not null default 'en' check (locale in ('en','sw')),
  timezone text,
  status account_status not null default 'active',
  suspended_reason text,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

create table roles (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  name text not null,
  description text,
  is_privileged boolean not null default false,
  scope text not null default 'platform' check (scope in ('platform','organization'))
);

create table permissions (
  key text primary key,
  description text not null
);

create table role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  contact_email text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_orgs_updated before update on organizations for each row execute function set_updated_at();

-- Role assignments live outside profiles so users can never edit their own privileges.
create table user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  granted_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create unique index uq_user_roles on user_roles (user_id, role_id, coalesce(organization_id, '00000000-0000-0000-0000-000000000000'));
create index idx_user_roles_user on user_roles(user_id);

-- Explicit per-user denials: a deny always beats a grant.
create table permission_denials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_id, permission_key)
);

create table organization_memberships (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  member_type text not null default 'learner' check (member_type in ('learner','instructor','manager')),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index idx_org_members_user on organization_memberships(user_id);

-- =====================================================================
-- COURSE CATALOG AND CONTENT  (stable course identity vs. versions)
-- =====================================================================
create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_sw text,
  description text,
  position int not null default 0
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category_id uuid references categories(id) on delete set null,
  owner_id uuid not null references profiles(id),
  organization_id uuid references organizations(id) on delete set null, -- private to an org when set
  published_version_id uuid, -- FK added after course_versions
  visibility text not null default 'public' check (visibility in ('public','unlisted','organization')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_courses_updated before update on courses for each row execute function set_updated_at();
create index idx_courses_owner on courses(owner_id);
create index idx_courses_org on courses(organization_id);

create table course_versions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  version_number int not null check (version_number > 0),
  status version_status not null default 'draft',
  title text not null,
  subtitle text,
  description text,
  objectives text[] not null default '{}',
  prerequisites text,
  thumbnail_path text,
  promo_video_url text,
  language text not null default 'en',
  level text not null default 'beginner' check (level in ('beginner','intermediate','advanced')),
  estimated_minutes int check (estimated_minutes is null or estimated_minutes >= 0),
  accessibility_notes text,
  enrollment_policy text not null default 'open' check (enrollment_policy in ('open','approval','invite_only','paid')),
  price_cents int not null default 0 check (price_cents >= 0),
  currency text not null default 'TZS',
  available_from timestamptz,
  available_until timestamptz,
  pass_mark int not null default 70 check (pass_mark between 0 and 100),
  certificate_enabled boolean not null default true,
  seo_title text,
  seo_description text,
  change_summary text,
  created_by uuid not null references profiles(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  published_at timestamptz,
  scheduled_publish_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, version_number)
);
create trigger trg_cv_updated before update on course_versions for each row execute function set_updated_at();
-- at most one open (non-published, non-archived) revision per course
create unique index uq_one_open_revision on course_versions(course_id)
  where status in ('draft','in_review','changes_requested','approved');
create index idx_cv_status on course_versions(status);
alter table courses add constraint fk_courses_published_version
  foreign key (published_version_id) references course_versions(id) on delete set null;

create table course_instructors (
  course_id uuid not null references courses(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'author' check (role in ('lead','author','assistant')),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id)
);
create index idx_ci_user on course_instructors(user_id);

create table course_tags (
  course_id uuid references courses(id) on delete cascade,
  tag_id uuid references tags(id) on delete cascade,
  primary key (course_id, tag_id)
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references course_versions(id) on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  description text,
  unique (version_id, position) deferrable initially deferred
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  position int not null check (position >= 0),
  type lesson_type not null,
  title text not null,
  body jsonb not null default '{}'::jsonb,      -- type specific payload (video url, rich text, etc.)
  duration_minutes int,
  is_required boolean not null default true,
  completion_rule jsonb not null default '{"mode":"manual"}'::jsonb, -- manual | watch_percent | quiz_pass | submission | attendance
  unique (module_id, position) deferrable initially deferred
);
create index idx_lessons_module on lessons(module_id);

create table lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references lessons(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('pdf','file','link')),
  storage_path text,
  url text,
  mime_type text,
  size_bytes bigint,
  check ((kind = 'link' and url is not null) or (kind <> 'link' and storage_path is not null))
);

create table learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table learning_path_courses (
  path_id uuid references learning_paths(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  position int not null,
  primary key (path_id, course_id)
);

-- =====================================================================
-- REVIEW AND PUBLISHING
-- =====================================================================
create table course_submissions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references course_versions(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  assigned_reviewer_id uuid references profiles(id),
  status text not null default 'pending' check (status in ('pending','in_review','closed')),
  note text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index idx_submissions_reviewer on course_submissions(assigned_reviewer_id) where status <> 'closed';

create table course_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references course_submissions(id) on delete cascade,
  reviewer_id uuid not null references profiles(id),
  decision review_decision not null,
  summary text,
  created_at timestamptz not null default now()
);
create table review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid references course_reviews(id) on delete cascade,
  submission_id uuid not null references course_submissions(id) on delete cascade,
  lesson_id uuid references lessons(id) on delete set null,
  author_id uuid not null references profiles(id),
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create table publication_events (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  version_id uuid not null references course_versions(id) on delete cascade,
  action text not null check (action in ('published','unpublished','scheduled','archived','restored')),
  actor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  organization_id uuid,
  metadata jsonb not null default '{}'::jsonb,   -- never store passwords, tokens or payment secrets
  ip inet,
  created_at timestamptz not null default now()
);
create index idx_audit_entity on audit_logs(entity_type, entity_id);
create index idx_audit_actor on audit_logs(actor_id, created_at desc);
create index idx_audit_created on audit_logs(created_at desc);

-- =====================================================================
-- ASSESSMENT
-- =====================================================================
create table quizzes (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid unique not null references lessons(id) on delete cascade,
  instructions text,
  pass_mark int not null default 70 check (pass_mark between 0 and 100),
  max_attempts int check (max_attempts is null or max_attempts > 0),
  time_limit_seconds int check (time_limit_seconds is null or time_limit_seconds > 0),
  shuffle_questions boolean not null default false,
  show_results text not null default 'immediate' check (show_results in ('immediate','after_close','never'))
);
create table questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  position int not null,
  type question_type not null,
  prompt text not null,
  points int not null default 1 check (points > 0),
  explanation text
);
create index idx_questions_quiz on questions(quiz_id);
create table answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  position int not null,
  label text not null
);
-- Answer keys are isolated: no learner/instructor-facing policy ever exposes this table to browsers.
create table answer_keys (
  option_id uuid primary key references answer_options(id) on delete cascade,
  is_correct boolean not null default false
);
create table short_answer_keys (
  question_id uuid primary key references questions(id) on delete cascade,
  accepted text[] not null check (cardinality(accepted) > 0)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid unique not null references lessons(id) on delete cascade,
  instructions text not null default '',
  max_points int not null default 100 check (max_points > 0),
  due_offset_days int,
  allowed_mime_types text[] not null default '{application/pdf,image/png,image/jpeg}',
  max_file_bytes bigint not null default 10485760
);

-- =====================================================================
-- LEARNING
-- =====================================================================
create table cohorts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  starts_on date,
  ends_on date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table cohort_memberships (
  cohort_id uuid references cohorts(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (cohort_id, user_id)
);
create table cohort_course_assignments (
  cohort_id uuid references cohorts(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  due_on date,
  assigned_by uuid references profiles(id),
  primary key (cohort_id, course_id)
);

create table enrollments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete restrict,
  version_id uuid not null references course_versions(id) on delete restrict, -- version the learner studies
  status enrollment_status not null default 'active',
  source text not null default 'self' check (source in ('self','paid','cohort','admin','import')),
  cohort_id uuid references cohorts(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  unique (learner_id, course_id)
);
create index idx_enroll_course on enrollments(course_id);
create index idx_enroll_learner on enrollments(learner_id);

create table lesson_progress (
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status progress_status not null default 'not_started',
  watched_percent int not null default 0 check (watched_percent between 0 and 100),
  last_position_seconds int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (enrollment_id, lesson_id)
);

create table course_completions (
  enrollment_id uuid primary key references enrollments(id) on delete cascade,
  version_id uuid not null references course_versions(id),
  final_score numeric(5,2),
  completed_at timestamptz not null default now()
);

create table quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references quizzes(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  learner_id uuid not null references profiles(id) on delete cascade,
  attempt_number int not null,
  status attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  submitted_at timestamptz,
  score numeric(5,2),
  passed boolean,
  question_order uuid[] not null default '{}',
  unique (quiz_id, learner_id, attempt_number)
);
create table quiz_responses (
  attempt_id uuid not null references quiz_attempts(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  selected_option_ids uuid[] not null default '{}',
  text_answer text,
  is_correct boolean,
  points_awarded numeric(6,2),
  primary key (attempt_id, question_id)
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  learner_id uuid not null references profiles(id) on delete cascade,
  text_answer text,
  file_path text,                       -- private bucket path
  status submission_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  unique (assignment_id, learner_id)
);
create table grades (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid unique not null references submissions(id) on delete cascade,
  grader_id uuid not null references profiles(id),
  points numeric(6,2) not null check (points >= 0),
  feedback text,
  finalized boolean not null default false,
  updated_at timestamptz not null default now()
);
create table grade_events (
  id bigint generated always as identity primary key,
  submission_id uuid not null references submissions(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  old_points numeric(6,2),
  new_points numeric(6,2),
  reason text,
  created_at timestamptz not null default now()
);
create table course_evaluations (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid unique not null references enrollments(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- CERTIFICATES AND COMMERCE
-- =====================================================================
create table certificates (
  id uuid primary key default gen_random_uuid(),
  serial text unique not null,
  enrollment_id uuid not null references enrollments(id) on delete restrict,
  learner_id uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  version_id uuid not null references course_versions(id),
  learner_name text not null,           -- snapshot so reissue/rename never rewrites history
  course_title text not null,
  status cert_status not null default 'valid',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  pdf_path text
);
create unique index uq_one_valid_cert on certificates(enrollment_id) where status = 'valid';
create table certificate_events (
  id bigint generated always as identity primary key,
  certificate_id uuid not null references certificates(id) on delete cascade,
  action text not null check (action in ('issued','revoked','reissued','downloaded')),
  actor_id uuid,
  reason text,
  created_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  version_id uuid not null references course_versions(id),
  amount_cents int not null check (amount_cents >= 0),
  currency text not null,
  status order_status not null default 'pending',
  provider text,
  provider_reference text,
  created_at timestamptz not null default now()
);
create unique index uq_order_provider_ref on orders(provider, provider_reference) where provider_reference is not null;
create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  provider text not null,
  provider_event_id text not null,
  amount_cents int not null,
  status text not null,
  raw jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider, provider_event_id)      -- webhook idempotency
);
create table refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id),
  amount_cents int not null check (amount_cents > 0),
  reason text,
  requested_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  plan text not null,
  status text not null default 'active',
  current_period_end timestamptz
);
create table entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  source text not null check (source in ('order','subscription','cohort','admin')),
  source_id uuid,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, course_id)
);

-- =====================================================================
-- OPERATIONS AND COMMUNICATIONS
-- =====================================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, created_at desc);
create table notification_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  email_marketing boolean not null default false,
  email_course_updates boolean not null default true,
  email_reminders boolean not null default true,
  in_app boolean not null default true
  -- account and security notices are always sent
);
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  assignee_id uuid references profiles(id),
  subject text not null,
  category text not null default 'general' check (category in ('general','access','payment','academic','security','privacy')),
  status ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  author_id uuid not null references profiles(id),
  body text not null,
  internal boolean not null default false,
  created_at timestamptz not null default now()
);
create table data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('export','deletion')),
  status text not null default 'requested' check (status in ('requested','in_progress','completed','rejected')),
  result_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
-- Durable job queue with retry and dead-letter handling
create table jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,            -- send_email | generate_certificate_pdf | export_report | reconcile_payments | bulk_enroll
  payload jsonb not null default '{}'::jsonb,
  status job_status not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 5,
  run_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index idx_jobs_ready on jobs(run_at) where status = 'queued';
create table settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- Source: migrations/0002_functions.sql
-- =====================================================================
-- =====================================================================
-- 0002 Functions: authorization helpers and transactional business rules
-- =====================================================================

-- ---------- authorization ----------
create or replace function is_active_user(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and status = 'active');
$$;

-- has_permission: explicit denial > role grant. Optionally scoped to an organization.
create or replace function has_permission(uid uuid, perm text, org uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_active_user(uid)
    and not exists (select 1 from permission_denials d where d.user_id = uid and d.permission_key = perm)
    and exists (
      select 1
      from user_roles ur
      join role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = uid
        and rp.permission_key = perm
        and (ur.organization_id is null or ur.organization_id = org)
    );
$$;

create or replace function current_user_has(perm text, org uuid default null) returns boolean
language sql stable as $$ select has_permission(auth.uid(), perm, org); $$;

create or replace function is_course_instructor(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_instructors where course_id = cid and user_id = uid)
      or exists (select 1 from courses where id = cid and owner_id = uid);
$$;

create or replace function is_org_manager(uid uuid, org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_user(uid) and exists (
    select 1 from organization_memberships m
    where m.organization_id = org and m.user_id = uid and m.member_type = 'manager' and m.status = 'active'
  );
$$;

-- Source: migrations/0009_fix_cohort_rls_recursion.sql
create or replace function current_user_in_cohort(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cohort_memberships cm
    where cm.cohort_id = cid and cm.user_id = auth.uid()
  );
$$;
revoke all on function current_user_in_cohort(uuid) from public, anon;
grant execute on function current_user_in_cohort(uuid) to authenticated;

-- Active enrollment (and not expired/suspended) for a given course version content
create or replace function has_course_access(uid uuid, cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_active_user(uid) and exists (
    select 1 from enrollments e
    where e.learner_id = uid and e.course_id = cid
      and e.status in ('active','completed')
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

-- ---------- audit ----------
create or replace function write_audit(p_actor uuid, p_action text, p_type text, p_id text, p_meta jsonb default '{}', p_org uuid default null)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs(actor_id, action, entity_type, entity_id, organization_id, metadata)
  values (p_actor, p_action, p_type, p_id, p_org, coalesce(p_meta,'{}'::jsonb));
$$;

create or replace function trg_audit_user_roles() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform write_audit(auth.uid(), 'role.granted', 'user_role', new.user_id::text,
      jsonb_build_object('role_id', new.role_id, 'organization_id', new.organization_id));
    return new;
  else
    perform write_audit(auth.uid(), 'role.revoked', 'user_role', old.user_id::text,
      jsonb_build_object('role_id', old.role_id, 'organization_id', old.organization_id));
    return old;
  end if;
end $$;
create trigger trg_user_roles_audit after insert or delete on user_roles
  for each row execute function trg_audit_user_roles();

-- Block updates/deletes on audit rows for everybody except the table owner's migrations.
create or replace function trg_audit_immutable() returns trigger language plpgsql as $$
begin raise exception 'audit_logs is append-only'; end $$;
create trigger trg_audit_no_update before update or delete on audit_logs
  for each row execute function trg_audit_immutable();

-- ---------- new user bootstrap ----------
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare learner uuid;
begin
  insert into profiles(id, full_name, locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
          case when new.raw_user_meta_data->>'locale' in ('en','sw') then new.raw_user_meta_data->>'locale' else 'en' end);
  select id into learner from roles where key = 'learner';
  if learner is not null then insert into user_roles(user_id, role_id) values (new.id, learner); end if;
  insert into notification_preferences(user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- course authoring and governance ----------
-- Create a new course with its first draft (v1)
create or replace function create_course(p_title text, p_slug text, p_category uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; vid uuid;
begin
  if not has_permission(uid, 'course.create') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into courses(slug, category_id, owner_id) values (p_slug, p_category, uid) returning id into cid;
  insert into course_versions(course_id, version_number, title, created_by) values (cid, 1, p_title, uid) returning id into vid;
  insert into course_instructors(course_id, user_id, role) values (cid, uid, 'lead');
  perform write_audit(uid, 'course.created', 'course', cid::text, jsonb_build_object('slug', p_slug));
  return cid;
end $$;

-- Clone the published version into a new draft revision (never edits the published one)
create or replace function create_draft_revision(p_course uuid, p_summary text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); src uuid; nv uuid; n int; m record; nm uuid; l record; nl uuid;
begin
  if not (is_course_instructor(uid, p_course) and has_permission(uid, 'course.update.own')) and not has_permission(uid, 'course.update.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from course_versions where course_id = p_course and status in ('draft','in_review','changes_requested','approved')) then
    raise exception 'an open revision already exists';
  end if;
  select published_version_id into src from courses where id = p_course;
  if src is null then raise exception 'course has no published version'; end if;
  select coalesce(max(version_number),0)+1 into n from course_versions where course_id = p_course;

  insert into course_versions(course_id, version_number, status, title, subtitle, description, objectives, prerequisites,
      thumbnail_path, promo_video_url, language, level, estimated_minutes, accessibility_notes, enrollment_policy,
      price_cents, currency, pass_mark, certificate_enabled, seo_title, seo_description, change_summary, created_by)
  select course_id, n, 'draft', title, subtitle, description, objectives, prerequisites,
      thumbnail_path, promo_video_url, language, level, estimated_minutes, accessibility_notes, enrollment_policy,
      price_cents, currency, pass_mark, certificate_enabled, seo_title, seo_description, p_summary, uid
  from course_versions where id = src returning id into nv;

  for m in select * from modules where version_id = src order by position loop
    insert into modules(version_id, position, title, description) values (nv, m.position, m.title, m.description) returning id into nm;
    for l in select * from lessons where module_id = m.id order by position loop
      insert into lessons(module_id, position, type, title, body, duration_minutes, is_required, completion_rule)
      values (nm, l.position, l.type, l.title, l.body, l.duration_minutes, l.is_required, l.completion_rule) returning id into nl;
      insert into lesson_resources(lesson_id, title, kind, storage_path, url, mime_type, size_bytes)
        select nl, title, kind, storage_path, url, mime_type, size_bytes from lesson_resources where lesson_id = l.id;
      insert into quizzes(lesson_id, instructions, pass_mark, max_attempts, time_limit_seconds, shuffle_questions, show_results)
        select nl, instructions, pass_mark, max_attempts, time_limit_seconds, shuffle_questions, show_results from quizzes where lesson_id = l.id;
      insert into assignments(lesson_id, instructions, max_points, due_offset_days, allowed_mime_types, max_file_bytes)
        select nl, instructions, max_points, due_offset_days, allowed_mime_types, max_file_bytes from assignments where lesson_id = l.id;
      perform clone_quiz_questions(l.id, nl);
    end loop;
  end loop;
  perform write_audit(uid, 'course.revision_created', 'course_version', nv::text, jsonb_build_object('course_id', p_course, 'from', src));
  return nv;
end $$;

create or replace function clone_quiz_questions(p_old_lesson uuid, p_new_lesson uuid) returns void
language plpgsql security definer set search_path = public as $$
declare oq uuid; nq uuid; q record; o record; no uuid;
begin
  select id into oq from quizzes where lesson_id = p_old_lesson;
  select id into nq from quizzes where lesson_id = p_new_lesson;
  if oq is null or nq is null then return; end if;
  for q in select * from questions where quiz_id = oq order by position loop
    declare nqq uuid; begin
      insert into questions(quiz_id, position, type, prompt, points, explanation)
        values (nq, q.position, q.type, q.prompt, q.points, q.explanation) returning id into nqq;
      for o in select * from answer_options where question_id = q.id order by position loop
        insert into answer_options(question_id, position, label) values (nqq, o.position, o.label) returning id into no;
        insert into answer_keys(option_id, is_correct) select no, is_correct from answer_keys where option_id = o.id;
      end loop;
      insert into short_answer_keys(question_id, accepted) select nqq, accepted from short_answer_keys where question_id = q.id;
    end;
  end loop;
end $$;

-- Validation used before submission (no incomplete versions reach review)
create or replace function validate_version(p_version uuid) returns table(code text, message text)
language plpgsql stable security definer set search_path = public as $$
begin
  return query select 'title'::text, 'Title is required'::text from course_versions where id = p_version and length(trim(title)) = 0;
  return query select 'description', 'Description is required' from course_versions where id = p_version and coalesce(length(trim(description)),0) = 0;
  return query select 'objectives', 'Add at least one learning objective' from course_versions where id = p_version and cardinality(objectives) = 0;
  return query select 'modules', 'Add at least one module' where not exists (select 1 from modules where version_id = p_version);
  return query select 'empty_module', 'Module "' || m.title || '" has no lessons'
    from modules m where m.version_id = p_version and not exists (select 1 from lessons l where l.module_id = m.id);
  return query select 'quiz_empty', 'Quiz "' || l.title || '" has no questions'
    from lessons l join modules m on m.id = l.module_id
    where m.version_id = p_version and l.type = 'quiz'
      and not exists (select 1 from quizzes q join questions qq on qq.quiz_id = q.id where q.lesson_id = l.id);
  return query select 'quiz_key', 'A question in "' || l.title || '" has no correct answer'
    from lessons l join modules m on m.id = l.module_id
    join quizzes q on q.lesson_id = l.id join questions qq on qq.quiz_id = q.id
    where m.version_id = p_version and qq.type in ('single','multiple','true_false')
      and not exists (select 1 from answer_options ao join answer_keys ak on ak.option_id = ao.id where ao.question_id = qq.id and ak.is_correct);
end $$;

create or replace function submit_version(p_version uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v course_versions%rowtype; sid uuid;
begin
  select * into v from course_versions where id = p_version for update;
  if not found then raise exception 'not found'; end if;
  if not is_course_instructor(uid, v.course_id) or not has_permission(uid, 'course.submit') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v.status not in ('draft','changes_requested') then raise exception 'version is not editable (status %)', v.status; end if;
  if exists (select 1 from validate_version(p_version)) then raise exception 'version failed validation'; end if;
  update course_versions set status = 'in_review', submitted_at = now() where id = p_version;
  insert into course_submissions(version_id, submitted_by, note) values (p_version, uid, p_note) returning id into sid;
  perform write_audit(uid, 'course.submitted', 'course_version', p_version::text, jsonb_build_object('submission_id', sid));
  return sid;
end $$;

create or replace function review_submission(p_submission uuid, p_decision review_decision, p_summary text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s course_submissions%rowtype; v course_versions%rowtype; rid uuid;
begin
  select * into s from course_submissions where id = p_submission for update;
  if not found or s.status = 'closed' then raise exception 'submission not open'; end if;
  select * into v from course_versions where id = s.version_id for update;
  if not has_permission(uid, 'course.review.assigned') and not has_permission(uid, 'course.review.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if has_permission(uid, 'course.review.assigned') and not has_permission(uid, 'course.review.any')
     and s.assigned_reviewer_id is distinct from uid then
    raise exception 'not assigned to this review' using errcode = '42501';
  end if;
  -- no self-approval, ever
  if s.submitted_by = uid or is_course_instructor(uid, v.course_id) then
    raise exception 'authors cannot review their own course' using errcode = '42501';
  end if;
  insert into course_reviews(submission_id, reviewer_id, decision, summary) values (p_submission, uid, p_decision, p_summary) returning id into rid;
  update course_submissions set status = 'closed', closed_at = now() where id = p_submission;
  update course_versions set
    status = case p_decision when 'approved' then 'approved'::version_status else 'changes_requested'::version_status end,
    approved_at = case when p_decision = 'approved' then now() else null end
  where id = v.id;
  perform write_audit(uid, 'course.review_' || p_decision::text, 'course_version', v.id::text, jsonb_build_object('review_id', rid));
  insert into notifications(user_id, kind, title, body, href)
    values (s.submitted_by, 'review', 'Review: ' || p_decision::text, left(coalesce(p_summary,''), 280), '/instructor/courses/' || v.course_id || '/builder');
  return rid;
end $$;

create or replace function publish_version(p_version uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v course_versions%rowtype; old uuid;
begin
  select * into v from course_versions where id = p_version for update;
  if not found then raise exception 'not found'; end if;
  if not has_permission(uid, 'course.publish') then raise exception 'forbidden' using errcode = '42501'; end if;
  if v.status <> 'approved' then raise exception 'only approved versions can be published'; end if;
  if v.created_by = uid and not has_permission(uid, 'course.publish.own_override') then
    raise exception 'authors cannot publish their own revision' using errcode = '42501';
  end if;
  select published_version_id into old from courses where id = v.course_id for update;
  if old is not null then update course_versions set status = 'archived' where id = old; end if;
  update course_versions set status = 'published', published_at = now() where id = p_version;
  update courses set published_version_id = p_version, archived_at = null where id = v.course_id;
  insert into publication_events(course_id, version_id, action, actor_id) values (v.course_id, p_version, 'published', uid);
  perform write_audit(uid, 'course.published', 'course_version', p_version::text, jsonb_build_object('course_id', v.course_id, 'replaced', old));
end $$;

create or replace function unpublish_course(p_course uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v uuid;
begin
  if not has_permission(uid, 'course.unpublish') then raise exception 'forbidden' using errcode = '42501'; end if;
  select published_version_id into v from courses where id = p_course for update;
  update courses set archived_at = now() where id = p_course;   -- retire: no new enrollments, existing kept
  if v is not null then insert into publication_events(course_id, version_id, action, actor_id) values (p_course, v, 'archived', uid); end if;
  perform write_audit(uid, 'course.retired', 'course', p_course::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------- enrollment ----------
create or replace function enroll_self(p_course uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c courses%rowtype; v course_versions%rowtype; eid uuid;
begin
  if not is_active_user(uid) then raise exception 'account not active' using errcode = '42501'; end if;
  select * into c from courses where id = p_course;
  if not found or c.published_version_id is null or c.archived_at is not null then raise exception 'course unavailable'; end if;
  select * into v from course_versions where id = c.published_version_id;
  if v.available_from is not null and v.available_from > now() then raise exception 'course not yet available'; end if;
  if v.available_until is not null and v.available_until < now() then raise exception 'course no longer available'; end if;
  if c.visibility = 'organization' and not exists (
       select 1 from organization_memberships m where m.organization_id = c.organization_id and m.user_id = uid and m.status = 'active')
  then raise exception 'organization members only' using errcode = '42501'; end if;
  if v.enrollment_policy in ('invite_only','approval') then raise exception 'enrollment requires approval or invitation'; end if;
  if v.enrollment_policy = 'paid' or v.price_cents > 0 then
    if not exists (select 1 from entitlements e where e.user_id = uid and e.course_id = p_course and e.revoked_at is null
                   and (e.expires_at is null or e.expires_at > now())) then
      raise exception 'payment required' using errcode = '42501';
    end if;
  end if;
  insert into enrollments(learner_id, course_id, version_id, source)
  values (uid, p_course, v.id, case when v.price_cents > 0 then 'paid' else 'self' end)
  on conflict (learner_id, course_id) do update set status = 'active'
    where enrollments.status in ('cancelled','expired')
  returning id into eid;
  if eid is null then select id into eid from enrollments where learner_id = uid and course_id = p_course; end if;
  return eid;   -- idempotent: repeated calls return the same enrollment
end $$;

-- ---------- progress and completion ----------
create or replace function complete_lesson(p_enrollment uuid, p_lesson uuid, p_percent int default 100) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e enrollments%rowtype; l lessons%rowtype; rule text; ok boolean := true;
begin
  select * into e from enrollments where id = p_enrollment;
  if not found or e.learner_id <> uid or not has_course_access(uid, e.course_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select l2.* into l from lessons l2 join modules m on m.id = l2.module_id where l2.id = p_lesson and m.version_id = e.version_id;
  if not found then raise exception 'lesson not in enrolled version'; end if;
  rule := l.completion_rule->>'mode';
  if rule = 'watch_percent' then ok := p_percent >= coalesce((l.completion_rule->>'threshold')::int, 90);
  elsif rule = 'quiz_pass' then
    ok := exists (select 1 from quiz_attempts a join quizzes q on q.id = a.quiz_id where q.lesson_id = p_lesson and a.enrollment_id = p_enrollment and a.passed);
  elsif rule = 'submission' then
    ok := exists (select 1 from submissions s join assignments a on a.id = s.assignment_id where a.lesson_id = p_lesson and s.enrollment_id = p_enrollment);
  elsif rule = 'attendance' then ok := false;   -- recorded by instructors only
  end if;
  if not ok then
    insert into lesson_progress(enrollment_id, lesson_id, status, watched_percent) values (p_enrollment, p_lesson, 'in_progress', p_percent)
    on conflict (enrollment_id, lesson_id) do update set watched_percent = greatest(lesson_progress.watched_percent, excluded.watched_percent), updated_at = now()
      where lesson_progress.status <> 'completed';
    return;
  end if;
  insert into lesson_progress(enrollment_id, lesson_id, status, watched_percent, completed_at)
  values (p_enrollment, p_lesson, 'completed', 100, now())
  on conflict (enrollment_id, lesson_id) do update set status = 'completed', watched_percent = 100,
      completed_at = coalesce(lesson_progress.completed_at, now()), updated_at = now();   -- idempotent
  perform recalc_completion(p_enrollment);
end $$;

create or replace function recalc_completion(p_enrollment uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare e enrollments%rowtype; required_total int; required_done int; score numeric;
begin
  select * into e from enrollments where id = p_enrollment for update;
  select count(*) into required_total from lessons l join modules m on m.id = l.module_id where m.version_id = e.version_id and l.is_required;
  select count(*) into required_done from lesson_progress p join lessons l on l.id = p.lesson_id join modules m on m.id = l.module_id
    where p.enrollment_id = p_enrollment and p.status = 'completed' and m.version_id = e.version_id and l.is_required;
  if required_total > 0 and required_done >= required_total then
    select avg(best) into score from (
      select max(a.score) as best from quiz_attempts a where a.enrollment_id = p_enrollment and a.status = 'submitted' group by a.quiz_id) t;
    insert into course_completions(enrollment_id, version_id, final_score) values (p_enrollment, e.version_id, score)
      on conflict (enrollment_id) do nothing;
    update enrollments set status = 'completed', completed_at = coalesce(completed_at, now()) where id = p_enrollment and status = 'active';
    return true;
  end if;
  return false;
end $$;

-- ---------- assessment: server-side attempts and grading ----------
create or replace function start_quiz_attempt(p_enrollment uuid, p_quiz uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e enrollments%rowtype; q quizzes%rowtype; n int; aid uuid; ord uuid[];
begin
  select * into e from enrollments where id = p_enrollment;
  if not found or e.learner_id <> uid or not has_course_access(uid, e.course_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select qz.* into q from quizzes qz join lessons l on l.id = qz.lesson_id join modules m on m.id = l.module_id
    where qz.id = p_quiz and m.version_id = e.version_id;
  if not found then raise exception 'quiz not in enrolled version'; end if;
  -- resume an unexpired in-progress attempt rather than burning attempts
  select id into aid from quiz_attempts where quiz_id = p_quiz and learner_id = uid and status = 'in_progress'
     and (expires_at is null or expires_at > now());
  if aid is not null then return aid; end if;
  update quiz_attempts set status = 'expired' where quiz_id = p_quiz and learner_id = uid and status = 'in_progress';
  select coalesce(max(attempt_number),0)+1 into n from quiz_attempts where quiz_id = p_quiz and learner_id = uid;
  if q.max_attempts is not null and n > q.max_attempts then raise exception 'attempt limit reached'; end if;
  select array_agg(id order by case when q.shuffle_questions then random() else position end) into ord from questions where quiz_id = p_quiz;
  insert into quiz_attempts(quiz_id, enrollment_id, learner_id, attempt_number, expires_at, question_order)
  values (p_quiz, p_enrollment, uid, n, case when q.time_limit_seconds is not null then now() + make_interval(secs => q.time_limit_seconds + 5) end, coalesce(ord,'{}'))
  returning id into aid;
  return aid;
end $$;

-- p_answers: [{"question_id": "...", "option_ids": ["..."], "text": "..."}]
create or replace function submit_quiz_attempt(p_attempt uuid, p_answers jsonb)
returns table(score numeric, passed boolean, show_results text) language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); a quiz_attempts%rowtype; q quizzes%rowtype; ans jsonb; qq questions%rowtype;
        sel uuid[]; correct uuid[]; ok boolean; pts numeric; total numeric := 0; earned numeric := 0; sc numeric; pass boolean;
begin
  select * into a from quiz_attempts where id = p_attempt for update;
  if not found or a.learner_id <> uid then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status <> 'in_progress' then raise exception 'attempt already closed'; end if;
  if a.expires_at is not null and a.expires_at < now() then
    update quiz_attempts set status = 'expired' where id = p_attempt; raise exception 'attempt expired';
  end if;
  select * into q from quizzes where id = a.quiz_id;
  for qq in select * from questions where quiz_id = a.quiz_id loop
    total := total + qq.points;
    select x into ans from jsonb_array_elements(p_answers) x where (x->>'question_id')::uuid = qq.id limit 1;
    sel := coalesce(array(select (jsonb_array_elements_text(ans->'option_ids'))::uuid), '{}');
    -- restrict selections to this question's own options
    sel := coalesce(array(select o.id from answer_options o where o.question_id = qq.id and o.id = any(sel)), '{}');
    ok := false;
    if qq.type in ('single','multiple','true_false') then
      select coalesce(array_agg(o.id order by o.id), '{}') into correct from answer_options o join answer_keys k on k.option_id = o.id
        where o.question_id = qq.id and k.is_correct;
      ok := (select coalesce(array_agg(s order by s), '{}') from unnest(sel) s) = correct and cardinality(correct) > 0;
    else
      ok := exists (select 1 from short_answer_keys k where k.question_id = qq.id
                    and lower(trim(ans->>'text')) = any (select lower(trim(v)) from unnest(k.accepted) v));
    end if;
    pts := case when ok then qq.points else 0 end;
    earned := earned + pts;
    insert into quiz_responses(attempt_id, question_id, selected_option_ids, text_answer, is_correct, points_awarded)
    values (p_attempt, qq.id, sel, left(ans->>'text', 2000), ok, pts)
    on conflict (attempt_id, question_id) do update set selected_option_ids = excluded.selected_option_ids,
       text_answer = excluded.text_answer, is_correct = excluded.is_correct, points_awarded = excluded.points_awarded;
  end loop;
  sc := case when total = 0 then 0 else round(earned / total * 100, 2) end;
  pass := sc >= q.pass_mark;
  update quiz_attempts set status = 'submitted', submitted_at = now(), score = sc, passed = pass where id = p_attempt;
  return query select sc, pass, q.show_results;
end $$;

create or replace function grade_submission(p_submission uuid, p_points numeric, p_feedback text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s submissions%rowtype; cid uuid; g grades%rowtype; maxp int;
begin
  select * into s from submissions where id = p_submission;
  select m.version_id into cid from assignments a join lessons l on l.id = a.lesson_id join modules m on m.id = l.module_id where a.id = s.assignment_id;
  select c.course_id, a.max_points into cid, maxp from course_versions c, assignments a
    where c.id = cid and a.id = s.assignment_id;
  if not (is_course_instructor(uid, cid) and has_permission(uid, 'grade.write.assigned')) and not has_permission(uid, 'grade.write.any') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_points > maxp then raise exception 'points exceed maximum'; end if;
  select * into g from grades where submission_id = p_submission;
  if found and g.finalized and not has_permission(uid, 'grade.override') then raise exception 'grade is finalized' using errcode = '42501'; end if;
  insert into grades(submission_id, grader_id, points, feedback) values (p_submission, uid, p_points, p_feedback)
  on conflict (submission_id) do update set grader_id = uid, points = p_points, feedback = p_feedback, updated_at = now();
  insert into grade_events(submission_id, actor_id, old_points, new_points, reason) values (p_submission, uid, g.points, p_points, p_reason);
  update submissions set status = 'graded' where id = p_submission;
  perform write_audit(uid, 'grade.changed', 'submission', p_submission::text, jsonb_build_object('old', g.points, 'new', p_points));
end $$;

-- ---------- certificates ----------
create or replace function issue_certificate(p_enrollment uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); e enrollments%rowtype; v course_versions%rowtype; cid uuid; serial text; nm text; comp course_completions%rowtype;
begin
  select * into e from enrollments where id = p_enrollment for update;
  if not found then raise exception 'not found'; end if;
  if e.learner_id <> uid and not has_permission(uid, 'certificate.issue') then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into comp from course_completions where enrollment_id = p_enrollment;
  if not found then raise exception 'course not completed'; end if;
  select * into v from course_versions where id = e.version_id;
  if not v.certificate_enabled then raise exception 'certificates disabled for this course'; end if;
  if comp.final_score is not null and comp.final_score < v.pass_mark then raise exception 'pass mark not met'; end if;
  select id into cid from certificates where enrollment_id = p_enrollment and status = 'valid';
  if cid is not null then return cid; end if;   -- idempotent
  select full_name into nm from profiles where id = e.learner_id;
  serial := 'CRT-' || to_char(now(),'YYYY') || '-' || upper(substr(encode(gen_random_bytes(6),'hex'),1,10));
  insert into certificates(serial, enrollment_id, learner_id, course_id, version_id, learner_name, course_title)
  values (serial, p_enrollment, e.learner_id, e.course_id, e.version_id, nm, v.title) returning id into cid;
  insert into certificate_events(certificate_id, action, actor_id) values (cid, 'issued', uid);
  perform write_audit(uid, 'certificate.issued', 'certificate', cid::text, jsonb_build_object('serial', serial));
  insert into jobs(kind, payload) values ('generate_certificate_pdf', jsonb_build_object('certificate_id', cid));
  return cid;
end $$;

create or replace function revoke_certificate(p_certificate uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not has_permission(uid, 'certificate.revoke') then raise exception 'forbidden' using errcode = '42501'; end if;
  update certificates set status = 'revoked', revoked_at = now() where id = p_certificate and status = 'valid';
  insert into certificate_events(certificate_id, action, actor_id, reason) values (p_certificate, 'revoked', uid, p_reason);
  perform write_audit(uid, 'certificate.revoked', 'certificate', p_certificate::text, jsonb_build_object('reason', p_reason));
end $$;

-- Public verification: exposes only what a verifier needs
create or replace function verify_certificate(p_serial text)
returns table(serial text, learner_name text, course_title text, issued_at timestamptz, status cert_status)
language sql stable security definer set search_path = public as $$
  select c.serial, c.learner_name, c.course_title, c.issued_at, c.status from certificates c where c.serial = upper(p_serial);
$$;
grant execute on function verify_certificate(text) to anon, authenticated;

-- ---------- account suspension ----------
create or replace function suspend_user(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not has_permission(uid, 'user.suspend') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = uid then raise exception 'cannot suspend yourself'; end if;
  if exists (select 1 from user_roles ur join roles r on r.id = ur.role_id where ur.user_id = p_user and r.key = 'owner')
     and not has_permission(uid, 'owner.manage') then raise exception 'cannot suspend an owner' using errcode = '42501'; end if;
  update profiles set status = 'suspended', suspended_reason = p_reason, suspended_at = now() where id = p_user;
  update enrollments set status = 'suspended' where learner_id = p_user and status = 'active';
  perform write_audit(uid, 'user.suspended', 'user', p_user::text, jsonb_build_object('reason', p_reason));
  insert into notifications(user_id, kind, title, body) values (p_user, 'security', 'Your account was suspended', p_reason);
  -- Session revocation happens in the app layer with the service role (auth.admin.signOut); see services/admin.ts
end $$;

create or replace function reinstate_user(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if not has_permission(uid, 'user.suspend') then raise exception 'forbidden' using errcode = '42501'; end if;
  update profiles set status = 'active', suspended_reason = null, suspended_at = null where id = p_user;
  update enrollments set status = 'active' where learner_id = p_user and status = 'suspended';
  perform write_audit(uid, 'user.reinstated', 'user', p_user::text);
end $$;

create or replace function assign_role(p_user uuid, p_role_key text, p_org uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r roles%rowtype;
begin
  select * into r from roles where key = p_role_key;
  if not found then raise exception 'unknown role'; end if;
  if r.is_privileged then
    if not has_permission(uid, 'role.assign.privileged') then raise exception 'forbidden' using errcode = '42501'; end if;
  elsif not has_permission(uid, 'role.assign') then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into user_roles(user_id, role_id, organization_id, granted_by) values (p_user, r.id, p_org, uid) on conflict do nothing;
end $$;

create or replace function remove_role(p_user uuid, p_role_key text, p_org uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r roles%rowtype;
begin
  select * into r from roles where key = p_role_key;
  if r.is_privileged and not has_permission(uid, 'role.assign.privileged') then raise exception 'forbidden' using errcode = '42501'; end if;
  if not r.is_privileged and not has_permission(uid, 'role.assign') then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from user_roles where user_id = p_user and role_id = r.id and coalesce(organization_id,'00000000-0000-0000-0000-000000000000') = coalesce(p_org,'00000000-0000-0000-0000-000000000000');
end $$;

-- ---------- payments (called by the verified webhook handler with the service role) ----------
create or replace function apply_payment_event(p_provider text, p_event_id text, p_order uuid, p_amount int, p_status text, p_raw jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare o orders%rowtype; inserted int;
begin
  insert into payments(order_id, provider, provider_event_id, amount_cents, status, raw)
  values (p_order, p_provider, p_event_id, p_amount, p_status, coalesce(p_raw,'{}'))
  on conflict (provider, provider_event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate'; end if;           -- duplicate delivery
  select * into o from orders where id = p_order for update;
  if not found then return 'unknown_order'; end if;
  if p_status = 'paid' and o.status in ('pending','failed') then
    if p_amount < o.amount_cents then return 'amount_mismatch'; end if;
    update orders set status = 'paid' where id = o.id;
    insert into entitlements(user_id, course_id, source, source_id) values (o.learner_id, o.course_id, 'order', o.id)
      on conflict (user_id, course_id) do update set revoked_at = null, source_id = o.id;
    insert into notifications(user_id, kind, title, href) values (o.learner_id, 'payment', 'Payment received', '/courses');
    return 'applied';
  elsif p_status = 'failed' and o.status = 'pending' then
    update orders set status = 'failed' where id = o.id; return 'applied';
  elsif p_status = 'refunded' and o.status in ('paid','partially_refunded') then   -- out-of-order tolerant
    update orders set status = 'refunded' where id = o.id;
    update entitlements set revoked_at = now() where source_id = o.id;
    return 'applied';
  end if;
  return 'ignored';
end $$;
revoke execute on function apply_payment_event(text,text,uuid,int,text,jsonb) from public, anon, authenticated;

-- ---------- jobs queue ----------
create or replace function claim_jobs(p_limit int default 10) returns setof jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
  update jobs set status = 'running', locked_at = now(), attempts = attempts + 1
  where id in (select id from jobs where status = 'queued' and run_at <= now() order by run_at for update skip locked limit p_limit)
  returning *;
end $$;
revoke execute on function claim_jobs(int) from public, anon, authenticated;

create or replace function finish_job(p_job uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = public as $$
declare j jobs%rowtype;
begin
  select * into j from jobs where id = p_job;
  if p_ok then update jobs set status = 'succeeded', locked_at = null where id = p_job;
  elsif j.attempts >= j.max_attempts then update jobs set status = 'dead', last_error = p_error, locked_at = null where id = p_job;
  else update jobs set status = 'queued', last_error = p_error, locked_at = null, run_at = now() + (power(2, j.attempts) * interval '30 seconds') where id = p_job;
  end if;
end $$;
revoke execute on function finish_job(uuid,boolean,text) from public, anon, authenticated;

-- =====================================================================
-- Source: migrations/0003_rls.sql
-- =====================================================================
-- =====================================================================
-- 0003 Row Level Security and least-privilege grants
-- RLS is a second enforcement layer; the app layer verifies permissions too.
-- =====================================================================

-- Internal helpers must not be callable from the browser
revoke execute on function write_audit(uuid,text,text,text,jsonb,uuid) from public, anon, authenticated;
revoke execute on function clone_quiz_questions(uuid,uuid) from public, anon, authenticated;
revoke execute on function recalc_completion(uuid) from public, anon, authenticated;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Browser roles get only DML; policies decide rows. Sensitive tables get no browser grants at all.
revoke all on all tables in schema public from anon, authenticated;
grant select on categories, tags, courses, course_versions, modules, lessons, lesson_resources, course_tags,
                learning_paths, learning_path_courses, course_instructors to anon, authenticated;
grant select, insert, update, delete on profiles, courses, course_versions, modules, lessons, lesson_resources, quizzes, questions,
                answer_options, assignments, course_instructors to authenticated;
grant select on roles, permissions, role_permissions, user_roles, organizations, organization_memberships, enrollments,
                lesson_progress, course_completions, quiz_attempts, quiz_responses, submissions, grades, certificates,
                orders, entitlements, cohorts, cohort_memberships, cohort_course_assignments, course_submissions,
                course_reviews, review_comments, publication_events, audit_logs, support_tickets, support_messages,
                notifications, notification_preferences, data_export_requests, course_evaluations, jobs, settings to authenticated;
grant insert on submissions, support_tickets, support_messages, data_export_requests, course_evaluations to authenticated;
grant update on notifications, notification_preferences to authenticated;
-- NOTE: answer_keys, short_answer_keys, payments, refunds, grade_events, certificate_events get NO browser grants
-- (service role / security definer functions only).

-- ---------- identity ----------
create policy profiles_self_read on profiles for select to authenticated using (id = auth.uid());
create policy profiles_staff_read on profiles for select to authenticated
  using (current_user_has('user.read') or current_user_has('support.read_learner'));
create policy profiles_instructor_read on profiles for select to authenticated using (
  exists (select 1 from enrollments e join course_instructors ci on ci.course_id = e.course_id
          where e.learner_id = profiles.id and ci.user_id = auth.uid()));
create policy profiles_org_manager_read on profiles for select to authenticated using (
  exists (select 1 from organization_memberships m where m.user_id = profiles.id and is_org_manager(auth.uid(), m.organization_id)));
-- Users may edit only harmless columns; status/suspension are protected by a column grant below.
create policy profiles_self_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on profiles from authenticated;
grant update (full_name, display_name, avatar_url, bio, locale, timezone) on profiles to authenticated;
revoke insert, delete on profiles from authenticated;

create policy roles_read on roles for select to authenticated using (true);
create policy permissions_read on permissions for select to authenticated using (true);
create policy role_permissions_read on role_permissions for select to authenticated using (true);
create policy user_roles_self on user_roles for select to authenticated using (user_id = auth.uid());
create policy user_roles_admin on user_roles for select to authenticated using (current_user_has('role.read'));

create policy orgs_member on organizations for select to authenticated using (
  exists (select 1 from organization_memberships m where m.organization_id = organizations.id and m.user_id = auth.uid()) or current_user_has('org.read.any'));
create policy org_members_self on organization_memberships for select to authenticated using (user_id = auth.uid());
create policy org_members_manager on organization_memberships for select to authenticated using (
  is_org_manager(auth.uid(), organization_id) or current_user_has('org.read.any'));

-- ---------- catalog (public reads of published content only) ----------
create policy categories_read on categories for select using (true);
create policy tags_read on tags for select using (true);
create policy course_tags_read on course_tags for select using (true);

create policy courses_public_read on courses for select using (
  published_version_id is not null and archived_at is null and visibility in ('public','unlisted'));
create policy courses_enrolled_read on courses for select to authenticated using (has_course_access(auth.uid(), id));
create policy courses_team_read on courses for select to authenticated using (
  is_course_instructor(auth.uid(), id) or current_user_has('course.read.any')
  or (organization_id is not null and exists (select 1 from organization_memberships m where m.organization_id = courses.organization_id and m.user_id = auth.uid() and m.status = 'active')));
create policy courses_insert on courses for insert to authenticated with check (owner_id = auth.uid() and current_user_has('course.create'));
create policy courses_update on courses for update to authenticated
  using ((is_course_instructor(auth.uid(), id) and current_user_has('course.update.own')) or current_user_has('course.update.any'));

-- Versions: published ones are public; drafts only to the team/reviewers; learners see the version they enrolled in.
create policy cv_published_read on course_versions for select using (
  exists (select 1 from courses c where c.published_version_id = course_versions.id and c.archived_at is null));
create policy cv_enrolled_read on course_versions for select to authenticated using (
  exists (select 1 from enrollments e where e.version_id = course_versions.id and e.learner_id = auth.uid() and e.status in ('active','completed')));
create policy cv_team_read on course_versions for select to authenticated using (
  is_course_instructor(auth.uid(), course_id) or current_user_has('course.read.any')
  or (current_user_has('course.review.assigned') and exists (select 1 from course_submissions s where s.version_id = course_versions.id and s.assigned_reviewer_id = auth.uid())));
-- Only drafts / changes_requested are writable by authors, never in_review/approved/published.
create policy cv_author_write on course_versions for update to authenticated
  using (status in ('draft','changes_requested') and is_course_instructor(auth.uid(), course_id) and current_user_has('course.update.own'))
  with check (status in ('draft','changes_requested'));
-- status transitions only through SECURITY DEFINER functions:
revoke update (status, approved_at, published_at, submitted_at, created_by, course_id, version_number) on course_versions from authenticated;
revoke insert, delete on course_versions from authenticated;

create or replace function version_is_editable(vid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_versions v where v.id = vid and v.status in ('draft','changes_requested')
     and (is_course_instructor(auth.uid(), v.course_id) and has_permission(auth.uid(),'course.update.own')));
$$;
create or replace function version_is_readable(vid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from course_versions v join courses c on c.id = v.course_id where v.id = vid and (
     c.published_version_id = v.id
     or is_course_instructor(auth.uid(), v.course_id) or has_permission(auth.uid(),'course.read.any')
     or exists (select 1 from enrollments e where e.version_id = v.id and e.learner_id = auth.uid() and e.status in ('active','completed'))
     or exists (select 1 from course_submissions s where s.version_id = v.id and s.assigned_reviewer_id = auth.uid())));
$$;
create or replace function module_version(mid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select version_id from modules where id = mid; $$;
create or replace function lesson_version(lid uuid) returns uuid language sql stable security definer set search_path = public as $$
  select m.version_id from lessons l join modules m on m.id = l.module_id where l.id = lid; $$;

create policy modules_read on modules for select using (version_is_readable(version_id));
create policy modules_write on modules for all to authenticated using (version_is_editable(version_id)) with check (version_is_editable(version_id));
create policy lessons_read on lessons for select using (version_is_readable(module_version(module_id)));
create policy lessons_write on lessons for all to authenticated using (version_is_editable(module_version(module_id))) with check (version_is_editable(module_version(module_id)));
create policy resources_read on lesson_resources for select using (version_is_readable(lesson_version(lesson_id)));
create policy resources_write on lesson_resources for all to authenticated using (version_is_editable(lesson_version(lesson_id))) with check (version_is_editable(lesson_version(lesson_id)));
create policy ci_read on course_instructors for select using (true);
create policy ci_write on course_instructors for all to authenticated
  using (current_user_has('course.update.any')) with check (current_user_has('course.update.any'));

create policy paths_read on learning_paths for select using (status = 'published');
create policy path_courses_read on learning_path_courses for select using (true);

-- ---------- quizzes: structure readable, keys never ----------
create policy quizzes_read on quizzes for select to authenticated using (version_is_readable(lesson_version(lesson_id)));
create policy quizzes_write on quizzes for all to authenticated using (version_is_editable(lesson_version(lesson_id))) with check (version_is_editable(lesson_version(lesson_id)));
create policy questions_read on questions for select to authenticated using (exists (select 1 from quizzes q where q.id = quiz_id and version_is_readable(lesson_version(q.lesson_id))));
create policy questions_write on questions for all to authenticated using (exists (select 1 from quizzes q where q.id = quiz_id and version_is_editable(lesson_version(q.lesson_id))));
create policy options_read on answer_options for select to authenticated using (exists (select 1 from questions qq join quizzes q on q.id = qq.quiz_id where qq.id = question_id and version_is_readable(lesson_version(q.lesson_id))));
create policy options_write on answer_options for all to authenticated using (exists (select 1 from questions qq join quizzes q on q.id = qq.quiz_id where qq.id = question_id and version_is_editable(lesson_version(q.lesson_id))));
create policy assignments_read on assignments for select to authenticated using (version_is_readable(lesson_version(lesson_id)));
create policy assignments_write on assignments for all to authenticated using (version_is_editable(lesson_version(lesson_id))) with check (version_is_editable(lesson_version(lesson_id)));

-- ---------- governance ----------
create policy submissions_gov_read on course_submissions for select to authenticated using (
  submitted_by = auth.uid() or assigned_reviewer_id = auth.uid() or current_user_has('course.review.any'));
create policy reviews_read on course_reviews for select to authenticated using (
  reviewer_id = auth.uid() or current_user_has('course.review.any')
  or exists (select 1 from course_submissions s where s.id = submission_id and s.submitted_by = auth.uid()));
create policy review_comments_read on review_comments for select to authenticated using (
  author_id = auth.uid() or current_user_has('course.review.any')
  or exists (select 1 from course_submissions s where s.id = submission_id and (s.submitted_by = auth.uid() or s.assigned_reviewer_id = auth.uid())));
create policy pubevents_read on publication_events for select to authenticated using (current_user_has('course.read.any') or is_course_instructor(auth.uid(), course_id));
create policy audit_read on audit_logs for select to authenticated using (current_user_has('audit.read'));
-- review_comments insert is performed through the server (service role) after authorization checks.

-- ---------- learning ----------
create policy enroll_self on enrollments for select to authenticated using (learner_id = auth.uid());
create policy enroll_instructor on enrollments for select to authenticated using (is_course_instructor(auth.uid(), course_id));
create policy enroll_admin on enrollments for select to authenticated using (current_user_has('enrollment.read.any'));
create policy enroll_org on enrollments for select to authenticated using (
  exists (select 1 from cohorts c where c.id = enrollments.cohort_id and is_org_manager(auth.uid(), c.organization_id)));
create policy progress_self on lesson_progress for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy progress_instructor on lesson_progress for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
create policy completions_self on course_completions for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy completions_staff on course_completions for select to authenticated using (current_user_has('report.read') or exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
create policy attempts_self on quiz_attempts for select to authenticated using (learner_id = auth.uid());
create policy attempts_instructor on quiz_attempts for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
-- Responses carry is_correct; only expose after the quiz policy allows it (server action filters) -> instructor/self read of own graded attempts
create policy responses_self on quiz_responses for select to authenticated using (exists (select 1 from quiz_attempts a join quizzes q on q.id = a.quiz_id where a.id = attempt_id and a.learner_id = auth.uid() and a.status = 'submitted' and q.show_results = 'immediate'));
create policy responses_instructor on quiz_responses for select to authenticated using (exists (select 1 from quiz_attempts a join enrollments e on e.id = a.enrollment_id where a.id = attempt_id and is_course_instructor(auth.uid(), e.course_id)));

create policy submissions_self on submissions for select to authenticated using (learner_id = auth.uid());
create policy submissions_instructor on submissions for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and is_course_instructor(auth.uid(), e.course_id)));
create policy submissions_insert on submissions for insert to authenticated with check (learner_id = auth.uid() and exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid() and has_course_access(auth.uid(), e.course_id)));
create policy grades_self on grades for select to authenticated using (exists (select 1 from submissions s where s.id = submission_id and s.learner_id = auth.uid()));
create policy grades_instructor on grades for select to authenticated using (exists (select 1 from submissions s join enrollments e on e.id = s.enrollment_id where s.id = submission_id and is_course_instructor(auth.uid(), e.course_id)));
create policy evals_self on course_evaluations for select to authenticated using (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid()));
create policy evals_insert on course_evaluations for insert to authenticated with check (exists (select 1 from enrollments e where e.id = enrollment_id and e.learner_id = auth.uid() and e.status = 'completed'));

create policy certs_self on certificates for select to authenticated using (learner_id = auth.uid());
create policy certs_staff on certificates for select to authenticated using (current_user_has('certificate.read.any'));
create policy orders_self on orders for select to authenticated using (learner_id = auth.uid());
create policy orders_finance on orders for select to authenticated using (current_user_has('finance.read'));
create policy entitlements_self on entitlements for select to authenticated using (user_id = auth.uid());

-- ---------- organizations ----------
-- Latest cohort membership policy from migrations/0009_fix_cohort_rls_recursion.sql
create policy cohorts_member on cohorts for select to authenticated using (
  is_org_manager(auth.uid(), organization_id) or current_user_has('org.read.any')
  or current_user_in_cohort(id));
create policy cohort_members_read on cohort_memberships for select to authenticated using (
  user_id = auth.uid() or exists (select 1 from cohorts c where c.id = cohort_id and is_org_manager(auth.uid(), c.organization_id)));
create policy cohort_assign_read on cohort_course_assignments for select to authenticated using (
  exists (select 1 from cohorts c where c.id = cohort_id and (is_org_manager(auth.uid(), c.organization_id)
     or exists (select 1 from cohort_memberships cm where cm.cohort_id = c.id and cm.user_id = auth.uid()))));

-- ---------- operations ----------
create policy notifications_self on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on notifications from authenticated; grant update (read_at) on notifications to authenticated;
create policy notif_prefs_self on notification_preferences for select to authenticated using (user_id = auth.uid());
create policy notif_prefs_update on notification_preferences for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tickets_self on support_tickets for select to authenticated using (requester_id = auth.uid());
create policy tickets_agent on support_tickets for select to authenticated using (current_user_has('support.read'));
create policy tickets_insert on support_tickets for insert to authenticated with check (requester_id = auth.uid());
create policy tmsg_read on support_messages for select to authenticated using (
  (not internal and exists (select 1 from support_tickets t where t.id = ticket_id and t.requester_id = auth.uid())) or current_user_has('support.read'));
create policy tmsg_insert on support_messages for insert to authenticated with check (author_id = auth.uid() and not internal
  and exists (select 1 from support_tickets t where t.id = ticket_id and t.requester_id = auth.uid()));
create policy export_self on data_export_requests for select to authenticated using (user_id = auth.uid());
create policy export_insert on data_export_requests for insert to authenticated with check (user_id = auth.uid() and status = 'requested');
create policy jobs_admin on jobs for select to authenticated using (current_user_has('ops.read'));
create policy settings_admin on settings for select to authenticated using (current_user_has('settings.read'));

-- =====================================================================
-- STORAGE: public thumbnails, private everything else (signed URLs only)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('course-public',   'course-public',   true,  5242880,  array['image/png','image/jpeg','image/webp']),
  ('course-private',  'course-private',  false, 104857600, array['application/pdf','image/png','image/jpeg','video/mp4','text/plain','application/zip']),
  ('assignments',     'assignments',     false, 10485760, array['application/pdf','image/png','image/jpeg','text/plain']),
  ('certificates',    'certificates',    false, 2097152,  array['application/pdf']),
  ('admin-docs',      'admin-docs',      false, 20971520, array['application/pdf','text/csv'])
on conflict (id) do nothing;

-- Paths: {course_id}/... for course buckets, {learner_id}/... for assignments
create policy "public thumbnails read" on storage.objects for select using (bucket_id = 'course-public');
create policy "authors upload thumbnails" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-public' and is_course_instructor(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "authors manage private materials" on storage.objects for all to authenticated
  using (bucket_id = 'course-private' and is_course_instructor(auth.uid(), ((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'course-private' and is_course_instructor(auth.uid(), ((storage.foldername(name))[1])::uuid));
create policy "learners upload own assignments" on storage.objects for insert to authenticated
  with check (bucket_id = 'assignments' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "learners read own assignments" on storage.objects for select to authenticated
  using (bucket_id = 'assignments' and (storage.foldername(name))[1] = auth.uid()::text);
-- Reads of private course files and instructor access to submissions are done by the server via short-lived
-- signed URLs AFTER app-level authorization (see src/services/storage.ts). No broad browser read policy exists.

-- =====================================================================
-- Source: migrations/0004_seed.sql
-- =====================================================================
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

-- =====================================================================
-- Source: migrations/0005_extras.sql
-- =====================================================================
-- 0005 Extras: ordering, organization operations, bulk enrollment, reporting views

create or replace function swap_positions(p_table text, p_a uuid, p_b uuid) returns void
language plpgsql security definer set search_path = public as $$
declare vid uuid; pa int; pb int;
begin
  if p_table = 'modules' then
    select version_id, position into vid, pa from modules where id = p_a;
    select position into pb from modules where id = p_b and version_id = vid;
  elsif p_table = 'lessons' then
    select module_version(module_id), position into vid, pa from lessons where id = p_a;
    select position into pb from lessons where id = p_b and module_id = (select module_id from lessons where id = p_a);
  else raise exception 'invalid table'; end if;
  if pb is null or not version_is_editable(vid) then raise exception 'forbidden' using errcode = '42501'; end if;
  set constraints all deferred;
  if p_table = 'modules' then
    update modules set position = pb where id = p_a; update modules set position = pa where id = p_b;
  else
    update lessons set position = pb where id = p_a; update lessons set position = pa where id = p_b;
  end if;
end $$;

-- Organization manager: create cohort, add members, assign approved (published) courses.
create or replace function org_assign_course(p_cohort uuid, p_course uuid, p_due date default null) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); org uuid; c courses%rowtype; n int := 0; m record; vid uuid;
begin
  select organization_id into org from cohorts where id = p_cohort;
  if org is null or not is_org_manager(uid, org) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into c from courses where id = p_course;
  if c.published_version_id is null or c.archived_at is not null then raise exception 'course is not approved for assignment'; end if;
  if c.organization_id is not null and c.organization_id <> org then raise exception 'course belongs to another organization' using errcode = '42501'; end if;
  insert into cohort_course_assignments(cohort_id, course_id, due_on, assigned_by) values (p_cohort, p_course, p_due, uid)
    on conflict (cohort_id, course_id) do update set due_on = excluded.due_on;
  vid := c.published_version_id;
  for m in select cm.user_id from cohort_memberships cm join profiles p on p.id = cm.user_id and p.status = 'active' where cm.cohort_id = p_cohort loop
    insert into enrollments(learner_id, course_id, version_id, source, cohort_id) values (m.user_id, p_course, vid, 'cohort', p_cohort)
      on conflict (learner_id, course_id) do nothing;
    n := n + 1;
  end loop;
  perform write_audit(uid, 'org.course_assigned', 'cohort', p_cohort::text, jsonb_build_object('course_id', p_course, 'learners', n), org);
  return n;
end $$;

create or replace function org_add_member(p_org uuid, p_email text, p_cohort uuid default null, p_type text default 'learner') returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid;
begin
  if not is_org_manager(uid, p_org) then raise exception 'forbidden' using errcode = '42501'; end if;
  select id into target from auth.users where lower(email) = lower(p_email);
  if target is null then raise exception 'No account with that email. Ask the person to register first.'; end if;
  if p_type = 'manager' then raise exception 'only platform admins can add managers' using errcode = '42501'; end if;
  insert into organization_memberships(organization_id, user_id, member_type) values (p_org, target, p_type)
    on conflict (organization_id, user_id) do update set status = 'active';
  if p_cohort is not null then
    if not exists (select 1 from cohorts where id = p_cohort and organization_id = p_org) then raise exception 'cohort is in another organization' using errcode = '42501'; end if;
    insert into cohort_memberships(cohort_id, user_id) values (p_cohort, target) on conflict do nothing;
  end if;
  return target;
end $$;

create or replace function org_create_cohort(p_org uuid, p_name text, p_starts date default null, p_ends date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid;
begin
  if not is_org_manager(uid, p_org) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into cohorts(organization_id, name, starts_on, ends_on, created_by) values (p_org, p_name, p_starts, p_ends, uid) returning id into cid;
  return cid;
end $$;

-- Organization-scoped completion report (never crosses tenants)
create or replace function org_completion_report(p_org uuid)
returns table(cohort text, course_title text, learners bigint, completed bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_org_manager(auth.uid(), p_org) or has_permission(auth.uid(), 'org.read.any')) then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select c.name, v.title, count(e.id), count(e.id) filter (where e.status = 'completed')
  from cohorts c join enrollments e on e.cohort_id = c.id
  join course_versions v on v.id = e.version_id
  where c.organization_id = p_org group by c.name, v.title order by c.name, v.title;
end $$;

-- Platform reports (admins)
create or replace function platform_overview()
returns table(users bigint, learners_30d bigint, published_courses bigint, enrollments bigint, completions bigint, certificates bigint, open_reviews bigint, dead_jobs bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not has_permission(auth.uid(), 'report.read') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query select
    (select count(*) from profiles),
    (select count(distinct learner_id) from enrollments where enrolled_at > now() - interval '30 days'),
    (select count(*) from courses where published_version_id is not null and archived_at is null),
    (select count(*) from enrollments),
    (select count(*) from course_completions),
    (select count(*) from certificates where status = 'valid'),
    (select count(*) from course_submissions where status <> 'closed'),
    (select count(*) from jobs where status = 'dead');
end $$;

-- Scheduled publication hook (call from cron via the job runner)
create or replace function release_scheduled_versions() returns int
language plpgsql security definer set search_path = public as $$
declare v record; n int := 0; old uuid;
begin
  for v in select * from course_versions where status = 'approved' and scheduled_publish_at <= now() for update skip locked loop
    select published_version_id into old from courses where id = v.course_id;
    if old is not null then update course_versions set status = 'archived' where id = old; end if;
    update course_versions set status = 'published', published_at = now() where id = v.id;
    update courses set published_version_id = v.id where id = v.course_id;
    insert into publication_events(course_id, version_id, action) values (v.course_id, v.id, 'published');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function release_scheduled_versions() from public, anon, authenticated;

create or replace function user_id_by_email(p_email text) returns uuid
language sql stable security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1; $$;
revoke execute on function user_id_by_email(text) from public, anon, authenticated;

-- =====================================================================
-- Source: migrations/0006_branding.sql
-- =====================================================================
update settings
set value = jsonb_set(value, '{name}', '"CSGO"'::jsonb),
    updated_at = now()
where key = 'platform';

-- =====================================================================
-- Source: migrations/0007_remove_payments.sql
-- =====================================================================
-- Disable paid enrollment while retaining existing financial records.
create or replace function enroll_self(p_course uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c courses%rowtype; v course_versions%rowtype; eid uuid;
begin
  if not is_active_user(uid) then raise exception 'account not active' using errcode = '42501'; end if;
  select * into c from courses where id = p_course;
  if not found or c.published_version_id is null or c.archived_at is not null then raise exception 'course unavailable'; end if;
  select * into v from course_versions where id = c.published_version_id;
  if v.available_from is not null and v.available_from > now() then raise exception 'course not yet available'; end if;
  if v.available_until is not null and v.available_until < now() then raise exception 'course no longer available'; end if;
  if c.visibility = 'organization' and not exists (
       select 1 from organization_memberships m where m.organization_id = c.organization_id and m.user_id = uid and m.status = 'active')
  then raise exception 'organization members only' using errcode = '42501'; end if;
  if v.enrollment_policy in ('invite_only','approval') then raise exception 'enrollment requires approval or invitation'; end if;
  insert into enrollments(learner_id, course_id, version_id, source)
  values (uid, p_course, v.id, 'self')
  on conflict (learner_id, course_id) do update set status = 'active'
    where enrollments.status in ('cancelled','expired')
  returning id into eid;
  if eid is null then select id into eid from enrollments where learner_id = uid and course_id = p_course; end if;
  return eid;
end $$;

drop function if exists apply_payment_event(text, text, uuid, int, text, jsonb);

drop policy if exists orders_self on orders;
drop policy if exists orders_finance on orders;
drop policy if exists entitlements_self on entitlements;
revoke all on table orders, payments, refunds, subscriptions, entitlements from anon, authenticated;
alter table support_tickets add constraint support_tickets_no_payment_category check (category <> 'payment') not valid;

delete from roles where key = 'finance';
delete from permissions where key in ('finance.read', 'finance.refund');

update course_versions
set price_cents = 0,
    enrollment_policy = case when enrollment_policy = 'paid' then 'open' else enrollment_policy end
where price_cents <> 0 or enrollment_policy = 'paid';

-- =====================================================================
-- Source: migrations/0008_dead_job_retry.sql
-- =====================================================================
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

-- =====================================================================
-- Source: migrations/0010_admin_role_management.sql
-- =====================================================================
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

-- =====================================================================
-- Source: migrations/0011_nonlearner_review_certificate_read.sql
-- =====================================================================
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

revoke all on function grant_nonlearner_baseline_permissions() from public, anon, authenticated;

create trigger trg_roles_nonlearner_baseline
  after insert on roles
  for each row execute function grant_nonlearner_baseline_permissions();

insert into role_permissions(role_id, permission_key)
select r.id, p.key
from roles r
cross join permissions p
where p.key in ('course.review.assigned', 'course.review.any')
   or (r.key <> 'learner' and p.key = 'certificate.read.any')
on conflict do nothing;
