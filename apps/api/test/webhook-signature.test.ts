import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {createSignedWebhook} from '../src/notification-service.ts';

test('primary and fallback providers receive signed, stable non-PII event IDs',async()=>{
 const secret='a'.repeat(64);
 const oldFetch=globalThis.fetch;
 let seen:{url:string;headers:Record<string,string>;body:string}|null=null;
 globalThis.fetch=(async(url:RequestInfo|URL,init?:RequestInit)=>{
  seen={url:String(url),headers:init?.headers as Record<string,string>,body:String(init?.body)};
  return new Response(null,{status:204});
 }) as typeof fetch;
 try{
  const deliver=createSignedWebhook('https://alerts.example.test/ingest',secret);
  await deliver({id:'escalation:11111111-1111-4111-8111-111111111111',
   order_id:'11111111-1111-4111-8111-111111111111',
   restaurant_id:'22222222-2222-4222-8222-222222222222',
   type:'pending_order_escalation',payload:{reason:'still_unaccepted'},attempts:1});
 }finally{globalThis.fetch=oldFetch}
 assert.ok(seen!==null);
 const captured=seen as {url:string;headers:Record<string,string>;body:string};
 assert.equal(captured.url,'https://alerts.example.test/ingest');
 assert.equal(captured.headers['x-sofra-event-id'],'escalation:11111111-1111-4111-8111-111111111111');
 const expected='sha256='+createHmac('sha256',secret).update(captured.body).digest('hex');
 assert.equal(captured.headers['x-sofra-signature'],expected);
 assert.doesNotMatch(captured.body,/address|phone|directions|customer|full_address/i);
 assert.match(captured.body,/pending_order_escalation/);
});
