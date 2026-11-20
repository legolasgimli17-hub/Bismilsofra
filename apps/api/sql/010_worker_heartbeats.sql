-- Process liveness, NOT proof of webhook provider delivery or a restaurant acknowledging a phone.
CREATE TABLE worker_heartbeats (
 worker_name text PRIMARY KEY CHECK(worker_name IN ('outbox','escalation','expiry')),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 last_cycle_state text NOT NULL CHECK(last_cycle_state IN ('ok','delivery_error','error')),
 last_successful_cycle_at timestamptz,
 last_work_at timestamptz,
 last_failure_at timestamptz
);
