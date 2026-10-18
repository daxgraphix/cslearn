# Security baseline

Documented baseline with tests that prove important restrictions. It is not a claim that any system is completely secure.

## Identity
Verified email sign-up, password recovery, cookie sessions (`@supabase/ssr`), rate limits on register/login/reset (`src/lib/rate-limit.ts`; move to Redis for multi-instance), identical login error message, open-redirect protection on `next`. **Enable MFA** in Supabase Auth and require it for owner/admin (setting `security.require_mfa_for_privileged`). Authorization data never sits in user-editable profile columns (`profiles` UPDATE is column-granted to harmless fields only).

## Authorization checklist (every protected operation)
1 authenticated · 2 active account · 3 permission · 4 resource in scope · 5 business-state valid · 6 valid for course version / enrollment. Implemented as guards in `src/lib/auth.ts` plus RLS plus SECURITY DEFINER functions. Cross-tenant access: org functions all check `is_org_manager(auth.uid(), org)` and cohort/org consistency.

## PostgreSQL and Supabase
RLS enabled on every public table; `revoke all` then explicit grants; sensitive tables (`answer_keys`, `payments`, `refunds`, `grade_events`, `certificate_events`) have no browser grants; internal functions revoked from `anon/authenticated`; service-role key only in server modules; inputs validated with zod; Supabase client uses parameterized queries; migrations are version controlled.

## Files and video
Extension block-list, MIME allow-list, size limits, private buckets, 5-minute signed URLs issued only after authorization, no executable or HTML/SVG served as trusted content. Add virus scanning (ClamAV job) before release of learner uploads to instructors if your risk profile needs it. Protected video: use a provider with signed playback; signed URLs cannot stop screen recording.

## Assessment integrity
Server-side grading, attempt limits and timers, ownership checks, finalized grades protected, regrade history, optional shuffle. Anomaly logging must not be treated as proof of misconduct.

## Audit log
`audit_logs` is append-only (trigger), written by SECURITY DEFINER functions only: role changes, suspensions, reviews, publication, grade changes, certificates, report export. No passwords, tokens or payment secrets. Retention: define per policy (default 24 months, exports archived).

## Headers
`next.config.mjs`: HSTS, frame deny, nosniff, referrer policy, permissions policy. Add a CSP (nonce based) once the video providers you embed are final.

## Threat model
| Threat | Mitigation | Test |
|---|---|---|
| Learner reads another learner's records | RLS + ownership checks | `supabase/tests/rls.test.sql` |
| Instructor edits another's course | `is_course_instructor` + RLS version policies | add cross-author case |
| Role escalation | server-controlled roles, `assign_role` privileged check, audit | rls test |
| Unauthorized publication | `publish_version` requires approved + permission | unit + pgTAP |
| Malicious upload | allow-lists, private storage | `validation.test.ts` |
| Answer leakage | `answer_keys` no grants, server grading | rls test |
| Credential abuse | rate limit, MFA, session revocation | e2e / manual |
| Data loss | PITR, restore drills | `docs/OPERATIONS.md` |
| Privileged compromise | MFA, least privilege, audit alerts, revoke sessions | incident drill |
