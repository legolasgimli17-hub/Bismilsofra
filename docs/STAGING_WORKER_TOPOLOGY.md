# Bismil Sofra — staging notification worker topology

This is a reproducible **configuration**, not a live notification integration or an actual deployed staging server.

## Services
- `db`: isolated PostgreSQL 17 staging volume.
- `migrate`: checksum-verified migrations before API/workers.
- `api`: loopback-only host port 4188; `PILOT_ACCEPT_ORDERS=false` unconditionally in staging.
- `expiry`: pending order timeout/expiry and worker heartbeat.
- `outbox`: signed primary alert delivery and worker heartbeat, **opt-in** `notifications` profile.
- `escalation`: independently configured fallback alert and heartbeat, **opt-in** `notifications` profile.

The two delivery workers are intentionally opt-in: without real providers, starting them would generate repeated failed deliveries. This profile must be enabled only with genuine provider endpoints and secrets supplied through a secure secret manager. The CI placeholders use `.invalid` domains and are **never deployed or used for actual delivery**.

To validate topology locally (without sending any messages), use:

```sh
docker compose --profile notifications -f deploy/staging.compose.yml config --quiet
```

The following environment variables are required **before enabling the profile**: `STAGING_ALERT_WEBHOOK_URL`, `STAGING_ALERT_WEBHOOK_SECRET`, `STAGING_ESCALATION_WEBHOOK_URL`, `STAGING_ESCALATION_WEBHOOK_SECRET`, plus the database/OIDC variables used by the base staging compose. Provider URLs must be HTTPS, with distinct actual provider infrastructures, and secrets must never be committed. The fallback worker checks exact URL inequality, but that is not sufficient evidence of provider independence; an operator must verify the providers and delivery receipts.

## Outstanding release blockers
- No Bismil Sofra-specific managed PostgreSQL project has been created. The existing Supabase project is for Karkalkan and must remain untouched.
- No connected Railway project currently exists. A hosting workspace, pricing and secrets are prerequisites for a public HTTPS staging deployment.
- Real OIDC tenant/test accounts, provider deliveries, licensed food images, physical device tests, off-site backups and independent security/legal review are not established.
- Existing `tools/pilot-release-gate.mjs` remains NO_GO until owner-reviewed evidence exists for every gate. Never replace evidence with fictional pass results.

These blockers do not prevent local tests, CI integration tests or further UI/backend development.
