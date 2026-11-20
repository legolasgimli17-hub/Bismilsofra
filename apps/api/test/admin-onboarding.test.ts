import test from 'node:test';
import assert from 'node:assert/strict';
import {DomainError} from '../src/domain.ts';
import {parseRestaurantDraft,parseOwnerEmail,parseDeliveryZoneDraft,parseRestaurantZone} from '../src/admin-onboarding.ts';

const rejected=(fn:()=>unknown)=>assert.throws(fn,(error:unknown)=>error instanceof DomainError&&error.statusCode===400);
test('new restaurant draft is private, name and slug format are strict',()=>{
 assert.deepEqual(parseRestaurantDraft({name:'  Yeni   Restoran ',slug:'yeni-restoran',phone:'05001234567'}),
  {name:'Yeni Restoran',slug:'yeni-restoran',phone:'05001234567'});
 assert.equal(parseRestaurantDraft({name:'Örnek Döner',slug:'ornek-doner'}).phone,null);
 for(const input of [{name:'X',slug:'x'}, {name:'Restoran',slug:'Büyük'},
  {name:'Restoran',slug:'../bad'}, {name:'Restoran',slug:'r'.repeat(71)},
  {name:'<script>',slug:'script'}, {name:'Restoran',slug:'r1',phone:'5555555555'},
  null,[]])rejected(()=>parseRestaurantDraft(input));
});
test('owner can only be linked to a validated normalized email',()=>{
 assert.equal(parseOwnerEmail({email:' Merchant@Example.COM '}),'merchant@example.com');
 rejected(()=>parseOwnerEmail({email:'bad'}));
 rejected(()=>parseOwnerEmail({email:'foo@'}));
 rejected(()=>parseOwnerEmail([]));
});
test('zone setup uses a real UUID, bool and integer kuruş',()=>{
 assert.equal(parseDeliveryZoneDraft({name:'  Yeni    Mahalle '}),'Yeni Mahalle');
 const input={zoneId:'aaaaaaaa-1000-4000-8000-aaaaaaaaaaaa',enabled:true,minBasketKurus:20000,deliveryFeeKurus:1500};
 assert.deepEqual(parseRestaurantZone(input),input);
 rejected(()=>parseRestaurantZone({...input,deliveryFeeKurus:1.50}));
 rejected(()=>parseRestaurantZone({...input,zoneId:'bad'}));
 rejected(()=>parseRestaurantZone({...input,enabled:'true'}));
 rejected(()=>parseDeliveryZoneDraft({name:'<iframe>'}));
});
