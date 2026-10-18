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
