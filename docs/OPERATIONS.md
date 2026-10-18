# Operations

## Environments
Development (local Supabase, seed data) → Staging (production-like, acceptance tests, real provider sandbox) → Production (restricted deploy access, protected secrets, monitored releases, controlled migrations). Migrations only via `supabase/migrations` in CI; no untracked schema edits.

## Monitoring and incident response
* Structured logs (JSON) to a central provider; error tracking and performance monitoring (Sentry or similar) wired in `src/app/error.tsx` boundaries and server action catch blocks.
* Database: availability, connection usage, slow queries (`pg_stat_statements`).
* Jobs: `/admin/operations` shows the 100 oldest queued, failed and dead jobs; alert when `dead > 0`. Platform administrators and owners can retry dead-letter jobs. A retry resets the attempt counter, queues the job immediately, and writes `job.retry_requested` to the audit log.
* Alerts: repeated auth failures, privilege changes (`role.granted`), unusual admin activity from `audit_logs`.
* Severity levels: **SEV1** data exposure or outage, **SEV2** major feature down, **SEV3** degraded, **SEV4** cosmetic. SEV1: revoke sessions (`auth.admin.signOut`), rotate keys, suspend accounts, preserve audit records, notify per law.
* Release rollback: keep the previous build; migrations are forward-only, so ship additive migrations and feature flags.
* Keep operational logs separate from the audit trail.

## Backups and disaster recovery
Define **RPO** and **RTO** before launch (suggested start: RPO 15 minutes with PITR, RTO 4 hours). Use managed backups/PITR, back up storage objects and file metadata, and run a **restore drill each quarter**; record result and time taken.

## Cron
`POST /api/jobs/run` every minute with `Authorization: Bearer $JOB_RUNNER_SECRET`; separate daily reconciliation job; scheduled publication runs inside the tick.

## Maintenance mode
`settings.platform.maintenance_mode`: gate selected mutations (enrollment, submission) in `exec()` while leaving admin routes protected.
