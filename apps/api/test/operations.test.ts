import test from 'node:test';
import assert from 'node:assert/strict';
import {MERCHANT_SUMMARY_QUERY,hasRequiredMigrations,REQUIRED_MIGRATIONS,CURRENTLY_ACCEPTING_SQL} from '../src/operations.ts';

test('merchant summary query scoped to one restaurant',()=>{
 assert.match(MERCHANT_SUMMARY_QUERY,/WHERE restaurant_id=\$1/);
 assert.match(MERCHANT_SUMMARY_QUERY,/LIMIT 80/);
});
test('merchant summary query excludes all bulk customer PII',()=>{
 assert.doesNotMatch(MERCHANT_SUMMARY_QUERY,/address_snapshot|customer_id|phone|full_address|directions|note/i);
});
test('readiness requires all applied migrations',()=>{
 assert.equal(hasRequiredMigrations(REQUIRED_MIGRATIONS.map(filename=>({filename}))),true);
 assert.equal(hasRequiredMigrations([{filename:'001_initial.sql'}]),false);
 assert.equal(hasRequiredMigrations([{filename:'003_reliability.sql'}]),false);
 assert.equal(hasRequiredMigrations([{filename:'001_initial.sql'},{filename:'003_reliability.sql'}]),false);
 assert.equal(hasRequiredMigrations(REQUIRED_MIGRATIONS.filter(name=>name!=='005_product_revisions.sql').map(filename=>({filename}))),false);
 assert.equal(hasRequiredMigrations([]),false);
});
test('migration readiness tolerates additional future migrations',()=>{
 assert.equal(hasRequiredMigrations([...REQUIRED_MIGRATIONS.map(filename=>({filename})),{filename:'006_future.sql'}]),true);
});

test('public availability combines manual state, hours, closures, delivery area',()=>{
 assert.match(CURRENTLY_ACCEPTING_SQL,/r\.active\s*=\s*true/);
 assert.match(CURRENTLY_ACCEPTING_SQL,/r\.is_busy\s*=\s*false/);
 assert.match(CURRENTLY_ACCEPTING_SQL,/restaurant_delivery_zones/);
 assert.match(CURRENTLY_ACCEPTING_SQL,/restaurant_hours/);
 assert.match(CURRENTLY_ACCEPTING_SQL,/restaurant_closures/);
 assert.match(CURRENTLY_ACCEPTING_SQL,/Europe\/Istanbul/);
});
