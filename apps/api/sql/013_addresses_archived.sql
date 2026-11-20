-- Do not physically delete addresses referenced by immutable order history.
-- Past orders retain their original address_snapshot; archived addresses
-- cannot be used for any NEW quote or checkout.
ALTER TABLE addresses
 ADD COLUMN archived_at timestamptz NULL;
CREATE INDEX addresses_active_customer_idx ON addresses(user_id,created_at DESC)
 WHERE archived_at IS NULL;
