# Shared-NAT checkout and authenticated capacity evidence

Scope: 50/100/200 simulated **concurrent HTTP POST /v1/orders** requests authenticated with local RS256 JWKS, two Fastify processes and a disposable PostgreSQL 17. These are not production users, Auth0 test tenants or real orders.

## Invariant change

Prior per-IP limit (12 orders/min) could reject genuine customers behind a carrier-grade NAT. Now the coarse IP perimeter allows at most 600 Bearer-present checkout requests/min/process, while `customer_order_quotas` in PostgreSQL atomically caps **12 checkout submissions/min/verified user** across replicas. Unauthenticated requests stay at 12/min/IP; quotes without Bearer stay 48/min/IP. The mere presence of a Bearer header does not mean it is valid: `verifyBearer` still checks issuer, audience, algorithm, signature, email verification and account state before the database quota can be consumed.

SQL migration `014_customer_order_quotas.sql` is checksum-verified, included in `/readyz`, has no email/address/token fields, and is pruned by the expiry worker after two hours. The 12 attempts include safe idempotent retries; clients should check `/v1/me/orders/by-key/:key` after a network timeout rather than repeatedly retrying POST.

## Automatic load scenario

`apps/api/integration/authenticated-capacity.integration.ts` creates 200 distinct signed test accounts and addresses; for batches of 50, 100 and 200, every independent order is sent concurrently and retried on the other API replica using the same key. It checks unique rows, initial order events, outbox, fallback escalations, tenant isolation, account quota and 200 concurrent authenticated SSE subscriptions followed by 20 disconnections and authoritative snapshot recovery. Conservative CI guard: p95 checkout ≤25,000 ms. All requests are localhost-only.

## Limitations and release gates

- The 600/min/IP guard is **per process**, not a global shared perimeter or DDoS defense. Configure edge WAF + shared global rate limiting and test distributed limits before internet release.
- Real-world throughput also depends on managed PostgreSQL size, pooler, CPU/network, Auth0/JWKS reliability, providers and 50 actual restaurants. CI numbers **do not predict** production capacity.
- Staging still requires independently provisioned HTTPS hosting, PostgreSQL, provider-issued real MFA test accounts, independent alerts, remote backup and owner-reviewed security/legal evidence.
- Never load-test production or any non-local database with these scripts.
