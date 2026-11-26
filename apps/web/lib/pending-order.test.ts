import test from 'node:test';
import assert from 'node:assert/strict';
import {canResetPendingOrder,hasPendingOrder,pendingOrderKey,readPendingOrder,samePendingCart} from './pending-order.ts';
const body=JSON.stringify({restaurantId:'restaurant',items:[{productId:'product',quantity:1,optionIds:[]}],confirmedTotalKurus:20000});
const attempt={key:'0a54da13-982a-4b25-bfde-f497af411a1c',body};
test('restores the exact submitted payload and key after a reload',()=>{
 const raw=JSON.stringify(attempt);
 assert.deepEqual(readPendingOrder(raw),attempt);
 const key=pendingOrderKey('customer-a');
 assert.notEqual(key,pendingOrderKey('customer-b'));
 assert.equal(hasPendingOrder({length:1,key:()=>key,getItem:()=>raw}),true);
 assert.equal(readPendingOrder('{"key":"malformed"}'),null);
});
test('pending recovery clears only the matching cart',()=>{
 const {items}=JSON.parse(body);
 assert.equal(samePendingCart(attempt,'restaurant',items),true);
 assert.equal(samePendingCart(attempt,'restaurant',[]),false);
});
test('uncertain outcomes retain the recovery record',()=>{
 for(const code of ['NETWORK','NOT_FOUND','RATE_LIMIT','ORDER_INTAKE_CLOSED','HTTP_ERROR'])
  assert.equal(canResetPendingOrder(code),false);
 for(const code of ['PRICE_CHANGED','DELIVERY_ESTIMATE_CHANGED'])
  assert.equal(canResetPendingOrder(code),true);
});
