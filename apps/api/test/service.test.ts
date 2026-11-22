import test from 'node:test';import assert from 'node:assert/strict';
import {placeOrder,changeStatus,activateRestaurant,expirePending} from '../src/order-service.ts';
import {DomainError,payloadHash,parseOrder} from '../src/domain.ts';
const ids={user:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user2:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',rest:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',addr:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',product:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',order:'11111111-1111-4111-8111-111111111111'};
const payload={restaurantId:ids.rest,addressId:ids.addr,paymentMethod:'cash',note:'',items:[{productId:ids.product,quantity:2,optionIds:[]}]};
const key='replay-key-123456789';
type Result={rows:any[];rowCount:number};
const result=(rows:any[]=[]):Result=>({rows,rowCount:rows.length});
function fakePool(handler:(sql:string,values:any[])=>Result){
 const seen:{sql:string;values:any[]}[]=[];
 const client={query:async(sql:string,values:any[]=[])=>{seen.push({sql,values});if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return result();return handler(sql,values)},release:()=>{}};
 return {connect:async()=>client,seen} as any;
}
const code=(e:unknown,c:string)=>e instanceof DomainError&&e.code===c;
test('idempotency replay: same key and payload returns same order without new insert',async()=>{
 const hash=payloadHash(parseOrder(payload,key));
 const db=fakePool((s)=>s.includes('pg_advisory_xact_lock')?result([{}]):s.startsWith('SELECT id,payload_hash FROM orders')?result([{id:ids.order,payload_hash:hash}]):(()=>{throw new Error('Unexpected '+s)})());
 const x=await placeOrder(db,ids.user,payload,key);assert.deepEqual(x,{id:ids.order,replayed:true});assert.equal(db.seen.some((s:any)=>s.sql.startsWith('INSERT INTO orders')),false);assert.equal(db.seen.at(-1).sql,'COMMIT');
});
test('changed payload on same key returns 409 and rolls back',async()=>{
 const db=fakePool((s)=>s.includes('pg_advisory_xact_lock')?result([{}]):s.startsWith('SELECT id,payload_hash FROM orders')?result([{id:ids.order,payload_hash:'0'.repeat(64)}]):(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>placeOrder(db,ids.user,payload,key),(e)=>code(e,'IDEMPOTENCY_CONFLICT'));
 assert.equal(db.seen.at(-1).sql,'ROLLBACK');
});
test('address not belonging to customer is not used for order',async()=>{
 const db=fakePool((s)=>s.includes('pg_advisory_xact_lock')?result([{}]):s.startsWith('SELECT id,payload_hash')?result():s.includes('FROM addresses a')?result():(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>placeOrder(db,ids.user,payload,key),(e)=>code(e,'ADDRESS_UNAVAILABLE'));
 assert.equal(db.seen.at(-1).sql,'ROLLBACK');
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('INSERT INTO orders')),false);
 assert.ok(db.seen.find((q:any)=>q.sql.includes('FROM addresses a')).values.includes(ids.user));
});
test('closed restaurant stops order before any pricing insert',async()=>{
 const db=fakePool((s)=>s.includes('pg_advisory_xact_lock')?result([{}]):s.startsWith('SELECT id,payload_hash')?result():s.includes('FROM addresses a')?result([{zone_id:ids.addr,zone_enabled:true}]):s.includes('FROM restaurants WHERE')?result([{active:true,is_open:false,is_busy:false,accepts_orders:true}]):(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>placeOrder(db,ids.user,payload,key),(e)=>code(e,'RESTAURANT_CLOSED'));
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('INSERT INTO orders')),false);
});
test('cross-tenant order status update must not change data',async()=>{
 const db=fakePool((s)=>s.includes('FROM orders WHERE id=')?result([{id:ids.order,restaurant_id:ids.rest,customer_id:ids.user2,status:'beklemede',created_at:new Date()}]):(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>changeStatus(db,'customer',ids.user,ids.order,'musteri_iptal'),(e)=>code(e,'NOT_FOUND'));
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('UPDATE orders')),false);
});
test('merchant without staff membership cannot alter order',async()=>{
 const db=fakePool((s)=>s.includes('FROM orders WHERE id=')?result([{id:ids.order,restaurant_id:ids.rest,customer_id:ids.user2,status:'beklemede',created_at:new Date()}]):s.includes('FROM restaurant_staff')?result():(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>changeStatus(db,'restaurant',ids.user,ids.order,'kabul_edildi'),(e)=>code(e,'NOT_FOUND'));
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('UPDATE orders')),false);
});
test('capacity full cannot activate 51st restaurant',async()=>{
 const db=fakePool((s)=>s.includes('FROM platform_admins')?result([{}]):s.includes('pg_advisory_xact_lock')?result([{}]):s.includes('FROM restaurants WHERE id')?result([{id:ids.rest,active:false,active_slot:null}]):s.includes('AS has_owner')?result([{has_owner:true,has_menu:true,has_hours:true,has_delivery:true}]):s.includes('FROM generate_series(1,$1::int)')?result():(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>activateRestaurant(db,ids.user,ids.rest,true),(e)=>code(e,'CAPACITY_FULL'));
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('UPDATE restaurants')),false);
});
test('activation requires admin db membership',async()=>{
 const db=fakePool((s)=>s.includes('FROM platform_admins')?result():(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>activateRestaurant(db,ids.user,ids.rest,true),(e)=>code(e,'ROLE_FORBIDDEN'));
});
test('expiry worker writes status and event in same transaction',async()=>{
 const db=fakePool((s)=>s.includes('FROM orders WHERE status=')?result([{id:ids.order,restaurant_id:ids.rest,status:'beklemede'}]):s.startsWith('UPDATE orders')?result():s.startsWith('INSERT INTO order_events')?result():s.startsWith('INSERT INTO notification_outbox')?result():(()=>{throw new Error('Unexpected '+s)})());
 const n=await expirePending(db);assert.equal(n,1);assert.equal(db.seen.filter((q:any)=>q.sql.startsWith('UPDATE orders')).length,1);assert.equal(db.seen.filter((q:any)=>q.sql.includes('INSERT INTO order_events')).length,1);assert.equal(db.seen.at(-1).sql,'COMMIT');
});
test('failed expiry event rolls back status change',async()=>{
 const db=fakePool((s)=>s.includes('FROM orders WHERE status=')?result([{id:ids.order,restaurant_id:ids.rest,status:'beklemede'}]):s.startsWith('UPDATE orders')?result():s.startsWith('INSERT INTO order_events')?(()=>{throw new Error('simulated DB outage')})():(()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>expirePending(db));assert.equal(db.seen.at(-1).sql,'ROLLBACK');
});

test('activation refuses a restaurant lacking verified owner, menu, hours and delivery',async()=>{
 const db=fakePool((s)=>s.includes('FROM platform_admins')?result([{}]):
  s.includes('pg_advisory_xact_lock')?result([{}]):
  s.includes('FROM restaurants WHERE id')?result([{id:ids.rest,active:false,active_slot:null}]):
  s.includes('AS has_owner')?result([{has_owner:false,has_menu:false,has_hours:false,has_delivery:false}]):
  (()=>{throw new Error('Unexpected '+s)})());
 await assert.rejects(()=>activateRestaurant(db,ids.user,ids.rest,true),
  e=>code(e,'RESTAURANT_NOT_READY'));
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('UPDATE restaurants')),false);
});
