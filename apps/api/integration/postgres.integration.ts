/** Explicit-only real PostgreSQL integration test. NEVER run against production. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {placeOrder,quoteOrder,changeStatus,expirePending} from '../src/order-service.ts';
import {CURRENTLY_ACCEPTING_SQL,FREE_PILOT_SLOT_SQL} from '../src/operations.ts';
import {dispatchEscalations} from '../src/escalation-service.ts';
import {dispatchOutbox} from '../src/notification-service.ts';
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
 // The seeded active restaurant holds slot 1; a five-merchant phase has
 // slots 2..5, whereas a one-slot test cap is already full.
 const freeOne=await pool.query(FREE_PILOT_SLOT_SQL,[1]);
 assert.equal(freeOne.rowCount,0);
 const freeFive=await pool.query(FREE_PILOT_SLOT_SQL,[5]);
 assert.equal(freeFive.rows[0]?.slot,2);

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

 // A durable fallback reminder is scheduled atomically when the order is inserted.
 const planned=await pool.query('SELECT order_id,due_at,next_attempt_at FROM restaurant_escalations WHERE order_id=$1',[one.id]);
 assert.equal(planned.rowCount,1);
 await pool.query("UPDATE restaurant_escalations SET next_attempt_at=now()-interval '1 second' WHERE order_id=$1",[one.id]);
 let unexpected=0;
 const acceptedOrder=await dispatchEscalations(pool,async()=>{unexpected++},1);
 assert.equal(acceptedOrder.cancelled,1);
 assert.equal(unexpected,0,'accepted orders must never be escalated');

 const waiting=await placeOrder(pool,first,confirmed,'integration-escalation-'+randomUUID());
 await pool.query("UPDATE restaurant_escalations SET next_attempt_at=now()-interval '1 second' WHERE order_id=$1",[waiting.id]);
 let attempts=0;
 const firstReminder=await dispatchEscalations(pool,async event=>{
  assert.equal(String(event.id),'escalation:'+waiting.id);
  attempts++;throw Error('CI alternate alert provider offline');
 },1);
 assert.equal(firstReminder.failed,1);
 const retryState=await pool.query('SELECT attempts,sent_at,last_error FROM restaurant_escalations WHERE order_id=$1',[waiting.id]);
 assert.equal(retryState.rows[0].attempts,1);
 assert.equal(retryState.rows[0].sent_at,null);
 assert.equal(retryState.rows[0].last_error,'DELIVERY_FAILED');
 await pool.query("UPDATE restaurant_escalations SET next_attempt_at=now()-interval '1 second' WHERE order_id=$1",[waiting.id]);
 const recovered=await dispatchEscalations(pool,async event=>{
  attempts++;assert.equal(event.type,'pending_order_escalation');
  assert.equal(String(event.id),'escalation:'+waiting.id);
 },1);
 assert.equal(recovered.sent,1);
 assert.equal(attempts,2);
 const recoveredState=await pool.query('SELECT attempts,sent_at FROM restaurant_escalations WHERE order_id=$1',[waiting.id]);
 assert.ok(recoveredState.rows[0].sent_at);
 assert.equal(recoveredState.rows[0].attempts,2);
 const noDuplicate=await dispatchEscalations(pool,async()=>{throw Error('duplicate')},1);
 assert.equal(noDuplicate.sent,0);

 // A webhook worker must release its only database connection before any
 // network call. Test both concurrent workers and a simulated crashed lease.
 await pool.query("UPDATE notification_outbox SET next_attempt_at=now()+interval '1 day' WHERE sent_at IS NULL");
 const leaseOrder=await placeOrder(pool,first,confirmed,'integration-lease-'+randomUUID());
 const outboxRow=(await pool.query("SELECT id FROM notification_outbox WHERE order_id=$1 AND type='new_order' ORDER BY id LIMIT 1",[leaseOrder.id])).rows[0];
 assert.ok(outboxRow,'new order must create durable outbox event');
 const oneConnection=new Pool({connectionString:dsn,max:1,connectionTimeoutMillis:1000});
 try{
  const deliveredIds:string[]=[];
  const send=async(e:{id:string|number})=>{
   const check=await oneConnection.query('SELECT 1 AS ok');
   assert.equal(check.rows[0].ok,1,'network handler can query DB: no transaction is held');
   deliveredIds.push(String(e.id));
   await new Promise(resolve=>setTimeout(resolve,40));
  };
  const results=await Promise.all([
   dispatchOutbox(oneConnection,send,1),
   dispatchOutbox(oneConnection,send,1)
  ]);
  assert.equal(results.reduce((n,x)=>n+x.sent,0),1);
  assert.deepEqual(deliveredIds,[String(outboxRow.id)],'two workers must not send the same leased event');
  const ack=await pool.query('SELECT sent_at,lease_token,lease_until FROM notification_outbox WHERE id=$1',[outboxRow.id]);
  assert.ok(ack.rows[0].sent_at);
  assert.equal(ack.rows[0].lease_token,null);
  assert.equal(ack.rows[0].lease_until,null);

  // Simulate worker crash after claim but before provider call.
  const crashRow=(await pool.query(`INSERT INTO notification_outbox(order_id,restaurant_id,type,payload)
   VALUES($1,$2,'lease-recovery-test','{}'::jsonb) RETURNING id`,[leaseOrder.id,r])).rows[0];
  await pool.query("UPDATE notification_outbox SET lease_token=$2,lease_until=now()+interval '15 minutes' WHERE id=$1",[crashRow.id,randomUUID()]);
  const blocked=await dispatchOutbox(oneConnection,async()=>{throw Error('should be leased')},1);
  assert.equal(blocked.processed,0,'unexpired lease must not be stolen');
  await pool.query("UPDATE notification_outbox SET lease_until=now()-interval '1 second' WHERE id=$1",[crashRow.id]);
  const recoveredIds:string[]=[];
  const recoveredLease=await dispatchOutbox(oneConnection,async e=>{recoveredIds.push(String(e.id))},1);
  assert.equal(recoveredLease.sent,1,'expired lease must be reclaimable after worker crash');
  assert.deepEqual(recoveredIds,[String(crashRow.id)]);

  // Independent fallback must have the SAME lock-free and recovery properties.
  await pool.query("UPDATE restaurant_escalations SET next_attempt_at=now()+interval '1 day' WHERE sent_at IS NULL AND cancelled_at IS NULL");
  const fallbackOrder=await placeOrder(pool,first,confirmed,'integration-fallback-lease-'+randomUUID());
  await pool.query("UPDATE restaurant_escalations SET next_attempt_at=now()-interval '1 second' WHERE order_id=$1",[fallbackOrder.id]);
  const fallbackSent:string[]=[];
  const fallbackDeliver=async(e:{id:string|number})=>{
   const check=await oneConnection.query('SELECT 1 AS ok');
   assert.equal(check.rows[0].ok,1,'fallback delivery releases the one DB connection before network');
   fallbackSent.push(String(e.id));
   await new Promise(resolve=>setTimeout(resolve,40));
  };
  const fallbackPair=await Promise.all([
   dispatchEscalations(oneConnection,fallbackDeliver,1),
   dispatchEscalations(oneConnection,fallbackDeliver,1)
  ]);
  assert.equal(fallbackPair.reduce((n,v)=>n+v.sent,0),1,'only one fallback worker may deliver');
  assert.deepEqual(fallbackSent,['escalation:'+fallbackOrder.id]);
  const fallbackAck=await pool.query('SELECT sent_at,lease_token,lease_until FROM restaurant_escalations WHERE order_id=$1',[fallbackOrder.id]);
  assert.ok(fallbackAck.rows[0].sent_at);
  assert.equal(fallbackAck.rows[0].lease_token,null);
  assert.equal(fallbackAck.rows[0].lease_until,null);

  const interrupted=await placeOrder(pool,first,confirmed,'integration-fallback-crash-'+randomUUID());
  await pool.query(`UPDATE restaurant_escalations SET
   next_attempt_at=now()-interval '1 second',
   lease_token=$2,lease_until=now()+interval '10 minutes' WHERE order_id=$1`,[interrupted.id,randomUUID()]);
  const fallbackBlocked=await dispatchEscalations(oneConnection,async()=>{throw Error('locked fallback')},1);
  assert.equal(fallbackBlocked.processed,0);
  await pool.query("UPDATE restaurant_escalations SET lease_until=now()-interval '1 second' WHERE order_id=$1",[interrupted.id]);
  const fallbackRecovered:string[]=[];
  const recoveredFallback=await dispatchEscalations(oneConnection,async e=>{fallbackRecovered.push(String(e.id))},1);
  assert.equal(recoveredFallback.sent,1);
  assert.deepEqual(fallbackRecovered,['escalation:'+interrupted.id]);
 }finally{await oneConnection.end()}

});
