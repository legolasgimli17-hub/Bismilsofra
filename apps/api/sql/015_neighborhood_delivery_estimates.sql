ALTER TABLE restaurant_delivery_zones
 ADD COLUMN delivery_min_minutes integer,
 ADD COLUMN delivery_max_minutes integer,
 ADD CONSTRAINT restaurant_delivery_zone_minutes_check CHECK (
  (delivery_min_minutes IS NULL AND delivery_max_minutes IS NULL)
  OR (delivery_min_minutes IS NOT NULL AND delivery_max_minutes IS NOT NULL
   AND delivery_min_minutes BETWEEN 5 AND 180
   AND delivery_max_minutes BETWEEN delivery_min_minutes AND 180)
 );
