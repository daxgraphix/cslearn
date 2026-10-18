# Roles and permissions

Account ≠ role ≠ permission-in-resource. Roles live in `user_roles` (never in user-editable profile columns); permissions in `role_permissions`; explicit per-user `permission_denials` always win.

| Role | Purpose | Key permissions |
|---|---|---|
| Platform Owner | Highest privilege | all, incl. `role.assign.privileged`, `owner.manage` |
| Platform Administrator | Operations | `course.update.any`, `course.publish`, `user.suspend`, `role.assign` (non-privileged), `report.read`, `ops.read`, `ops.retry` |
| Academic Manager / Reviewer | Quality gate | `course.review.assigned/any`, `course.publish`; **cannot review own course** |
| Instructor / Author | Authoring | `course.create`, `course.update.own`, `course.submit`, `grade.write.assigned`; no self-approval |
| Learner | Study | none (own data via RLS) |
| Support Agent | Help | `support.read/reply`, `support.read_learner`; cannot grade, issue certificates or grant access |
| Organization Manager | Institution | not a global role: `organization_memberships.member_type = 'manager'`, scoped to that org |
| Finance, Certificate Officer, Assessment Moderator, Auditor, Enrollment Manager | Optional operational roles | separate narrow permissions, not mini-admins |

Naming: `<domain>.<action>[.<scope>]` (`course.update.own`, `certificate.revoke`, `audit.read`). Source of truth: `supabase/migrations/0004_seed.sql`, mirrored in `src/lib/permissions.ts`.

## Policy overview
| Action | Learner | Instructor | Reviewer | Admin |
|---|---|---|---|---|
| View published courses | Yes | Yes | Yes | Yes |
| Create course | No | `course.create` | optional | Yes |
| Edit draft | No | own/assigned, draft or changes_requested only | No | `course.update.any` |
| Review submission | No | No (never own) | assigned | `course.review.any` |
| Publish | No | No | if permitted | if permitted, not own revision |
| Manage global roles | No | No | No | non-privileged only; privileged = owner |

The table is an overview. Each decision also checks ownership, organization, enrollment, state and denials.
