# Security pass — redaction, supply chain and scope of review

Changes in this pass:
- Unexpected Fastify errors are logged as a request identifier, error **type** and optional 5-character PostgreSQL SQLSTATE only. Raw `pg` error objects, stack traces, conflict details and user values are never sent to general operational logs. Client-facing 500 responses remain generic.
- `security-posture.test.mjs` continuously checks crucial JWT algorithm, signed MFA, email verification, shared PostgreSQL per-customer rate quota, production intake gate and loopback staging isolation assumptions.
- CI adds a production-only npm dependency vulnerability audit. **High** or **critical** reports must fail the job, and JSON evidence is archived. Audit availability/parsing failure also fails closed.
- The existing two-replica HTTP/JWT/tenant tests, order idempotency, notification leases, encryption, restore and SSE recovery tests still run.

These tests are **automated first-party safeguards**, not an independent penetration test and not verification of installed infrastructure. An outside security engineer should still test:
- Auth0 claims, MFA bypass/resets, token confusion, key rotation and stolen sessions.
- Cross-restaurant authorization and admin privilege escalation.
- Multi-instance WAF/rate-control distribution; JWT-valid bot attacks, 429 capacity and upstream throttles.
- Ordering/stock race conditions, payments only at door, notifications/recovery and hosted database secrets.
- Media processing and malware/DoS issues, sensitive-data deletion/retention, monitoring access controls.

Real provider credentials, actual vulnerability scans of a public HTTPS hostname, 24/7 alerting, offsite backups and legal signoff are external launch blockers. Never falsely mark them as finished.
