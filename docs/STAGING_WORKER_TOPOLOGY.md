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
- On 22 November 2026 the connected Railway workspace received a **staged, uncommitted** `bismil-sofra-staging` project with PostgreSQL 17, 500 MB volume, Fastify API and two alert worker service definitions. `staged-create` means **no resource is running**, no database has been initialized, no public HTTPS hostname exists and no external notification was sent.
- Railway's current connection **cannot access the private GitHub repository** `legolasgimli17-hub/Bismilsofra`; authorization must be granted in the Railway GitHub integration before the API/worker sources can be attached.
- The current Railway plan reported a **500 MB maximum volume size**; this staging limit must not be mistaken for a reliable production database capacity. Budget and future sizing need verification before activation.
- Required secrets, production-safe PostgreSQL credentials, real OIDC tenant, approved billing and real webhook services are not yet configured. The draft must not be committed/deployed until these gates have been satisfied.
- Real OIDC tenant/test accounts, provider deliveries, licensed food images, physical device tests, off-site backups and independent security/legal review are not established.
- Existing `tools/pilot-release-gate.mjs` remains NO_GO until owner-reviewed evidence exists for every gate. Never replace evidence with fictional pass results.

These blockers do not prevent local tests, CI integration tests or further UI/backend development.
