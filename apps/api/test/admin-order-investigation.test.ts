import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseOrderLookupKey,ADMIN_ORDER_LOOKUP_SQL} from '../src/admin-order-investigation.ts';
const uuid='11111111-1111-4111-8111-111111111111';
test('accept exact order UUID or 8 character displayed prefix only',()=>{
 assert.deepEqual(parseOrderLookupKey(' 11111111 '),{fullId:null,prefix:'11111111'});
 assert.deepEqual(parseOrderLookupKey(uuid),{fullId:uuid,prefix:null});
 assert.deepEqual(parseOrderLookupKey(uuid.toUpperCase()),{fullId:uuid,prefix:null});
});
test('reject substring enumeration, SQL injection and unexpected shape',()=>{
 for(const q of ['1','1111','1111111','111111111','%11111111','11111111%',
  "' OR 1=1 --",null,{},['11111111']]){
  assert.throws(()=>parseOrderLookupKey(q),(e:unknown)=>e instanceof DomainError&&e.statusCode===400);
 }
});
test('admin list is bounded and contains no customer address/phone/contact data',()=>{
 assert.match(ADMIN_ORDER_LOOKUP_SQL,/LIMIT 6/);
 assert.match(ADMIN_ORDER_LOOKUP_SQL,/180 days/);
 assert.doesNotMatch(ADMIN_ORDER_LOOKUP_SQL,/address_snapshot|customer_id|phone|verified_email|oidc_subject|o\.note/i);
});
