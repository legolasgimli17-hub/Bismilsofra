-- OPTIONAL LOCAL DEVELOPMENT DATA ONLY. All restaurants and prices are fictional.
-- Run on a disposable database AFTER 001_initial.sql. Never mistake for genuine merchant data.
BEGIN;
INSERT INTO delivery_zones(id,name) VALUES
 ('aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa','Altıok'),
 ('bbbbbbbb-1000-4000-8000-bbbbbbbbbbbb','Kurtuluş'),
 ('cccccccc-1000-4000-8000-cccccccccccc','Akpınar')
 ON CONFLICT DO NOTHING;
INSERT INTO restaurants(id,name,slug,active,active_slot,is_open,is_busy,accepts_orders)
 VALUES ('11111111-1111-4111-8111-111111111111','Örnek Ocakbaşı','ornek-ocakbasi',true,1,true,false,true)
 ON CONFLICT DO NOTHING;
INSERT INTO restaurant_delivery_zones(restaurant_id,zone_id,min_basket_kurus,delivery_fee_kurus)
 VALUES
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',20000,1500),
 ('11111111-1111-4111-8111-111111111111','bbbbbbbb-1000-4000-8000-bbbbbbbbbbbb',20000,1500)
 ON CONFLICT DO NOTHING;
INSERT INTO restaurant_hours(restaurant_id,day_of_week,open_time,close_time)
 SELECT '11111111-1111-4111-8111-111111111111',n,'00:00','12:00' FROM generate_series(0,6) n
 ON CONFLICT DO NOTHING;
-- Second half-day wraps to midnight; together these shifts cover all 24 hours.
INSERT INTO restaurant_hours(restaurant_id,day_of_week,open_time,close_time)
 SELECT '11111111-1111-4111-8111-111111111111',n,'12:00','00:00' FROM generate_series(0,6) n
 ON CONFLICT DO NOTHING;
INSERT INTO categories(id,restaurant_id,name,sort_order)
 VALUES ('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Dürümler',1)
 ON CONFLICT DO NOTHING;
INSERT INTO products(id,restaurant_id,category_id,name,description,price_kurus,available)
 VALUES ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Örnek Adana Dürüm','Lavaş, köz biber ve yeşillik',18000,true)
 ON CONFLICT DO NOTHING;
INSERT INTO option_groups(id,product_id,name,min_select,max_select)
 VALUES ('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','Ek malzemeler',0,1)
 ON CONFLICT DO NOTHING;
INSERT INTO options(id,group_id,name,price_kurus)
 VALUES ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','Ek lavaş',2000)
 ON CONFLICT DO NOTHING;
COMMIT;
