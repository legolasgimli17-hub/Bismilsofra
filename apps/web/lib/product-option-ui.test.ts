import test from 'node:test';
import assert from 'node:assert/strict';
import {selectProductOption,permitsCartReplacement,parseSelectionBound} from './product-option-ui.ts';
import {addCartLine,EMPTY_CART} from './cart.ts';
import {preserveDirtyDrafts} from './option-editor-state.ts';

test('optional single-select allows clearing and replacing a choice',()=>{
 const first=selectProductOption([],'cheese',true,1);
 assert.deepEqual(first,['cheese']);
 assert.deepEqual(selectProductOption(first,'cheese',false,1),[]);
 assert.deepEqual(selectProductOption(first,'sauce',true,1),['sauce']);
});
test('multiple-selection group never exceeds max and can remove an option',()=>{
 const first=selectProductOption(['a'],'b',true,2);
 assert.deepEqual(first,['a','b']);
 assert.deepEqual(selectProductOption(first,'c',true,2),['a','b']);
 assert.deepEqual(selectProductOption(first,'a',false,2),['b']);
 assert.deepEqual(selectProductOption(['a'],'a',true,2),['a']);
});
test('reject invalid max selection without adding choices',()=>{
 assert.deepEqual(selectProductOption(['a'],'b',true,0),['a']);
 assert.deepEqual(selectProductOption(['a'],'b',true,13),['a']);
});
test('refresh keeps other unsaved group drafts and stale revision for conflict safety',()=>{
 const local={groupA:{name:'Edited local',revision:4},groupB:{name:'Saved',revision:5}};
 const remote={groupA:{name:'Updated remote',revision:6},groupB:{name:'Saved',revision:6}};
 const result=preserveDirtyDrafts(remote,local,new Set(['groupA']));
 assert.deepEqual(result.groupA,local.groupA);
 assert.deepEqual(result.groupB,remote.groupB);
});
test('refresh drops removed rows and follows server for untouched rows',()=>{
 const remote={newRow:{price:200},existing:{price:400}};
 const local={deleted:{price:100},existing:{price:300}};
 assert.deepEqual(preserveDirtyDrafts(remote,local,new Set(['deleted'])),remote);
});

test('option warning never authorizes replacing a different restaurant basket',()=>{
 const food={productId:'p',name:'Pide',imageUrl:null,priceKurus:10000,quantity:1,
  optionIds:[],optionLabels:[],optionExtraKurus:0};
 const cart=addCartLine(EMPTY_CART,'restaurantA','A',food,false);
 assert.equal(permitsCartReplacement('options'),false);
 assert.throws(()=>addCartLine(cart,'restaurantB','B',food,permitsCartReplacement('options')),/OTHER_RESTAURANT/);
 assert.equal(permitsCartReplacement('restaurant'),true);
 assert.equal(addCartLine(cart,'restaurantB','B',food,permitsCartReplacement('restaurant')).restaurantId,'restaurantB');
 assert.equal(permitsCartReplacement(null),false);
});
test('empty numeric bound cannot silently turn required selection into optional',()=>{
 assert.equal(parseSelectionBound('0',0,12),0);
 assert.equal(parseSelectionBound('12',1,12),12);
 for(const raw of ['', ' ', '1.5', '-1', '13', '1e0', '00'])
  assert.equal(parseSelectionBound(raw,0,12),null);
 assert.equal(parseSelectionBound('0',1,12),null);
});
