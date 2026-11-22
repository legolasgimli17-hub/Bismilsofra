import test from 'node:test';
import assert from 'node:assert/strict';
import {latestCompletedOrder} from './recent-orders.ts';
import type {Order} from './types.ts';
const sample=(id:string,status:string,created_at:string):Order=>({
 id,restaurant_id:'rest-1',status,total_kurus:25000,payment_method:'cash',created_at
});
test('only delivered orders can appear in the home reorder shortcut',()=>{
 const orders=[sample('active','beklemede','2026-11-21T12:00:00Z'),sample('past','teslim_edildi','2026-11-20T12:00:00Z')];
 assert.equal(latestCompletedOrder(orders)?.id,'past');
});
test('latest complete order wins regardless of API ordering',()=>{
 const orders=[sample('older','teslim_edildi','2026-11-18T12:00:00Z'),sample('newer','teslim_edildi','2026-11-20T12:00:00Z')];
 assert.equal(latestCompletedOrder(orders)?.id,'newer');
 assert.equal(orders[0].id,'older');
});
test('cancelled, rejected and expired orders cannot be repeated by shortcut',()=>{
 const statuses=['musteri_iptal','reddedildi','restoran_iptal','suresi_doldu'];
 assert.equal(latestCompletedOrder(statuses.map((s,i)=>sample(String(i),s,'2026-11-21T12:00:00Z'))),null);
});
test('unusable API dates and missing IDs are ignored',()=>{
 assert.equal(latestCompletedOrder([sample('invalid','teslim_edildi','bad-date')]),null);
 assert.equal(latestCompletedOrder([{...sample('abc','teslim_edildi','2026-11-21T12:00:00Z'),restaurant_id:''}]),null);
});
test('empty list is handled without rendering a fake order',()=>{
 assert.equal(latestCompletedOrder([]),null);
});
