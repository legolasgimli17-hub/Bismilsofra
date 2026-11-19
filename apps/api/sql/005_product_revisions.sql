-- Protect concurrent menu edits against silent overwrites.
-- Existing products start at revision 1; REST editing requires matching revision.
ALTER TABLE products
 ADD COLUMN revision integer NOT NULL DEFAULT 1
  CHECK (revision BETWEEN 1 AND 2147483647);
CREATE INDEX IF NOT EXISTS categories_restaurant_name_idx ON categories(restaurant_id,lower(name));
