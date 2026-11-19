import test from 'node:test';
import assert from 'node:assert/strict';
import type {Pool} from 'pg';
import {dispatchEscalations} from '../src/escalation-service.ts';

const orderId='11111111-1111-4111-8111-111111111111';
const restaurantId='22222222-2222-4222-8222-222222222222';
type TestRow={order_id:string;restaurant_id:string;attempts:number;status:string;unexpired:boolean};
function fakePool(row:TestRow|null){
 const queries:{sql:string;params:unknown[]}[]=[];
 let unseen=Boolean(row);
 const client={
  query:async(sql:string,params:unknown[]=[])=>{
   queries.push({sql,params});
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK')return {rows:[],rowCount:0};
   if(sql.includes('FROM restaurant_escalations e')){
    if(!unseen||!row)return {rows:[],rowCount:0};
    unseen=false;return {rows:[row],rowCount:1};
   }
   if(sql.includes('UPDATE restaurant_escalations'))return {rows:[],rowCount:1};
   throw Error('Unexpected SQL '+sql);
  },release:()=>{}
 };
 return {pool:{connect:async()=>client} as unknown as Pool,queries};
}
function entry(extra:Partial<TestRow>={}):TestRow{
 return {order_id:orderId,restaurant_id:restaurantId,attempts:0,status:'beklemede',unexpired:true,...extra};
}
test('independent reminder sends only order/restaurant identifiers, not customer PII',async()=>{
 const db=fakePool(entry());let events:unknown[]=[];
 const result=await dispatchEscalations(db.pool,async event=>{events.push(event)},3);
 assert.deepEqual(result,{processed:1,sent:1,failed:0,cancelled:0,dead:0});
 assert.equal(events.length,1);
 const message=JSON.stringify(events[0]);
 assert.match(message,/pending_order_escalation/);
 assert.match(message,/escalation:11111111/);
 assert.doesNotMatch(message,/phone|address|customer|note|full_address|directions/i);
 assert.equal(db.queries.at(-1)?.sql,'COMMIT');
});
test('accepted or expired order is cancelled without sending a reminder',async()=>{
 for(const row of [entry({status:'kabul_edildi'}),entry({status:'beklemede',unexpired:false})]){
  const db=fakePool(row);
  let sent=0;
  const out=await dispatchEscalations(db.pool,async()=>{sent++});
  assert.equal(out.cancelled,1);
  assert.equal(sent,0);
  assert.ok(db.queries.some(q=>q.sql.includes('SET cancelled_at=now()')));
 }
});
test('failed alternate provider retains a retry and sanitizes errors',async()=>{
 const db=fakePool(entry());const out=await dispatchEscalations(db.pool,async()=>{throw Error('secret=should_not_leak')});
 assert.equal(out.failed,1);
 const update=db.queries.find(q=>q.sql.includes("last_error='DELIVERY_FAILED'"));
 assert.ok(update);
 assert.equal(update.params[1],false);
 assert.equal(update.params[2],15);
 assert.doesNotMatch(JSON.stringify(db.queries),/should_not_leak/);
});
test('six failed attempts escalate to a dead letter for admin review',async()=>{
 const db=fakePool(entry({attempts:5}));
 const out=await dispatchEscalations(db.pool,async()=>{throw Error('provider_down')});
 assert.equal(out.dead,1);
 const update=db.queries.find(q=>q.sql.includes("last_error='DELIVERY_FAILED'"));
 assert.ok(update);
 assert.equal(update.params[1],true);
 assert.equal(update.params[2],90);
});
