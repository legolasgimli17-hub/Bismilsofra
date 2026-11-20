import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {isSupportStatus,nextSupportStatuses,parseSupportUpdate} from '../src/support-service.ts';
const code=(value:string)=>(error:unknown)=>error instanceof DomainError&&error.code===value;
test('case workflow supports review, resolution, closure and explicit reopening',()=>{
 assert.deepEqual(nextSupportStatuses('acik'),['incelemede','cozuldu']);
 assert.deepEqual(nextSupportStatuses('kapandi'),[]);
 assert.deepEqual(parseSupportUpdate({expectedStatus:'acik',to:'incelemede'}),{from:'acik',to:'incelemede'});
 assert.deepEqual(parseSupportUpdate({expectedStatus:'cozuldu',to:'incelemede'}),{from:'cozuldu',to:'incelemede'});
});
test('unknown states, self-transitions and reopening closed cases are rejected',()=>{
 assert.equal(isSupportStatus('customer'),false);
 for(const input of [
  null,[],{expectedStatus:'acik',to:'acik'},
  {expectedStatus:'kapandi',to:'incelemede'},
  {expectedStatus:'incelemede',to:'kapandi'},
  {expectedStatus:'acik',to:'arşiv'},
 ]){
  assert.throws(()=>parseSupportUpdate(input),(e:unknown)=>e instanceof DomainError&&['SUPPORT_INVALID','SUPPORT_TRANSITION'].includes(e.code));
 }
 assert.throws(()=>parseSupportUpdate({expectedStatus:'kapandi',to:'acik'}),code('SUPPORT_TRANSITION'));
});
