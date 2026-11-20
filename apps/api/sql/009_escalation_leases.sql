-- v1.10: fallback alerts use crash-recoverable claims; no DB lock during webhook.
ALTER TABLE restaurant_escalations
 ADD COLUMN lease_token uuid,
 ADD COLUMN lease_until timestamptz;
ALTER TABLE restaurant_escalations
 ADD CONSTRAINT escalation_lease_pair CHECK ((lease_token IS NULL) = (lease_until IS NULL));
CREATE INDEX escalation_due_claim_idx
 ON restaurant_escalations(next_attempt_at,lease_until,order_id)
 WHERE sent_at IS NULL AND cancelled_at IS NULL AND dead_at IS NULL;
