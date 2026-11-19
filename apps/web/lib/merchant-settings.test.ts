import test from 'node:test';
import assert from 'node:assert/strict';
import {kurusToInput,inputToKurus,WEEKDAY_NAMES,newTimeSlot} from './merchant-settings.ts';

test('kuruş formatı Türkçe ondalık ayraca dönüşür',()=>{
 assert.equal(kurusToInput(1500),'15,00');
 assert.equal(kurusToInput(1999),'19,99');
 assert.equal(kurusToInput(0),'0,00');
});
test('TL kullanıcı girdisi güvenilir tam sayı kuruşa dönüşür',()=>{
 assert.equal(inputToKurus('19,90'),1990);
 assert.equal(inputToKurus('20.5'),2050);
 assert.equal(inputToKurus('200'),20000);
 assert.equal(inputToKurus(' 0,01 '),1);
});
test('kuruş hesaplamasında negatif, ondalık hatası ve binlik ayracı reddedilir',()=>{
 for(const x of ['-2','1,999','12,3,5','1.000,25','','12abc','9999999','0012','1e3'])
 assert.equal(inputToKurus(x),null,x);
});
test('hafta günleri PostgreSQL Pazar=0 takvimi ile aynı',()=>{
 assert.equal(WEEKDAY_NAMES.length,7);
 assert.equal(WEEKDAY_NAMES[0],'Pazar');
 assert.deepEqual(newTimeSlot(1),{dayOfWeek:1,openTime:'09:00',closeTime:'22:00'});
});
