-- v1.8: editable, reversible option groups without removing historical order snapshots.
ALTER TABLE option_groups
 ADD COLUMN archived boolean NOT NULL DEFAULT false,
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483647);
ALTER TABLE options
 ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK(revision BETWEEN 1 AND 2147483647);
CREATE INDEX IF NOT EXISTS option_groups_product_active_idx
 ON option_groups(product_id,archived,id);
CREATE INDEX IF NOT EXISTS options_group_available_idx
 ON options(group_id,available,id);
