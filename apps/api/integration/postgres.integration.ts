/** Explicit-only real PostgreSQL integration test. NEVER run against production. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {placeOrder,quoteOrder,changeStatus,expirePending} from '../src/order-service.ts';
import {CURRENTLY_ACCEPTING_SQL} from '../src/operations.ts';
import {DomainError} from '../src/domain.ts';
const dsn=process.env.INTEGRATION_DATABASE_URL;
if(!dsn)throw Error('INTEGRATION_DATABASE_URL is required; use a disposable local DB ending with _test.');
const parsed=new URL(dsn);
if(!parsed.pathname.endsWith('_test'))throw Error('Refusing database that does not end with _test.');
if(parsed.hostname!=='localhost'&&parsed.hostname!=='127.0.0.1')throw Error('Only a local disposable test PostgreSQL is allowed.');
const pool=new Pool({connectionString:dsn,max:15});
const r='11111111-1111-4111-8111-111111111111';
const z='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
const p='33333333-3333-4333-8333-333333333333';
const extra='55555555-5555-4555-8555-555555555555';

test('PostgreSQL order / tenant / idempotency / expiry / history vertical slice',async(t)=>{
 t.after(async()=>{await pool.end()});
 const required=await pool.query("SELECT to_regclass('public.orders') AS orders,to_regclass('public.restaurant_settings') AS settings");
 if(!required.rows[0].orders||!required.rows[0].settings)throw Error('Run npm run migrate against this test DB first.');
 const rest=await pool.query('SELECT id FROM restaurants WHERE id=$1 AND active=true',[r]);
 if(!rest.rowCount)throw Error('Load sql/002_development_example.sql ONLY into the disposable test DB.');
 const nonce=randomUUID();
 const first=(await pool.query('INSERT INTO users(oidc_subject,verified_email) VALUES($1,$2) RETURNING id',[`integration-${nonce}-customer`,'test@example.invalid'])).rows[0].id;
 const second=(await pool.query('INSERT INTO users(oidc_subject,verified_email) VALUES($1,$2) RETURNING id',[`integration-${nonce}-other`,'test@example.invalid'])).rows[0].id;
 const owner=(await pool.query('INSERT INTO users(oidc_subject,verified_email) VALUES($1,$2) RETURNING id',[`integration-${nonce}-owner`,'owner@example.invalid'])).rows[0].id;
 await pool.query('INSERT INTO restaurant_staff(user_id,restaurant_id,role) VALUES($1,$2,$3)',[owner,r,'owner']);
 const a=(await pool.query('INSERT INTO addresses(user_id,zone_id,full_address,phone) VALUES($1,$2,$3,$4) RETURNING id',[first,z,'Integration Test Sokak 10','05000000000'])).rows[0].id;
 const payload={restaurantId:r,addressId:a,paymentMethod:'cash',items:[{productId:p,quantity:1,optionIds:[extra]}],note:'Az acılı'};
 const quote=await quoteOrder(pool,first,payload);
 assert.equal(quote.totals.totalKurus,21500);
 await assert.rejects(()=>placeOrder(pool,first,{...payload,confirmedTotalKurus:21499},'integration-stale-'+randomUUID()),e=>e instanceof DomainError&&e.code==='PRICE_CHANGED');
 const confirmed={...payload,confirmedTotalKurus:quote.totals.totalKurus};
 const key='integration-'+randomUUID();
 const [one,again]=await Promise.all([placeOrder(pool,first,confirmed,key),placeOrder(pool,first,confirmed,key)]);
 assert.equal(one.id,again.id);assert.equal([one.replayed,again.replayed].filter(x=>x===false).length,1);
 const existing=await pool.query('SELECT count(*)::int AS n FROM orders WHERE customer_id=$1 AND idempotency_key=$2',[first,key]);
 assert.equal(existing.rows[0].n,1);
 await assert.rejects(()=>placeOrder(pool,first,{...confirmed,note:'Farklı not'},key),e=>e instanceof DomainError&&e.code==='IDEMPOTENCY_CONFLICT');
 const detail=await pool.query('SELECT total_kurus,subtotal_kurus,delivery_fee_kurus,payment_method FROM orders WHERE id=$1',[one.id]);
 assert.equal(detail.rows[0].total_kurus,21500);
 assert.equal(detail.rows[0].subtotal_kurus,20000);
 assert.equal(detail.rows[0].delivery_fee_kurus,1500);
 const snapshots=await pool.query('SELECT product_name_snapshot,unit_kurus,options_snapshot FROM order_items WHERE order_id=$1',[one.id]);
 assert.equal(snapshots.rows[0].unit_kurus,20000);
 await assert.rejects(()=>changeStatus(pool,'customer',second,one.id,'musteri_iptal'),e=>e instanceof DomainError&&e.code==='NOT_FOUND');
 for(const next of ['kabul_edildi','hazirlaniyor','hazir','yolda','teslim_edildi'] as const){
  const changed=await changeStatus(pool,'restaurant',owner,one.id,next);assert.equal(changed.status,next);
 }
 const events=await pool.query('SELECT new_status FROM order_events WHERE order_id=$1 ORDER BY id',[one.id]);
 assert.deepEqual(events.rows.map(e=>e.new_status),['beklemede','kabul_edildi','hazirlaniyor','hazir','yolda','teslim_edildi']);
 const outbox=await pool.query('SELECT count(*)::int AS n FROM notification_outbox WHERE order_id=$1',[one.id]);
 assert.equal(outbox.rows[0].n,6);
 // An expiring second order must be terminal and have an immutable history entry.
 const exp=await placeOrder(pool,first,confirmed,'integration-'+randomUUID());
 await pool.query("UPDATE orders SET expires_at=now()-interval '1 second' WHERE id=$1",[exp.id]);
 assert.ok(await expirePending(pool)>0);
 const final=await pool.query('SELECT status FROM orders WHERE id=$1',[exp.id]);
 assert.equal(final.rows[0].status,'suresi_doldu');
 // Discovery and checkout must agree on whether the restaurant is accepting orders.
 const discovery=async()=>{
  const q=await pool.query(`SELECT (${CURRENTLY_ACCEPTING_SQL}) AS is_orderable FROM restaurants r WHERE r.id=$1`,[r]);
  return q.rows[0]?.is_orderable===true;
 };
 assert.equal(await discovery(),true);
 await pool.query('UPDATE restaurants SET is_busy=true WHERE id=$1',[r]);
 try {assert.equal(await discovery(),false)}finally{await pool.query('UPDATE restaurants SET is_busy=false WHERE id=$1',[r])}
 const closure=(await pool.query(`INSERT INTO restaurant_closures(restaurant_id,starts_at,ends_at,reason)
   VALUES($1,now()-interval '1 minute',now()+interval '1 hour','CI test') RETURNING id`,[r])).rows[0].id;
 try {assert.equal(await discovery(),false)}finally{await pool.query('DELETE FROM restaurant_closures WHERE id=$1',[closure])}
 assert.equal(await discovery(),true);
});
