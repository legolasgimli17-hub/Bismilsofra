-- v1.7 approved restaurant photo records (only finalized and normalized WebP).
-- Each image belongs to one restaurant and cannot be reused in another menu.
CREATE TABLE restaurant_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES restaurants(id),
 uploaded_by uuid NOT NULL REFERENCES users(id),
 object_key text NOT NULL UNIQUE CHECK(length(object_key) BETWEEN 50 AND 240),
 public_url text NOT NULL UNIQUE CHECK(length(public_url) BETWEEN 40 AND 480),
 byte_size integer NOT NULL CHECK(byte_size BETWEEN 1 AND 3145728),
 width smallint NOT NULL CHECK(width BETWEEN 1 AND 1600),
 height smallint NOT NULL CHECK(height BETWEEN 1 AND 1200),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurant_media_owner_created_idx ON restaurant_media(restaurant_id,created_at DESC);
