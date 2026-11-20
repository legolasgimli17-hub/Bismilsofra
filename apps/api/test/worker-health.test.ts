import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeWorkerHealth,recordWorkerCycle,MAX_WORKER_AGE_MS} from '../src/worker-health.ts';
const time=Date.parse('2026-11-20T12:00:00Z');
const row=(name:string,age:number,state:'ok'|'error'|'delivery_error'='ok')=>({
 worker_name:name,last_seen_at:new Date(time-age),last_cycle_state:state,
 last_successful_cycle_at:null,last_work_at:null,last_failure_at:null
});
test('no heartbeats means all workers missing',()=>{
 assert.deepEqual(summarizeWorkerHealth([],time).map(s=>s.status),['missing','missing','missing']);
});
test('fresh worker is alive; expired heartbeat is stale',()=>{
 const states=summarizeWorkerHealth([row('outbox',1000),row('escalation',MAX_WORKER_AGE_MS+1)],time);
 assert.deepEqual(states.map(w=>w.status),['running','stale','missing']);
 assert.equal(states[0].lastSeenAt,'2026-11-20T11:59:59.000Z');
});
test('delivery errors differ from process errors and normal polling',()=>{
 assert.deepEqual(summarizeWorkerHealth([row('outbox',100,'delivery_error'),row('escalation',100,'error'),row('expiry',100)],time).map(w=>w.status),['delivery_error','error','running']);
});
test('impossible or invalid timestamps do not appear healthy',()=>{
 assert.equal(summarizeWorkerHealth([row('outbox',-30_000)],time)[0].status,'stale');
 assert.equal(summarizeWorkerHealth([{...row('expiry',0),last_seen_at:'garbled'}],time)[2].status,'missing');
});
test('heartbeat records only bounded counters and state, never provider error text',async()=>{
 const values:unknown[][]=[];
 const db={query:async(_sql:string,params:unknown[])=>{values.push(params);return {rows:[]}}} as any;
 await recordWorkerCycle(db,'outbox',{success:true,work:1});
 await recordWorkerCycle(db,'escalation',{success:true,failed:1});
 await recordWorkerCycle(db,'expiry',{success:false});
 assert.deepEqual(values,[['outbox','ok',1],['escalation','delivery_error',0],['expiry','error',0]]);
 await assert.rejects(()=>recordWorkerCycle(db,'unknown' as never,{success:true}));
 await assert.rejects(()=>recordWorkerCycle(db,'outbox',{success:true,work:-1}));
});
