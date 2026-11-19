import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantNextActions,canSubmitMerchantAction,isMerchantOpenStatus} from './merchant-workflow.ts';
test('incoming order can only be accepted or rejected',()=>assert.deepEqual(merchantNextActions('beklemede').map(x=>x.to),['kabul_edildi','reddedildi']));
test('accepted order can start preparation or be cancelled',()=>assert.deepEqual(merchantNextActions('kabul_edildi').map(x=>x.to),['hazirlaniyor','restoran_iptal']));
test('preparing order can be made ready or cancelled',()=>assert.deepEqual(merchantNextActions('hazirlaniyor').map(x=>x.to),['hazir','restoran_iptal']));
test('ready order only progresses to courier',()=>assert.deepEqual(merchantNextActions('hazir').map(x=>x.to),['yolda']));
test('on the way can be delivered or failed with reason',()=>assert.deepEqual(merchantNextActions('yolda').map(x=>x.to),['teslim_edildi','teslim_edilemedi']));
test('terminal and unknown statuses have no actions',()=>{for(const s of ['teslim_edildi','reddedildi','suresi_doldu','musteri_iptal','restoran_iptal','teslim_edilemedi','unknown'])assert.equal(merchantNextActions(s).length,0)});
test('denies actions if merchant offline',()=>assert.equal(canSubmitMerchantAction('beklemede','kabul_edildi','',false,true),false));
test('denies actions if viewer lacks manage permission',()=>assert.equal(canSubmitMerchantAction('beklemede','kabul_edildi','',true,false),false));
test('rejections require a meaningful reason',()=>{assert.equal(canSubmitMerchantAction('beklemede','reddedildi','yok',true,true),false);assert.equal(canSubmitMerchantAction('beklemede','reddedildi','Ürün stokta yok',true,true),true)});
test('failed delivery requires a meaningful reason',()=>{assert.equal(canSubmitMerchantAction('yolda','teslim_edilemedi','?',true,true),false);assert.equal(canSubmitMerchantAction('yolda','teslim_edilemedi','Adres bulunamadı',true,true),true)});
test('invalid transitions never enabled even if connected',()=>assert.equal(canSubmitMerchantAction('hazir','teslim_edildi','',true,true),false));
test('open statuses are enumerable',()=>{assert.equal(isMerchantOpenStatus('hazir'),true);assert.equal(isMerchantOpenStatus('suresi_doldu'),false)});
import {assertTransition,type Status} from '../../api/src/domain.ts';
test('every merchant UI action exists in authoritative backend state machine',()=>{
 const createdAt=new Date('2026-11-19T12:00:00Z');
 const actionTime=new Date('2026-11-19T12:01:00Z');
 const expiry=new Date('2026-11-19T12:04:00Z');
 for(const status of ['beklemede','kabul_edildi','hazirlaniyor','hazir','yolda'] as const){
  for(const action of merchantNextActions(status)){
   assert.doesNotThrow(()=>assertTransition(status as Status,action.to as Status,'restaurant',action.requiresReason?'Ürün stokta yok':'',createdAt,actionTime,expiry),`${status} -> ${action.to}`);
  }
 }
});
