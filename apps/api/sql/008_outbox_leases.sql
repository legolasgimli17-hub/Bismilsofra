-- v1.9: claim each webhook without holding a transaction open across network IO.
-- Leases expire if a worker crashes; receiver MUST deduplicate x-sofra-event-id.
ALTER TABLE notification_outbox
 ADD COLUMN lease_token uuid,
 ADD COLUMN lease_until timestamptz;
ALTER TABLE notification_outbox
 ADD CONSTRAINT outbox_lease_pair CHECK ((lease_token IS NULL) = (lease_until IS NULL));
CREATE INDEX outbox_due_claim_idx ON notification_outbox(next_attempt_at,lease_until,id)
 WHERE sent_at IS NULL AND dead_at IS NULL;
