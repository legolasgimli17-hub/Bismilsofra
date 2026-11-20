-- Pilot admin bulk-menu staging. A retry key belongs to ONE restaurant.
-- Products in imported batches always start unavailable (not customer-orderable).
CREATE TABLE admin_menu_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 actor_user_id uuid NOT NULL REFERENCES users(id),
 import_key varchar(70) NOT NULL CHECK (length(import_key) BETWEEN 16 AND 70),
 payload_sha256 char(64) NOT NULL,
 products_created integer NOT NULL CHECK (products_created BETWEEN 1 AND 50),
 categories_created integer NOT NULL CHECK (categories_created BETWEEN 0 AND 40),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (restaurant_id,import_key)
);
CREATE INDEX admin_menu_imports_restaurant_idx ON admin_menu_imports(restaurant_id,created_at DESC);
