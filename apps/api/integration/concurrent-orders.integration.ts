/** Concurrent checkout transaction contract test against DISPOSABLE local PostgreSQL.
 * No genuine customers, external providers, SMS, cards, or production data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {Pool} from 'pg';
import {placeOrder,quoteOrder} from '../src/order-service.ts';
const raw=process.env.INTEGRATION_DATABASE_URL;
if(!raw)throw Error('INTEGRATION_DATABASE_URL required for disposable local DB.');
const url=new URL(raw);
if(!url.pathname.endsWith('_test')||!['127.0.0.1','localhost'].includes(url.hostname))
 throw Error('Concurrent checkout test refuses any non-local, non-_test database.');
const RESTAURANT_ID='11111111-1111-4111-8111-111111111111';
const ZONE_ID='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
const PRODUCT_ID='33333333-3333-4333-8333-333333333333';
const OPTION_ID='55555555-5555-4555-8555-555555555555';

test('30 simultaneous independent orders are durable, each with one outbox and idempotent replay', {timeout:120000}, async t=>{
 const pool=new Pool({connectionString:raw,max:12,connectionTimeoutMillis:10000,statement_timeout:15000});
 t.after(async()=>{await pool.end()});
 const runId=randomUUID();
 const people=await Promise.all(Array.from({length:30},async(_,i)=>{
  const subject='ci-concurrency-'+runId+'-'+i;
  const u=await pool.query('INSERT INTO users(oidc_subject,verified_email) VALUES($1,$2) RETURNING id',
   [subject,'concurrency-'+i+'@example.invalid']);
  const address=await pool.query('INSERT INTO addresses(user_id,zone_id,full_address,phone) VALUES($1,$2,$3,$4) RETURNING id',
   [u.rows[0].id,ZONE_ID,'Test Sokak No '+(i+1),'05000000000']);
  return {userId:u.rows[0].id as string,addressId:address.rows[0].id as string};
 }));
 const bodies=people.map(person=>({
  restaurantId:RESTAURANT_ID,addressId:person.addressId,paymentMethod:'cash' as const,
  items:[{productId:PRODUCT_ID,quantity:1,optionIds:[OPTION_ID]}],note:'CI fictional checkout'
 }));
 const quotes=await Promise.all(people.map((p,i)=>quoteOrder(pool,p.userId,bodies[i])));
 const keys=people.map(()=>('ci-concurrent-'+randomUUID()));
 const confirmed=bodies.map((b,i)=>({...b,confirmedTotalKurus:quotes[i].totals.totalKurus}));
 const timings:number[]=[];
 const started=performance.now();
 const orders=await Promise.all(people.map(async(p,i)=>{
  const begin=performance.now();
  const placed=await placeOrder(pool,p.userId,confirmed[i],keys[i]);
  timings.push(performance.now()-begin);
  return placed;
 }));
 const elapsed=performance.now()-started;
 assert.equal(orders.length,30);
 assert.equal(new Set(orders.map(o=>o.id)).size,30,'30 separate customers must have 30 distinct orders');
 assert.ok(orders.every(o=>o.replayed===false),'initial writes cannot be reported as replay');
 const ids=orders.map(o=>o.id);
 const persisted=await pool.query(
  'SELECT id,total_kurus,status FROM orders WHERE id=ANY($1::uuid[])',[ids]);
 assert.equal(persisted.rowCount,30);
 assert.ok(persisted.rows.every(o=>o.status==='beklemede'));
 const events=await pool.query(
  "SELECT order_id FROM order_events WHERE order_id=ANY($1::uuid[]) AND new_status='beklemede'",[ids]);
 assert.equal(events.rowCount,30,'every accepted order must have a durable initial status event');
 const outbox=await pool.query(
  "SELECT order_id FROM notification_outbox WHERE order_id=ANY($1::uuid[]) AND type='new_order'",[ids]);
 assert.equal(outbox.rowCount,30,'every accepted order must have a durable notification');
 const escalations=await pool.query(
  'SELECT order_id FROM restaurant_escalations WHERE order_id=ANY($1::uuid[])',[ids]);
 assert.equal(escalations.rowCount,30,'each order must have a fallback alert scheduled');
 const replays=await Promise.all(people.map((p,i)=>
  placeOrder(pool,p.userId,confirmed[i],keys[i])));
 assert.ok(replays.every((o,i)=>o.replayed===true&&o.id===orders[i].id),
  'same customer + same idempotency key can never create a second order');
 const duplicateRows=await pool.query('SELECT count(*)::int AS count FROM orders WHERE id=ANY($1::uuid[])',[ids]);
 assert.equal(duplicateRows.rows[0].count,30);
 timings.sort((a,b)=>a-b);
 const p95=timings[Math.ceil(timings.length*.95)-1];
 console.log(JSON.stringify({test:'30 concurrent orders, 30 idempotent replays',orders:30,errors:0,
  durationMs:Math.round(elapsed),p95Ms:Math.round(p95),p99Ms:Math.round(timings.at(-1)??0)}));
 assert.ok(p95<=20000,'CI concurrent checkout p95 exceeded the conservative 20s safety budget');
});
