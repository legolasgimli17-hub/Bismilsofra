-- Bismil Sofra v0.5 (PostgreSQL 17+). Currency in integer kuruş, not floats.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 oidc_subject text NOT NULL UNIQUE CHECK (length(oidc_subject) BETWEEN 3 AND 250),
 verified_email text,
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE platform_admins (
 user_id uuid PRIMARY KEY REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE restaurants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
 slug text NOT NULL UNIQUE,
 phone text,
 cover_url text,
 -- 50 globally unique, non-null slots prevent a 51st active restaurant even under races.
 active boolean NOT NULL DEFAULT false,
 active_slot smallint UNIQUE CHECK (active_slot BETWEEN 1 AND 50),
 is_open boolean NOT NULL DEFAULT false,
 is_busy boolean NOT NULL DEFAULT false,
 accepts_orders boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (active = (active_slot IS NOT NULL))
);
CREATE TABLE restaurant_staff (
 user_id uuid NOT NULL REFERENCES users(id),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 role text NOT NULL CHECK(role IN ('owner','manager','staff')),
 PRIMARY KEY(user_id, restaurant_id)
);
CREATE INDEX staff_restaurant_idx ON restaurant_staff (restaurant_id);
CREATE TABLE delivery_zones (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 2 AND 110),
 enabled boolean NOT NULL DEFAULT true
);
CREATE TABLE restaurant_delivery_zones (
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 zone_id uuid NOT NULL REFERENCES delivery_zones(id),
 min_basket_kurus integer NOT NULL DEFAULT 0 CHECK (min_basket_kurus BETWEEN 0 AND 100000000),
 delivery_fee_kurus integer NOT NULL DEFAULT 0 CHECK (delivery_fee_kurus BETWEEN 0 AND 100000000),
 enabled boolean NOT NULL DEFAULT true,
 PRIMARY KEY (restaurant_id,zone_id)
);
CREATE TABLE restaurant_hours (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
 open_time time NOT NULL,close_time time NOT NULL,
 UNIQUE (restaurant_id,day_of_week,open_time),
 CHECK (close_time <> open_time)
);
CREATE TABLE addresses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id),
 zone_id uuid NOT NULL REFERENCES delivery_zones(id),
 label text NOT NULL DEFAULT 'Ev' CHECK (length(label)<=45),
 full_address text NOT NULL CHECK(length(full_address) BETWEEN 8 AND 900),
 directions text NOT NULL DEFAULT '' CHECK(length(directions)<=400),
 phone text NOT NULL CHECK(phone ~ '^05[0-9]{9}$'),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addresses_owner_idx ON addresses(user_id);
CREATE TABLE categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 90),sort_order integer NOT NULL DEFAULT 0,
 UNIQUE (restaurant_id,id)
);
CREATE TABLE products (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 category_id uuid NOT NULL,
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 130), description text NOT NULL DEFAULT '',
 price_kurus integer NOT NULL CHECK (price_kurus BETWEEN 0 AND 100000000),
 image_url text, available boolean NOT NULL DEFAULT true,sort_order integer NOT NULL DEFAULT 0,
 UNIQUE (restaurant_id,id),
 FOREIGN KEY (restaurant_id,category_id) REFERENCES categories(restaurant_id,id)
);
CREATE INDEX products_restaurant_idx ON products (restaurant_id, available);
CREATE TABLE option_groups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id),
 name text NOT NULL CHECK (length(name) BETWEEN 2 AND 110),
 min_select smallint NOT NULL DEFAULT 0 CHECK (min_select BETWEEN 0 AND 24),
 max_select smallint NOT NULL DEFAULT 1 CHECK (max_select BETWEEN 0 AND 24),
 CHECK (min_select<=max_select)
);
CREATE TABLE options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid NOT NULL REFERENCES option_groups(id),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
 price_kurus integer NOT NULL DEFAULT 0 CHECK (price_kurus BETWEEN 0 AND 100000000),
 available boolean NOT NULL DEFAULT true
);
CREATE TABLE orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES users(id),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 address_id uuid NOT NULL REFERENCES addresses(id),
 address_snapshot jsonb NOT NULL,
 payment_method text NOT NULL CHECK(payment_method IN ('cash','pos')),
 status text NOT NULL DEFAULT 'beklemede' CHECK(status IN ('beklemede','kabul_edildi','reddedildi','suresi_doldu','musteri_iptal','hazirlaniyor','hazir','yolda','teslim_edildi','restoran_iptal','teslim_edilemedi')),
 subtotal_kurus integer NOT NULL CHECK(subtotal_kurus BETWEEN 0 AND 100000000),
 delivery_fee_kurus integer NOT NULL CHECK(delivery_fee_kurus BETWEEN 0 AND 100000000),
 total_kurus integer NOT NULL CHECK(total_kurus BETWEEN 0 AND 100000000),
 note text NOT NULL DEFAULT '',
 idempotency_key varchar(100) NOT NULL,
 payload_hash char(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,delivered_at timestamptz,
 UNIQUE(customer_id,idempotency_key),
 CHECK (total_kurus = subtotal_kurus + delivery_fee_kurus)
);
CREATE INDEX orders_restaurant_status_idx ON orders(restaurant_id,status,created_at DESC);
CREATE INDEX orders_customer_idx ON orders(customer_id,created_at DESC);
CREATE INDEX orders_expiry_idx ON orders(expires_at) WHERE status='beklemede';
CREATE TABLE order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 product_id uuid, product_name_snapshot text NOT NULL,
 unit_kurus integer NOT NULL CHECK (unit_kurus>=0), quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 25),
 line_total_kurus integer NOT NULL CHECK (line_total_kurus=unit_kurus*quantity),
 options_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE order_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 previous_status text,new_status text NOT NULL,
 actor_type text NOT NULL CHECK(actor_type IN ('system','customer','restaurant','admin')),
 actor_user_id uuid REFERENCES users(id),
 reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_idx ON order_events(order_id,id);
CREATE FUNCTION reject_event_modification() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'order_events is append-only'; END;
$$;
CREATE TRIGGER order_events_append_only BEFORE UPDATE OR DELETE ON order_events FOR EACH ROW EXECUTE FUNCTION reject_event_modification();
CREATE TABLE notification_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id uuid NOT NULL REFERENCES orders(id),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id), type text NOT NULL,
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,attempts integer NOT NULL DEFAULT 0
);
CREATE INDEX outbox_unsent_idx ON notification_outbox(id) WHERE sent_at IS NULL;
CREATE TABLE audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor_user_id uuid REFERENCES users(id),
 action text NOT NULL,target_type text NOT NULL,target_id uuid,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_event_modification();
COMMIT;
