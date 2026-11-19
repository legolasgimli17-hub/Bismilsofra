import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWeeklyHours,parseZonePolicy} from '../src/merchant-management.ts';
import {DomainError} from '../src/domain.ts';
const domain=(code:string)=>(e:unknown)=>e instanceof DomainError&&e.code===code;
test('weekly hours accepts empty week (fully closed), sorts valid day slots',()=>{
 assert.deepEqual(parseWeeklyHours([]),[]);
 assert.deepEqual(parseWeeklyHours([{dayOfWeek:3,openTime:'18:00',closeTime:'23:00'},{dayOfWeek:1,openTime:'09:00',closeTime:'12:00'}]),[
 {dayOfWeek:1,openTime:'09:00',closeTime:'12:00'},{dayOfWeek:3,openTime:'18:00',closeTime:'23:00'}]);
});
test('one day can have lunch and evening shifts without overlap',()=>{
 assert.equal(parseWeeklyHours([{dayOfWeek:2,openTime:'10:00',closeTime:'14:00'},{dayOfWeek:2,openTime:'17:00',closeTime:'23:30'}]).length,2);
});
test('cross-midnight opening is supported',()=>{
 assert.deepEqual(parseWeeklyHours([{dayOfWeek:6,openTime:'23:00',closeTime:'01:00'}])[0],{dayOfWeek:6,openTime:'23:00',closeTime:'01:00'});
});
test('overlapping shifts on the same day are rejected',()=>{
 assert.throws(()=>parseWeeklyHours([{dayOfWeek:0,openTime:'09:00',closeTime:'15:00'},{dayOfWeek:0,openTime:'14:30',closeTime:'19:00'}]),domain('HOURS_OVERLAP'));
});
test('overnight overlaps next day and wraps Sunday to Monday',()=>{
 assert.throws(()=>parseWeeklyHours([{dayOfWeek:6,openTime:'22:00',closeTime:'02:00'},{dayOfWeek:0,openTime:'01:00',closeTime:'03:00'}]),domain('HOURS_OVERLAP'));
 assert.throws(()=>parseWeeklyHours([{dayOfWeek:2,openTime:'23:00',closeTime:'03:00'},{dayOfWeek:3,openTime:'02:59',closeTime:'05:00'}]),domain('HOURS_OVERLAP'));
});
test('adjacent boundaries are allowed',()=>{
 assert.equal(parseWeeklyHours([{dayOfWeek:1,openTime:'09:00',closeTime:'12:00'},{dayOfWeek:1,openTime:'12:00',closeTime:'16:00'}]).length,2);
});
test('invalid times and days fail closed',()=>{
 for(const s of [{dayOfWeek:7,openTime:'09:00',closeTime:'10:00'},{dayOfWeek:1,openTime:'24:00',closeTime:'01:00'},
 {dayOfWeek:1,openTime:'9:00',closeTime:'11:00'},{dayOfWeek:1,openTime:'09:00',closeTime:'09:00'}]){
  assert.throws(()=>parseWeeklyHours([s]),domain('HOURS_INVALID'));
 }
 assert.throws(()=>parseWeeklyHours(null),domain('HOURS_INVALID'));
});
test('maximum three opening windows per day and 21 per week',()=>{
 assert.throws(()=>parseWeeklyHours([0,1,2,3].map(h=>({dayOfWeek:1,openTime:'0'+h+':00',closeTime:'0'+h+':30'}))),domain('HOURS_INVALID'));
 assert.throws(()=>parseWeeklyHours(Array(22).fill({dayOfWeek:1,openTime:'01:00',closeTime:'02:00'})),domain('HOURS_INVALID'));
});
test('delivery zone policy accepts bounded integer kuruş and boolean status',()=>{
 assert.deepEqual(parseZonePolicy({enabled:false,minBasketKurus:20000,deliveryFeeKurus:1500}),{enabled:false,minBasketKurus:20000,deliveryFeeKurus:1500});
 assert.deepEqual(parseZonePolicy({enabled:true,minBasketKurus:0,deliveryFeeKurus:0}),{enabled:true,minBasketKurus:0,deliveryFeeKurus:0});
});
test('zone policy rejects negative, floating, missing and oversized fees',()=>{
 for(const value of [{enabled:true,minBasketKurus:120.2,deliveryFeeKurus:0},{enabled:true,minBasketKurus:0,deliveryFeeKurus:-1},
 {enabled:'true',minBasketKurus:0,deliveryFeeKurus:0},{enabled:true,minBasketKurus:100000001,deliveryFeeKurus:0},{}]){
  assert.throws(()=>parseZonePolicy(value),domain('ZONE_POLICY_INVALID'));
 }
});
