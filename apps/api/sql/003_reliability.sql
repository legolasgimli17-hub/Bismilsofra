-- v0.6: upgrade applied AFTER 001_initial. Deliberately excludes fictional 002 seed.
-- Script is transaction-wrapped by migrate.ts. Run ONLY through that runner.
ALTER TABLE restaurant_staff
 ADD COLUMN IF NOT EXISTS can_view_orders boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS can_manage_orders boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS can_manage_menu boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS restaurant_settings (
 restaurant_id uuid PRIMARY KEY REFERENCES restaurants(id),
 accept_minutes smallint NOT NULL DEFAULT 4 CHECK(accept_minutes BETWEEN 1 AND 15)
);
CREATE TABLE IF NOT EXISTS restaurant_closures (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 reason text NOT NULL DEFAULT '',
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS closures_rest_time_idx ON restaurant_closures(restaurant_id,starts_at,ends_at);

ALTER TABLE notification_outbox
 ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN IF NOT EXISTS last_error text,
 ADD COLUMN IF NOT EXISTS dead_at timestamptz;
CREATE INDEX IF NOT EXISTS outbox_ready_idx ON notification_outbox(next_attempt_at,id)
 WHERE sent_at IS NULL AND dead_at IS NULL;
-- Enforce that an order's saved address belongs to its customer even if future app code changes.
CREATE UNIQUE INDEX IF NOT EXISTS addresses_owner_pair_idx ON addresses(user_id,id);
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='orders_customer_address_fk') THEN
  ALTER TABLE orders ADD CONSTRAINT orders_customer_address_fk
   FOREIGN KEY(customer_id,address_id) REFERENCES addresses(user_id,id);
 END IF;
END;$$;

CREATE TABLE IF NOT EXISTS support_cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_id uuid NOT NULL REFERENCES users(id),
 order_id uuid NOT NULL REFERENCES orders(id),
 issue_type text NOT NULL CHECK (issue_type IN ('eksik_urun','yanlis_urun','gecikme','teslimat','diger')),
 description text NOT NULL CHECK(length(description) BETWEEN 10 AND 1200),
 status text NOT NULL DEFAULT 'acik' CHECK(status IN ('acik','incelemede','cozuldu','kapandi')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_customer_idx ON support_cases(customer_id,created_at DESC);
-- Defence in depth: a support ticket must refer to its author's order.
CREATE UNIQUE INDEX IF NOT EXISTS orders_customer_pair_idx ON orders(customer_id,id);
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='support_customer_order_fk') THEN
  ALTER TABLE support_cases ADD CONSTRAINT support_customer_order_fk
   FOREIGN KEY(customer_id,order_id) REFERENCES orders(customer_id,id);
 END IF;
END;$$;
