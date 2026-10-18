# Definition of done (production readiness checklist)

- [ ] Every role can access only its authorized screens, records and actions (RLS + e2e per role)
- [ ] Course create → review → revise → publish works end to end
- [ ] Learners cannot access unpublished content or other learners' records
- [ ] Publishing a revision does not corrupt existing progress or certificates (verified with an enrolled learner)
- [ ] Assessments graded on the server, answer keys unreachable from the browser
- [ ] Certificate issuance and revocation traceable in `certificate_events` and `audit_logs`
- [ ] Database and storage restore drill completed and recorded; RPO/RTO documented
- [ ] Critical journeys have automated tests in CI
- [ ] Monitoring, incident response and rollback documented and rehearsed
- [ ] Accessibility (keyboard, screen reader, contrast), mobile layout and privacy review completed
- [ ] MFA required for owner/admin; secrets only in the deployment secret store
