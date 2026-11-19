-- Independent escalation for pending restaurant orders; never contains customer PII.
-- Runs transactionally through src/migrate.ts after 003_reliability.sql.
CREATE TABLE restaurant_escalations (
 order_id uuid PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 due_at timestamptz NOT NULL,
 next_attempt_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 20),
 sent_at timestamptz,
 cancelled_at timestamptz,
 dead_at timestamptz,
 last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (num_nonnulls(sent_at,cancelled_at,dead_at)<=1)
);
CREATE INDEX restaurant_escalations_ready_idx ON restaurant_escalations(next_attempt_at,due_at)
 WHERE sent_at IS NULL AND cancelled_at IS NULL AND dead_at IS NULL;
CREATE INDEX restaurant_escalations_restaurant_idx ON restaurant_escalations(restaurant_id,created_at DESC);

-- A reminder is due ~60 seconds after placement, or earlier for short
-- acceptance windows. It must never be scheduled after expiration.
CREATE FUNCTION schedule_restaurant_escalation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE planned timestamptz;
BEGIN
 IF NEW.status <> 'beklemede' THEN RETURN NEW; END IF;
 planned := GREATEST(
  NEW.created_at + interval '5 seconds',
  LEAST(NEW.created_at + interval '60 seconds', NEW.expires_at - interval '20 seconds')
 );
 INSERT INTO restaurant_escalations(order_id,restaurant_id,due_at,next_attempt_at)
 VALUES(NEW.id,NEW.restaurant_id,planned,planned);
 RETURN NEW;
END;
$$;
CREATE TRIGGER order_escalation_after_insert
 AFTER INSERT ON orders FOR EACH ROW
 EXECUTE FUNCTION schedule_restaurant_escalation();

-- Covers already-pending orders at upgrade time without creating reminders
-- for accepted, cancelled, delivered or expired records.
INSERT INTO restaurant_escalations(order_id,restaurant_id,due_at,next_attempt_at)
 SELECT o.id,o.restaurant_id,
 GREATEST(now(),LEAST(o.created_at + interval '60 seconds',o.expires_at - interval '20 seconds')),
 GREATEST(now(),LEAST(o.created_at + interval '60 seconds',o.expires_at - interval '20 seconds'))
 FROM orders o
 WHERE o.status='beklemede' AND o.expires_at>now()
 ON CONFLICT(order_id) DO NOTHING;
