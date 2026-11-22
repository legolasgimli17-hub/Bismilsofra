-- Shared, per-verified-customer checkout budget across all API replicas.
-- A high common NAT/IP budget in the HTTP safety net cannot replace this
-- database-atomic quota. No emails, bearer tokens or addresses are stored.
CREATE TABLE customer_order_quotas (
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 window_start timestamptz NOT NULL,
 hits integer NOT NULL DEFAULT 1 CHECK (hits BETWEEN 1 AND 12),
 PRIMARY KEY (user_id,window_start)
);
CREATE INDEX customer_order_quotas_expiry_idx ON customer_order_quotas(window_start);
