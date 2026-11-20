import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseAddressDraft} from '../src/address-service.ts';
const zoneId='aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa';
test('address values are normalized and never silently cut at field limits',()=>{
 const a=parseAddressDraft({zoneId,fullAddress:'  Bismil Sokak No 12  ',
  phone:'05000000000',label:'  Ev   Adresi ',directions:'  Arka kapı  '});
 assert.deepEqual(a,{zoneId,fullAddress:'Bismil Sokak No 12',phone:'05000000000',
  label:'Ev Adresi',directions:'Arka kapı'});
 assert.equal(parseAddressDraft({zoneId,fullAddress:'Bismil Sokak No 12',phone:'05000000000'}).label,'Ev');
});
test('address names, zone and phone must be valid',()=>{
 for(const raw of [null,{},[],{zoneId:'bad',fullAddress:'Bismil Sokak No 12',phone:'05000000000'},
  {zoneId,fullAddress:'kısa',phone:'05000000000'},
  {zoneId,fullAddress:'Bismil Sokak No 12',phone:'12345'},
  {zoneId,fullAddress:'Bismil Sokak No 12',phone:'05000000000',label:'L'.repeat(46)},
  {zoneId,fullAddress:'<script> No 12',phone:'05000000000'},
  {zoneId,fullAddress:'Bismil Sokak No 12',phone:'05000000000',directions:'a'.repeat(401)}
 ])assert.throws(()=>parseAddressDraft(raw),(e:unknown)=>e instanceof DomainError&&e.statusCode===400);
});
