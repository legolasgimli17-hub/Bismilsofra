import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canStaff,assertTransition,payloadHash,parseOrder,DomainError} from '../src/domain.ts';
import {placeOrder,changeStatus} from '../src/order-service.ts';
import {dispatchOutbox,createSignedWebhook} from '../src/notification-service.ts';
const ids={user:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rest:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',zone:'99999999-9999-4999-8999-999999999999',addr:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',p:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',order:'11111111-1111-4111-8111-111111111111'};
const key='v06-replay-1234567890';
const input={restaurantId:ids.rest,addressId:ids.addr,paymentMethod:'cash',items:[{productId:ids.p,quantity:1,optionIds:[]}],note:''};
const rows=(items:any[]=[])=>({rows:items,rowCount:items.length});
function poolFor(handler:(sql:string,params:any[])=>any){
 const seen:{sql:string;params:any[]}[]=[];
 const client={query:async(sql:string,params:any[]=[])=>{seen.push({sql,params});if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return rows();return handler(sql,params)},release:()=>{}};
 return {connect:async()=>client,seen} as any;
}
const domainCode=(code:string)=>(e:unknown)=>e instanceof DomainError&&e.code===code;
test('staff cannot view orders/menu or update orders without explicit grant',()=>{
 const worker={role:'staff',can_view_orders:false,can_manage_orders:false,can_manage_menu:false};
 assert.equal(canStaff(worker,'view'),false);assert.equal(canStaff(worker,'order'),false);assert.equal(canStaff(worker,'menu'),false);
 assert.equal(canStaff({...worker,can_view_orders:true},'view'),true);
 assert.equal(canStaff({...worker,can_view_orders:true},'order'),false);
 assert.equal(canStaff({role:'owner'},'menu'),true);
 assert.equal(canStaff({role:'manager'},'order'),true);
 assert.equal(canStaff({role:'customer'},null),false);
});
test('semantic idempotency hash remains stable across variant line order',()=>{
 const a={...input,items:[{productId:ids.p,quantity:1,optionIds:[ids.zone]},{productId:ids.p,quantity:2,optionIds:[]}]};
 const b={...input,items:[...a.items].reverse()};
 assert.equal(payloadHash(parseOrder(a,key)),payloadHash(parseOrder(b,key)));
});
test('explicit per-order expiration controls transition, not a global 4-minute constant',()=>{
 const now=new Date('2026-11-18T12:00:00.000Z'),created=new Date('2026-11-18T11:59:30.000Z');
 assert.doesNotThrow(()=>assertTransition('beklemede','kabul_edildi','restaurant','',created,now,new Date('2026-11-18T12:06:00Z')));
 assert.throws(()=>assertTransition('beklemede','kabul_edildi','restaurant','',created,now,new Date('2026-11-18T11:59:59Z')),domainCode('EXPIRED'));
});
test('closed temporary schedule prevents checkout',async()=>{
 const db=poolFor((sql)=>{
  if(sql.includes('pg_advisory_xact_lock'))return rows([{}]);
  if(sql.includes('FROM orders WHERE customer_id'))return rows();
  if(sql.includes('FROM addresses a'))return rows([{zone_id:ids.zone,zone_enabled:true,zone_name:'Bismil',full_address:'Sokak 10',phone:'05000000000',label:'Ev',directions:''}]);
  if(sql.includes('FROM restaurants WHERE id'))return rows([{active:true,is_open:true,is_busy:false,accepts_orders:true}]);
  if(sql.includes('FROM restaurant_delivery_zones'))return rows([{min_basket_kurus:0,delivery_fee_kurus:0}]);
  if(sql.includes('SELECT EXISTS'))return rows([{allowed:true}]);
  if(sql.includes('FROM restaurant_closures'))return rows([{id:ids.order}]);
  throw Error('unexpected query: '+sql);
 });
 await assert.rejects(()=>placeOrder(db,ids.user,input,key),domainCode('RESTAURANT_CLOSED'));
 assert.equal(db.seen.some((q:any)=>q.sql.includes('INSERT INTO orders')),false);
});
test('new order respects restaurant-specific acceptance minutes',async()=>{
 const db=poolFor((sql)=>{
  if(sql.includes('pg_advisory_xact_lock'))return rows([{}]);
  if(sql.includes('FROM orders WHERE customer_id'))return rows();
  if(sql.includes('FROM addresses a'))return rows([{zone_id:ids.zone,zone_enabled:true,zone_name:'Merkez',full_address:'Adres 1234',phone:'05000000000',label:'Ev',directions:''}]);
  if(sql.includes('FROM restaurants WHERE id'))return rows([{active:true,is_open:true,is_busy:false,accepts_orders:true}]);
  if(sql.includes('FROM restaurant_delivery_zones'))return rows([{min_basket_kurus:100,delivery_fee_kurus:500,delivery_min_minutes:20,delivery_max_minutes:35}]);
  if(sql.includes('SELECT EXISTS'))return rows([{allowed:true}]);
  if(sql.includes('FROM restaurant_closures'))return rows();
  if(sql.includes('FROM restaurant_settings'))return rows([{accept_minutes:9}]);
  if(sql.includes('FROM products WHERE restaurant_id'))return rows([{id:ids.p,name:'Test yemek',price_kurus:12000,available:true}]);
  if(sql.includes('FROM option_groups'))return rows();
  if(sql.includes('INSERT INTO orders'))return rows([{id:ids.order}]);
  if(sql.startsWith('INSERT INTO order_items')||sql.startsWith('INSERT INTO order_events')||sql.startsWith('INSERT INTO notification_outbox'))return rows();
  throw Error('unexpected query: '+sql);
 });
 const result=await placeOrder(db,ids.user,{...input,confirmedTotalKurus:12500},key);
 assert.equal(result.id,ids.order);assert.equal(result.totals?.totalKurus,12500);
 const insert=db.seen.find((q:any)=>q.sql.includes('INSERT INTO orders'));
 assert.deepEqual(insert.params.slice(11),[9,20,35]);
 assert.match(insert.sql,/interval '1 minute'/);
});
test('restaurant cannot update an order if staff permission is missing',async()=>{
 const db=poolFor(sql=>{
  if(sql.includes('FROM orders WHERE id='))return rows([{id:ids.order,restaurant_id:ids.rest,customer_id:ids.user,status:'beklemede',created_at:new Date(),expires_at:new Date(Date.now()+60000)}]);
  if(sql.includes('FROM restaurant_staff'))return rows([{role:'staff',can_manage_orders:false}]);
  throw Error('unexpected query '+sql);
 });
 await assert.rejects(()=>changeStatus(db,'restaurant',ids.user,ids.order,'kabul_edildi'),domainCode('ROLE_FORBIDDEN'));
 assert.equal(db.seen.some((q:any)=>q.sql.startsWith('UPDATE orders')),false);
});
/** Fake query adapter models a committed claim. Delivery must NOT hold a tx. */
function fakeOutbox(event:{id:number;order_id:string;restaurant_id:string;type:string;payload:unknown;attempts:number}|null){
 const seen:{sql:string;params:any[]}[]=[];
 let claimed=false;
 const db={
  seen,
  query:async(sql:string,params:any[]=[])=>{
   seen.push({sql,params});
   if(sql.includes('WITH candidate AS')){
    if(claimed||!event)return rows();
    claimed=true;return rows([event]);
   }
   if(sql.startsWith('UPDATE notification_outbox'))return rows([{id:event?.id??0}]);
   throw Error('Unexpected SQL '+sql);
  }
 };
 return db as any;
}
test('outbox ack uses a committed lease and does not hold DB connection during delivery',async()=>{
 const db=fakeOutbox({id:8,order_id:ids.order,restaurant_id:ids.rest,type:'new_order',payload:{orderId:ids.order},attempts:0});
 const observed:number[]=[];
 const output=await dispatchOutbox(db,async event=>{
  observed.push(Number(event.id));
  assert.equal(db.seen.length,1,'no transaction or row lock should be open across network call');
  assert.match(db.seen[0].sql,/FOR UPDATE SKIP LOCKED/);
 },5);
 assert.deepEqual(output,{processed:1,sent:1,failed:0,dead:0});
 assert.deepEqual(observed,[8]);
 assert.ok(db.seen.some((q:any)=>q.sql.includes('SET sent_at=now()')));
 assert.ok(db.seen.every((q:any)=>!['BEGIN','COMMIT'].includes(q.sql)));
});
test('outbox retry persists sanitized error, backoff and eventual dead letter',async()=>{
 const db=fakeOutbox({id:33,order_id:ids.order,restaurant_id:ids.rest,type:'new_order',payload:{},attempts:11});
 const output=await dispatchOutbox(db,async()=>{throw Error('secret=do-not-log')});
 assert.deepEqual(output,{processed:1,sent:0,failed:1,dead:1});
 const update=db.seen.find((q:any)=>q.sql.includes("last_error='DELIVERY_FAILED'"));
 assert.ok(update);
 assert.equal(update.params[2],true);assert.equal(update.params[3],3600);
 assert.doesNotMatch(JSON.stringify(db.seen),/do-not-log/);
});
test('outbox refuses to acknowledge an expired, superseded delivery lease',async()=>{
 const db=fakeOutbox({id:44,order_id:ids.order,restaurant_id:ids.rest,type:'new_order',payload:{},attempts:0});
 const query=db.query;
 db.query=async(sql:string,params:any[]=[])=>{
  if(sql.includes('SET sent_at=now()'))return rows();
  return query(sql,params);
 };
 const out=await dispatchOutbox(db,async()=>{},1);
 assert.deepEqual(out,{processed:1,sent:0,failed:0,dead:0});
});
test('webhook configuration rejects insecure URL or weak signature secret',()=>{
 assert.throws(()=>createSignedWebhook('http://example.com','x'.repeat(64)),/HTTPS/);
 assert.throws(()=>createSignedWebhook('https://example.com','weak'),/32/);
 assert.doesNotThrow(()=>createSignedWebhook('https://example.com/ingest','x'.repeat(32)));
});
test('migration manifest requires 001–009 and never fictional seed 002',()=>{
 const source=readFileSync(new URL('../src/migrate.ts',import.meta.url),'utf8');
 assert.match(source,/001_initial\.sql/);assert.match(source,/003_reliability\.sql/);assert.match(source,/004_escalation\.sql/);assert.match(source,/005_product_revisions\.sql/);assert.match(source,/006_restaurant_media\.sql/);assert.match(source,/007_product_options_editor\.sql/);assert.match(source,/008_outbox_leases\.sql/);assert.match(source,/009_escalation_leases\.sql/);assert.match(source,/010_worker_heartbeats\.sql/);
 assert.doesNotMatch(source,/['"]002_development_example\.sql['"]/);
 assert.match(source,/schema_migrations/);assert.match(source,/sha256/);
});
