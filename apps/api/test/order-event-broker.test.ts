import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderEventBroker,parseOrderSignal} from '../src/order-event-broker.ts';
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const c='cccccccc-cccc-4ccc-8ccc-cccccccccccc',d='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
test('database notification payload accepts only tenant/customer IDs',()=>{
 assert.deepEqual(parseOrderSignal(JSON.stringify({restaurantId:a,customerId:b})),{restaurantId:a,customerId:b});
 assert.equal(parseOrderSignal('bogus'),null);
 assert.equal(parseOrderSignal(JSON.stringify({restaurantId:a,customerId:'bad'})),null);
 assert.equal(parseOrderSignal(JSON.stringify({restaurantId:a,customerId:b,address:'secret'}))?.restaurantId,a);
});
test('shared broker isolates tenant and customer subscribers and cleans up',async()=>{
 const broker=new OrderEventBroker('postgres://invalid-not-connected');
 let tenantA=0,tenantC=0,userB=0,userD=0;
 const stopA=broker.subscribe('restaurant',a,()=>tenantA++);
 broker.subscribe('restaurant',c,()=>tenantC++);
 const stopB=broker.subscribe('customer',b,()=>userB++);
 broker.subscribe('customer',d,()=>userD++);
 broker.dispatch({restaurantId:a,customerId:b});
 assert.deepEqual([tenantA,tenantC,userB,userD],[1,0,1,0]);
 broker.dispatch({restaurantId:c,customerId:d});
 assert.deepEqual([tenantA,tenantC,userB,userD],[1,1,1,1]);
 stopA();stopB();stopB();
 broker.dispatch({restaurantId:a,customerId:b});
 assert.deepEqual([tenantA,tenantC,userB,userD],[1,1,1,1]);
 assert.equal(broker.subscribersCount,2);
 await broker.stop();
 assert.equal(broker.subscribersCount,0);
});
test('broken handler does not stop other matching listeners',async()=>{
 const broker=new OrderEventBroker('postgres://invalid-not-connected');
 broker.subscribe('restaurant',a,()=>{throw Error('test subscriber disconnected')});
 let seen=0;
 broker.subscribe('restaurant',a,()=>seen++);
 broker.dispatch({restaurantId:a,customerId:b});
 assert.equal(seen,1);
 await broker.stop();
});
