import test from 'node:test';
import assert from 'node:assert/strict';
import {apiSettings,pilotOrderIntake} from '../src/runtime-guard.ts';
test('API default is loopback; containers require explicit bind',()=>{
 assert.deepEqual(apiSettings({}),{host:'127.0.0.1',port:4000});
 assert.deepEqual(apiSettings({API_BIND_HOST:'0.0.0.0',PORT:'4189'}),{host:'0.0.0.0',port:4189});
 assert.deepEqual(apiSettings({API_BIND_HOST:'::',PORT:'65535'}),{host:'::',port:65535});
});
test('invalid listen settings cannot silently fall back',()=>{
 for(const port of ['0','-1','65536','3.5','abc','4000abc',' 4000',''])assert.throws(()=>apiSettings({PORT:port}));
 for(const host of ['localhost','evil.example','192.0.2.1','*'])assert.throws(()=>apiSettings({API_BIND_HOST:host}));
});
const valid={NODE_ENV:'production',PILOT_ACCEPT_ORDERS:'true',CORS_ORIGIN:'https://bismilsofra.example',
 ALERT_WEBHOOK_URL:'https://primary.provider.example/hook',
 ESCALATION_WEBHOOK_URL:'https://fallback.provider.example/hook',
 ALERT_WEBHOOK_SECRET:'a'.repeat(48),ESCALATION_WEBHOOK_SECRET:'b'.repeat(48)};
test('production intake defaults closed while test fixtures remain usable',()=>{
 assert.equal(pilotOrderIntake({...valid,PILOT_ACCEPT_ORDERS:undefined}).reason,'disabled');
 assert.equal(pilotOrderIntake({NODE_ENV:'production'}).enabled,false);
 assert.equal(pilotOrderIntake({}).enabled,false,'a missing NODE_ENV must never open live orders');
 assert.equal(pilotOrderIntake({NODE_ENV:'test'}).enabled,true);
 assert.equal(pilotOrderIntake({NODE_ENV:'development'}).enabled,true);
});
test('enabling production requires distinct HTTPS alert channels and origin',()=>{
 assert.deepEqual(pilotOrderIntake(valid),{enabled:true,reason:'allowed'});
 assert.equal(pilotOrderIntake({...valid,CORS_ORIGIN:'http://bismilsofra.example'}).reason,'insecure-origin');
 assert.equal(pilotOrderIntake({...valid,ALERT_WEBHOOK_URL:'http://primary.provider.example/hook'}).enabled,false);
 assert.equal(pilotOrderIntake({...valid,ESCALATION_WEBHOOK_URL:undefined}).enabled,false);
 assert.equal(pilotOrderIntake({...valid,ESCALATION_WEBHOOK_SECRET:'short'}).enabled,false);
 assert.equal(pilotOrderIntake({...valid,ESCALATION_WEBHOOK_URL:'https://primary.provider.example/other'}).reason,'shared-provider');
 assert.equal(pilotOrderIntake({...valid,ESCALATION_WEBHOOK_SECRET:valid.ALERT_WEBHOOK_SECRET}).reason,'shared-provider');
});

test('intake rejects placeholder or whitespace secrets and DNS hostname aliases',()=>{
 for(const secret of ['PUT_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS_HERE','PUT_AN_INDEPENDENT_RANDOM_SECRET_MIN_32_CHARACTERS','replace_with_a_real_random_secret_here',' '.repeat(40),'a'.repeat(40)+'\n']){
  assert.equal(pilotOrderIntake({...valid,ALERT_WEBHOOK_SECRET:secret}).reason,'missing-channels');
  assert.equal(pilotOrderIntake({...valid,ESCALATION_WEBHOOK_SECRET:secret}).reason,'missing-channels');
 }
 assert.equal(pilotOrderIntake({...valid,ESCALATION_WEBHOOK_URL:'https://PRIMARY.provider.example./different'}).reason,'shared-provider');
});
