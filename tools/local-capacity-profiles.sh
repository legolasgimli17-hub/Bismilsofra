#!/usr/bin/env bash
# Each local profile restarts a disposable API process, resets its own in-memory
# rate budget, and uses ONLY public GET requests. Never against production.
set -euo pipefail
: "${INTEGRATION_DATABASE_URL:?Local disposable test database required}"
case "$INTEGRATION_DATABASE_URL" in
  postgresql://*@127.0.0.1:*/*_test|postgresql://*@localhost:*/*_test|postgres://*@127.0.0.1:*/*_test|postgres://*@localhost:*/*_test) ;;
  *) echo "Refusing a non-local or non-_test database" >&2; exit 1;;
esac
for concurrency in 50 100 200; do
  port=$((4300+concurrency))
  echo "Local GET concurrency profile: $concurrency on port $port"
  NODE_ENV=test PORT="$port" API_BIND_HOST=127.0.0.1 \
    DATABASE_URL="$INTEGRATION_DATABASE_URL" \
    CORS_ORIGIN="http://127.0.0.1:3000" \
    OIDC_ISSUER="http://127.0.0.1:9999/" \
    OIDC_AUDIENCE="sofra-local-load" \
    OIDC_JWKS_URL="http://127.0.0.1:9999/.well-known/jwks.json" \
    node --experimental-strip-types apps/api/src/server.ts > "/tmp/sofra-capacity-$port.log" 2>&1 &
  pid=$!
  trap 'kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true' EXIT
  if ! LOCAL_LOAD_BASE_URL="http://127.0.0.1:$port" \
       LOCAL_LOAD_REQUESTS="$concurrency" LOCAL_LOAD_CONCURRENCY="$concurrency" \
       LOCAL_LOAD_P95_BUDGET_MS=8000 \
       node --experimental-strip-types apps/api/integration/public-load-smoke.ts; then
    tail -n 45 "/tmp/sofra-capacity-$port.log" >&2
    exit 1
  fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  trap - EXIT
done
