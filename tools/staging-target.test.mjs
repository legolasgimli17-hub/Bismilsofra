import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStagingTarget} from './staging-target.mjs';
test('only local or specifically named HTTPS staging domains are eligible',()=>{
 assert.equal(validateStagingTarget('http://127.0.0.1:4188'),'http://127.0.0.1:4188');
 assert.equal(validateStagingTarget('https://api-staging.example.invalid'),'https://api-staging.example.invalid');
});
test('never probe actual production or credential-bearing URLs',()=>{
 for(const u of ['https://bismilsofra.example','http://api-staging.example.invalid',
  'https://user:pass@api-staging.example.invalid','https://api-staging.example.invalid/orders',
  'https://api-staging.example.invalid/?token=secret','http://127.0.0.1:4000/healthz',
  'ftp://127.0.0.1:4000','http://localhost','https://api.example.invalid'])
  assert.throws(()=>validateStagingTarget(u));
});
