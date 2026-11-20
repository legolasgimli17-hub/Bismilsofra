import test from 'node:test';
import assert from 'node:assert/strict';
import type {Pool} from 'pg';
import {dispatchEscalations} from '../src/escalation-service.ts';

const orderId='11111111-1111-4111-8111-111111111111';
const restaurantId='22222222-2222-4222-8222-222222222222';
type TestRow={order_id:string;restaurant_id:string;attempts:number;status:string;unexpired:boolean};
function fakePool(row:TestRow|null,{expiredAck=false}={}){
 const queries:{sql:string;params:unknown[]}[]=[];
 let unseen=Boolean(row);
 const client={
  query:async(sql:string,params:unknown[]=[])=>{
   queries.push({sql,params});
   if(sql.includes('WITH candidate AS')){
    if(!unseen||!row)return {rows:[],rowCount:0};
    unseen=false;return {rows:[row],rowCount:1};
   }
   if(sql.startsWith('SELECT status,expires_at>now()')){
    return {rows:row?[{status:row.status,unexpired:row.unexpired}]:[],rowCount:row?1:0};
   }
   if(sql.includes('SET sent_at=now()')&&expiredAck)return {rows:[],rowCount:0};
   if(sql.includes('UPDATE restaurant_escalations'))return {rows:[{order_id:row?.order_id}],rowCount:1};
   throw Error('Unexpected SQL '+sql);
  }
 };
 return {pool:client as unknown as Pool,queries};
}
function entry(extra:Partial<TestRow>={}):TestRow{
 return {order_id:orderId,restaurant_id:restaurantId,attempts:0,status:'beklemede',unexpired:true,...extra};
}
test('fallback reminder sends only stable order identity with no DB tx held during send',async()=>{
 const db=fakePool(entry());const events:unknown[]=[];
 const result=await dispatchEscalations(db.pool,async event=>{
  events.push(event);
  assert.ok(db.queries.some(q=>q.sql.includes('WITH candidate AS')));
  assert.ok(db.queries.every(q=>!['BEGIN','COMMIT'].includes(q.sql)));
  assert.equal(db.queries.length,2,'claim and status recheck occur before network; ack occurs after');
 },3);
 assert.deepEqual(result,{processed:1,sent:1,failed:0,cancelled:0,dead:0});
 assert.equal(events.length,1);
 const message=JSON.stringify(events[0]);
 assert.match(message,/pending_order_escalation/);
 assert.match(message,/escalation:11111111/);
 assert.doesNotMatch(message,/phone|address|customer|note|full_address|directions/i);
 assert.ok(db.queries.some(q=>q.sql.includes('SET sent_at=now()')));
});
test('accepted or expired order is cancelled without sending a reminder',async()=>{
 for(const row of [entry({status:'kabul_edildi'}),entry({status:'beklemede',unexpired:false})]){
  const db=fakePool(row);let sent=0;
  const out=await dispatchEscalations(db.pool,async()=>{sent++});
  assert.equal(out.cancelled,1);
  assert.equal(sent,0);
  assert.ok(db.queries.some(q=>q.sql.includes('SET cancelled_at=now()')));
 }
});
test('failed fallback provider retries without persisting secrets',async()=>{
 const db=fakePool(entry());
 const out=await dispatchEscalations(db.pool,async()=>{throw Error('secret=should_not_leak')});
 assert.equal(out.failed,1);
 const update=db.queries.find(q=>q.sql.includes("last_error='DELIVERY_FAILED'"));
 assert.ok(update);assert.equal(update.params[2],false);assert.equal(update.params[3],15);
 assert.doesNotMatch(JSON.stringify(db.queries),/should_not_leak/);
});
test('six failures lead to terminal dead-letter for administrator review',async()=>{
 const db=fakePool(entry({attempts:5}));
 const out=await dispatchEscalations(db.pool,async()=>{throw Error('provider_down')});
 assert.equal(out.dead,1);
 const update=db.queries.find(q=>q.sql.includes("last_error='DELIVERY_FAILED'"));
 assert.ok(update);assert.equal(update.params[2],true);assert.equal(update.params[3],90);
});
test('expired worker cannot acknowledge a reminder owned by another worker',async()=>{
 const db=fakePool(entry(),{expiredAck:true});
 const out=await dispatchEscalations(db.pool,async()=>{},1);
 assert.deepEqual(out,{processed:1,sent:0,failed:0,cancelled:0,dead:0});
 const ack=db.queries.find(q=>q.sql.includes('SET sent_at=now()'));
 assert.ok(ack);assert.match(ack.sql,/lease_token=\$2::uuid/);
});
